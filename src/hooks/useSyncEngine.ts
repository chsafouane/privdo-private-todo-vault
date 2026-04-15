import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  deriveChannelId,
  deriveSyncKey,
  encryptForSync,
  decryptFromSync,
} from '@/lib/syncEncryption';
import { mergeTasks, hasChanges } from '@/lib/syncMerge';
import type { Task } from '@/types';
import { isValidTaskArray } from '@/types';

export type SyncAuthMode = 'passphrase' | 'email';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'disabled';

export interface SyncConfig {
  enabled: boolean;
  authMode: SyncAuthMode;
  channelId: string;
  syncKey: string;
  passphrase?: string; // stored only for display/re-entry; encrypted locally by PIN
  deviceId: string;
}

interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  lastSyncDeviceId: string | null;
  version: number;
  error: string | null;
}

const SYNC_CONFIG_KEY = 'privdo-sync-config';
const SYNC_STATE_KEY = 'privdo-sync-state';
const AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 2000; // 2 seconds after last task change

function getDeviceId(): string {
  let id = localStorage.getItem('privdo-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('privdo-device-id', id);
  }
  return id;
}

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig | null): void {
  if (config) {
    // Strip raw passphrase from persisted config to limit XSS exposure
    const toStore = { ...config, passphrase: undefined };
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(toStore));
  } else {
    localStorage.removeItem(SYNC_CONFIG_KEY);
  }
}

function loadSyncState(): SyncState {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { status: 'disabled', lastSyncAt: null, lastSyncDeviceId: null, version: 0, error: null };
}

function persistSyncState(state: SyncState): void {
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
}

// ─── Cloud API ───────────────────────────────────────────────────

async function cloudPull(config: SyncConfig): Promise<{
  exists: boolean;
  encryptedData?: string;
  version?: number;
  deviceId?: string;
  updatedAt?: string;
}> {
  if (config.authMode === 'email') {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('sync_blobs')
      .select('encrypted_data, version, device_id, updated_at')
      .eq('channel_id', config.channelId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return { exists: false };
    return {
      exists: true,
      encryptedData: data.encrypted_data,
      version: data.version,
      deviceId: data.device_id,
      updatedAt: data.updated_at,
    };
  }

  // Passphrase mode: use Edge Function
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('sync', {
    body: { action: 'pull', channelId: config.channelId },
  });
  if (error) throw new Error(error.message);
  return data;
}

async function cloudPush(
  config: SyncConfig,
  encryptedData: string,
  version: number
): Promise<{ ok: boolean; version: number }> {
  if (config.authMode === 'email') {
    if (!supabase) throw new Error('Supabase not configured');

    // Check if exists
    const { data: existing } = await supabase
      .from('sync_blobs')
      .select('version')
      .eq('channel_id', config.channelId)
      .maybeSingle();

    if (existing) {
      if (version !== existing.version) {
        throw new Error('VERSION_CONFLICT');
      }
      // Atomic update: include version in WHERE to prevent TOCTOU race
      const { data: updated, error } = await supabase
        .from('sync_blobs')
        .update({
          encrypted_data: encryptedData,
          version: existing.version + 1,
          device_id: config.deviceId,
          updated_at: new Date().toISOString(),
        })
        .eq('channel_id', config.channelId)
        .eq('version', existing.version)
        .select('version')
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!updated) throw new Error('VERSION_CONFLICT');
      return { ok: true, version: existing.version + 1 };
    } else {
      const { error } = await supabase
        .from('sync_blobs')
        .insert({
          channel_id: config.channelId,
          encrypted_data: encryptedData,
          version: 1,
          device_id: config.deviceId,
        });

      if (error) throw new Error(error.message);
      return { ok: true, version: 1 };
    }
  }

  // Passphrase mode: use Edge Function
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('sync', {
    body: {
      action: 'push',
      channelId: config.channelId,
      encryptedData,
      deviceId: config.deviceId,
      version,
    },
  });
  if (error) throw new Error(error.message);
  if (data?.error === 'Version conflict') throw new Error('VERSION_CONFLICT');
  return data;
}

// ─── Sync Engine Hook ────────────────────────────────────────────

