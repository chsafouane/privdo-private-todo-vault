import { useState, ReactNode } from 'react';
import { CheckCircle, CircleNotch, WarningCircle, CloudSlash, Prohibit } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SyncConfig } from '@/hooks/useSyncEngine';
import type { SyncStatus } from '@/hooks/useSyncEngine';

interface SyncSettingsProps {
  open: boolean;
  onClose: () => void;
  syncConfig: SyncConfig | null;
  syncStatus: SyncStatus;
  lastSyncAt: number | null;
  error: string | null;
  onSync: () => void;
  onDisconnect: () => void;
  onSetup: () => void;
}

export function SyncSettings({
  open,
  onClose,
  syncConfig,
  syncStatus,
  lastSyncAt,
  error,
  onSync,
  onDisconnect,
  onSetup,
}: SyncSettingsProps) {
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const formatTime = (ts: number | null) => {
    if (!ts) return 'Never';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const statusDisplay: Record<SyncStatus, { icon: ReactNode; label: string; className: string }> = {
    idle: { icon: <CheckCircle size={14} weight="fill" />, label: 'Synced', className: 'text-accent' },
    syncing: { icon: <CircleNotch size={14} weight="bold" className="animate-spin" />, label: 'Syncing…', className: 'text-primary' },
    error: { icon: <WarningCircle size={14} weight="fill" />, label: 'Error', className: 'text-destructive' },
    offline: { icon: <CloudSlash size={14} weight="fill" />, label: 'Offline', className: 'text-muted-foreground' },
    disabled: { icon: <Prohibit size={14} weight="bold" />, label: 'Disabled', className: 'text-muted-foreground' },
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setConfirmDisconnect(false); setShowPassphrase(false); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync Settings</DialogTitle>
          <DialogDescription>
            {syncConfig?.enabled
              ? `${syncConfig.authMode === 'email' ? 'Email' : 'Passphrase'} sync is active.`
              : 'Sync is not configured.'}
          </DialogDescription>
        </DialogHeader>

        {syncConfig?.enabled ? (
          <div className="py-4 space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <span className={`inline-flex items-center gap-1.5 font-medium ${statusDisplay[syncStatus].className}`}>
                  {statusDisplay[syncStatus].icon}
                  {statusDisplay[syncStatus].label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last sync</span>
                <span>{formatTime(lastSyncAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span className="capitalize">{syncConfig.authMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device</span>
                <span className="font-mono text-xs">{syncConfig.deviceId.slice(0, 8)}...</span>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-xs rounded-md p-2">
                {error}
              </div>
            )}

            {syncConfig.passphrase && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                >
                  {showPassphrase ? 'Hide Passphrase' : 'Show Passphrase'}
                </Button>
                {showPassphrase && (
                  <div className="mt-2 bg-muted rounded-lg p-3 font-mono text-xs leading-relaxed select-all break-words">
                    {syncConfig.passphrase}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Button className="w-full" onClick={onSync} disabled={syncStatus === 'syncing'}>
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </Button>

              {!confirmDisconnect ? (
                <Button variant="destructive" className="w-full" onClick={() => setConfirmDisconnect(true)}>
                  Disconnect
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-destructive text-center">Are you sure? This will stop syncing on this device.</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setConfirmDisconnect(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => { onDisconnect(); onClose(); }}>
                      Disconnect
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Set up sync to keep your tasks in sync across all your devices.
            </p>
            <Button className="w-full" onClick={() => { onClose(); onSetup(); }}>
              Set Up Sync
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
