import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  deriveChannelId,
  deriveSyncKey,
  encryptForSync,
  decryptFromSync,
} from '@/lib/syncEncryption';
import { encryptData, decryptData, isKeySet } from '@/lib/encryption';
import { mergeVaults, hasVaultChanges } from '@/lib/syncMerge';
import type { Vault } from '@/types';
import { isValidVault, isValidTaskArray, DEFAULT_VAULT } from '@/types';

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
    // Try to decrypt (new encrypted format)
    if (isKeySet()) {
      const decrypted = decryptData(raw);
      if (decrypted && typeof decrypted === 'object' && decrypted.channelId) {
        return decrypted as SyncConfig;
      }
    }
    // Fallback: try plaintext JSON (migration from old format)
    const plain = JSON.parse(raw);
    if (plain && plain.channelId) return plain as SyncConfig;
    return null;
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig | null): void {
  if (config) {
    // Strip raw passphrase from persisted config to limit XSS exposure
    const toStore = { ...config, passphrase: undefined };
    if (isKeySet()) {
      // Encrypt sensitive sync config with the local encryption key
      const encrypted = encryptData(toStore);
      localStorage.setItem(SYNC_CONFIG_KEY, encrypted);
    } else {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(toStore));
    }
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
  vault: Vault | null | undefined,
  setVault: (updater: (prev: Vault | undefined) => Vault) => void,
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
    if (!syncConfig?.enabled || !vault || !isReady) return;
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
        const remoteData = decryptFromSync(remote.encryptedData, syncConfig.syncKey);

        // Support both old Task[] and new Vault formats
        let remoteVault: Vault;
        if (isValidVault(remoteData)) {
          remoteVault = remoteData;
        } else if (isValidTaskArray(remoteData)) {
          // Legacy: wrap Task[] in a vault
          const listId = vault.lists[0]?.id || crypto.randomUUID();
          remoteVault = {
            lists: vault.lists.length > 0 ? vault.lists : [{ id: listId, name: 'My Tasks', createdAt: Date.now(), updatedAt: Date.now(), sortOrder: 1 }],
            tasks: { [listId]: remoteData },
          };
        } else {
          // Decryption failed — push local as truth
          const encrypted = encryptForSync(vault, syncConfig.syncKey);
          const result = await cloudPush(syncConfig, encrypted, remote.version ?? 0);
          lastPushedVersion.current = result.version;
          updateSyncState({
            status: 'idle',
            lastSyncAt: Date.now(),
            lastSyncDeviceId: syncConfig.deviceId,
            version: result.version,
          });
          isSyncing.current = false;
          return;
        }

        // 3. Merge
        const merged = mergeVaults(vault, remoteVault);
        const localChanged = hasVaultChanges(vault, merged);

        if (localChanged) {
          setVault(() => merged);
        }

        // 4. Push merged result (if we had local changes)
        const remoteChanged = hasVaultChanges(remoteVault, merged);
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
        // No remote data — push local
        const encrypted = encryptForSync(vault, syncConfig.syncKey);
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
  }, [syncConfig, vault, isReady, setVault, updateSyncState]);

  // ─── Auto-sync on task changes (debounced) ─────────

  const prevVaultRef = useRef<Vault | null>(null);

  useEffect(() => {
    if (!syncConfig?.enabled || !isReady || !vault) return;

    // Skip the initial load
    if (prevVaultRef.current === null) {
      prevVaultRef.current = vault;
      return;
    }

    // Only trigger if vault actually changed
    if (prevVaultRef.current === vault) return;
    prevVaultRef.current = vault;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSync();
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [vault, syncConfig?.enabled, isReady, performSync]);

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

  const setupPassphraseSync = useCallback(async (passphrase: string) => {
    const [channelId, syncKey] = await Promise.all([
      deriveChannelId(passphrase),
      deriveSyncKey(passphrase),
    ]);
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

  const setupEmailSync = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');

    const normalized = email.toLowerCase().trim() + ':' + password;
    const [channelId, syncKey] = await Promise.all([
      deriveChannelId(normalized),
      deriveSyncKey(normalized),
    ]);
    const config: SyncConfig = {
      enabled: true,
      authMode: 'email',
      channelId,
      syncKey,
      deviceId: getDeviceId(),
    };
    setSyncConfig(config);
    return config;
  }, [setSyncConfig]);

  const disconnect = useCallback(async () => {
    setSyncConfig(null);
    localStorage.removeItem(SYNC_STATE_KEY);
    setSyncState({ status: 'disabled', lastSyncAt: null, lastSyncDeviceId: null, version: 0, error: null });
  }, [setSyncConfig]);

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