export function useSyncEngine(
  tasks: Task[] | null | undefined,
  setTasks: (updater: (prev: Task[] | undefined) => Task[]) => void,
  isReady: boolean
) {
  const [syncConfig, setSyncConfigState] = useState<SyncConfig | null>(loadSyncConfig);
  const [syncState, setSyncState] = useState<SyncState>(loadSyncState);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncing = useRef(false);
  const lastPushedVersion = useRef(syncState.version);
  const syncRetryCount = useRef(0);

  const updateSyncState = useCallback((partial: Partial<SyncState>) => {
    setSyncState(prev => {
      const next = { ...prev, ...partial };
      persistSyncState(next);
      return next;
    });
  }, []);

  const setSyncConfig = useCallback((config: SyncConfig | null) => {
    saveSyncConfig(config);
    setSyncConfigState(config);
    if (!config) {
      updateSyncState({ status: 'disabled', error: null });
    }
  }, [updateSyncState]);

  // ─── Core Sync Logic ──────────────────────────────

  const performSync = useCallback(async () => {
    if (!syncConfig?.enabled || !tasks || !isReady) return;
    if (isSyncing.current) return;
    if (!navigator.onLine) {
      updateSyncState({ status: 'offline' });
      return;
    }

    isSyncing.current = true;
    updateSyncState({ status: 'syncing', error: null });

    try {
      // 1. Pull remote data
      const remote = await cloudPull(syncConfig);

      if (remote.exists && remote.encryptedData) {
        // 2. Decrypt remote
        const remoteTasks = decryptFromSync(remote.encryptedData, syncConfig.syncKey);
        if (remoteTasks && isValidTaskArray(remoteTasks)) {
          // 3. Merge
          const merged = mergeTasks(tasks, remoteTasks);
          const localChanged = hasChanges(tasks, merged);

          if (localChanged) {
            setTasks(() => merged);
          }

          // 4. Push merged result (if we had local changes)
          const remoteChanged = hasChanges(remoteTasks, merged);
          if (remoteChanged || !remote.exists) {
            const encrypted = encryptForSync(merged, syncConfig.syncKey);
            const result = await cloudPush(syncConfig, encrypted, remote.version ?? 0);
            lastPushedVersion.current = result.version;
            updateSyncState({
              status: 'idle',
              lastSyncAt: Date.now(),
              lastSyncDeviceId: syncConfig.deviceId,
              version: result.version,
            });
          } else {
            lastPushedVersion.current = remote.version ?? 0;
            updateSyncState({
              status: 'idle',
              lastSyncAt: Date.now(),
              lastSyncDeviceId: remote.deviceId ?? null,
              version: remote.version ?? 0,
            });
          }
        } else {
          // Decryption failed or invalid data — push local as truth
          const encrypted = encryptForSync(tasks, syncConfig.syncKey);
          const result = await cloudPush(syncConfig, encrypted, remote.version ?? 0);
          lastPushedVersion.current = result.version;
          updateSyncState({
            status: 'idle',
            lastSyncAt: Date.now(),
            lastSyncDeviceId: syncConfig.deviceId,
            version: result.version,
          });
        }
      } else {
        // No remote data — push local
        const encrypted = encryptForSync(tasks, syncConfig.syncKey);
        const result = await cloudPush(syncConfig, encrypted, 0);
        lastPushedVersion.current = result.version;
        updateSyncState({
          status: 'idle',
          lastSyncAt: Date.now(),
          lastSyncDeviceId: syncConfig.deviceId,
          version: result.version,
        });
      }
      syncRetryCount.current = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      if (message === 'VERSION_CONFLICT') {
        syncRetryCount.current++;
        if (syncRetryCount.current > 3) {
          syncRetryCount.current = 0;
          updateSyncState({ status: 'error', error: 'Sync conflict persists — try again later' });
          return;
        }
        isSyncing.current = false;
        updateSyncState({ version: 0 }); // Reset version to force re-pull
        setTimeout(() => performSync(), 500 * syncRetryCount.current);
        return;
      }
      updateSyncState({ status: 'error', error: message });
    } finally {
      isSyncing.current = false;
    }
  }, [syncConfig, tasks, isReady, setTasks, updateSyncState]);

  // ─── Auto-sync on task changes (debounced) ─────────

  const prevTasksRef = useRef<Task[] | null>(null);

  useEffect(() => {
    if (!syncConfig?.enabled || !isReady || !tasks) return;

    // Skip the initial load
    if (prevTasksRef.current === null) {
      prevTasksRef.current = tasks;
      return;
    }

    // Only trigger if tasks actually changed
    if (prevTasksRef.current === tasks) return;
    prevTasksRef.current = tasks;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSync();
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tasks, syncConfig?.enabled, isReady, performSync]);

  // ─── Periodic sync ────────────────────────────────

  useEffect(() => {
    if (!syncConfig?.enabled) return;

    intervalRef.current = setInterval(() => {
      performSync();
    }, AUTO_SYNC_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [syncConfig?.enabled, performSync]);

  // ─── Sync on app open ─────────────────────────────

  useEffect(() => {
    if (!syncConfig?.enabled || !isReady) return;
    // Small delay to let tasks load
    const timeout = setTimeout(() => performSync(), 1000);
    return () => clearTimeout(timeout);
  }, [syncConfig?.enabled, isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Online/offline listener ──────────────────────

  useEffect(() => {
    if (!syncConfig?.enabled) return;

    const handleOnline = () => {
      updateSyncState({ status: 'idle' });
      performSync();
    };
    const handleOffline = () => {
      updateSyncState({ status: 'offline' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncConfig?.enabled, performSync, updateSyncState]);

  // ─── Setup helpers ────────────────────────────────

  const setupPassphraseSync = useCallback((passphrase: string) => {
    const channelId = deriveChannelId(passphrase);
    const syncKey = deriveSyncKey(passphrase);
    const config: SyncConfig = {
      enabled: true,
      authMode: 'passphrase',
      channelId,
      syncKey,
      passphrase,
      deviceId: getDeviceId(),
    };
    setSyncConfig(config);
    return config;
  }, [setSyncConfig]);

  const setupEmailSync = useCallback(async (email: string, password: string, passphrase: string, isSignUp: boolean) => {
    if (!supabase) throw new Error('Supabase not configured');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication failed');

    const syncKey = deriveSyncKey(passphrase);
    const config: SyncConfig = {
      enabled: true,
      authMode: 'email',
      channelId: user.id,
      syncKey,
      passphrase,
      deviceId: getDeviceId(),
    };
    setSyncConfig(config);
    return config;
  }, [setSyncConfig]);

  const disconnect = useCallback(async () => {
    if (syncConfig?.authMode === 'email' && supabase) {
      await supabase.auth.signOut();
    }
    setSyncConfig(null);
    localStorage.removeItem(SYNC_STATE_KEY);
    setSyncState({ status: 'disabled', lastSyncAt: null, lastSyncDeviceId: null, version: 0, error: null });
  }, [syncConfig, setSyncConfig]);

  return {
    syncConfig,
    syncState,
    performSync,
    setupPassphraseSync,
    setupEmailSync,
    disconnect,
    setSyncConfig,
  };
}
