import { useState, useEffect, useRef, useCallback } from 'react';
import { LockKey, Keyhole, FolderOpen, FileArrowUp } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { hashPin, legacyHashPin, setEncryptionKeyFromPin, decryptDataWithPin, constantTimeEqual, clearEncryptionKey, restoreSalt, getCurrentSalt } from '@/lib/encryption';
import { isValidTaskArray } from '@/types';
import { toast } from 'sonner';

interface PinScreenProps {
  onUnlock: (pinTargetHash: string, folderPath: string | null, dbName?: string) => void;
  onLoadFile: (tasks: any[], fileName: string) => void;
}

const MAX_ATTEMPTS = 10;
const BASE_DELAY_MS = 1000;

export function PinScreen({ onUnlock, onLoadFile }: PinScreenProps) {
  const [pin, setPin] = useState('');
  const [isSetup, setIsSetup] = useState(true);
  const [storedHash, setStoredHash] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [loadFilePin, setLoadFilePin] = useState('');
  const [pendingFile, setPendingFile] = useState<{ content: any; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brute force protection state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLockedOut = lockedUntil !== null && Date.now() < lockedUntil;

  // Countdown timer for lockout display
  const [lockSeconds, setLockSeconds] = useState(0);
  useEffect(() => {
    if (!lockedUntil) { setLockSeconds(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockSeconds(remaining);
      if (remaining <= 0) setLockedUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const applyFailedAttemptPenalty = useCallback(() => {
    setFailedAttempts(prev => {
      const next = prev + 1;
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + 60_000);
        toast.error('Too many failed attempts. Locked for 60 seconds.');
      } else if (next >= 3) {
        const delay = BASE_DELAY_MS * Math.pow(2, next - 3);
        setLockedUntil(Date.now() + delay);
        toast.error(`Incorrect PIN. Wait ${Math.ceil(delay / 1000)}s before retrying.`);
      } else {
        toast.error('Incorrect PIN. Please try again.');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    async function loadConfig() {
      const elec = (window as any).electron;
      setIsElectron(!!elec);

      if (elec) {
        const config = await elec.invoke('get-config');
        // Restore the encryption salt from the config file into localStorage.
        // This ensures the salt survives even if Electron's localStorage is cleared.
        if (config.encryptionSalt) {
          restoreSalt(config.encryptionSalt);
        }
        if (config.pinHash) {
          setStoredHash(config.pinHash);
          setIsSetup(false);
        }
        if (config.storagePath) {
          setStoragePath(config.storagePath);
        }
      } else {
        // Web fallback config
        const webHash = localStorage.getItem('web-auth-hash');
        if (webHash) {
          setStoredHash(webHash);
          setIsSetup(false);
        }
      }
    }
    loadConfig();
  }, []);

  const handleSelectFolder = async () => {
    if (!isElectron) return;
    const folder = await (window as any).electron.invoke('select-directory');
    if (folder) setStoragePath(folder);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }
    if (isLockedOut) {
      toast.error(`Locked. Wait ${lockSeconds}s before retrying.`);
      return;
    }
    if (isElectron && isSetup && !storagePath) {
      toast.error('Please select a storage folder first.');
      return;
    }

    setIsSubmitting(true);
    const currentPin = pin;
    setPin(''); // Clear PIN from state immediately

    // Derive hash and encryption keys in parallel (native Web Crypto, fast)
    const [currentHash] = await Promise.all([
      hashPin(currentPin),
      setEncryptionKeyFromPin(currentPin),
    ]);

    if (isSetup) {
      if (isElectron) {
        await (window as any).electron.invoke('save-config', { pinHash: currentHash, encryptionSalt: getCurrentSalt() });
      } else {
        localStorage.setItem('web-auth-hash', currentHash);
      }
      
      toast.success('PIN created. Keys generated.');
      setIsSubmitting(false);
      onUnlock(currentHash, storagePath);
    } else {
      if (storedHash && constantTimeEqual(currentHash, storedHash)) {
        // Successful unlock — also persist salt if not yet saved
        if (isElectron) {
          await (window as any).electron.invoke('save-config', { encryptionSalt: getCurrentSalt() });
        }
        setFailedAttempts(0);
        setIsSubmitting(false);
        onUnlock(currentHash, storagePath);
      } else {
        // Try legacy SHA-256 hash for pre-migration users
        const legacyHash = legacyHashPin(currentPin);
        if (storedHash && constantTimeEqual(legacyHash, storedHash)) {
          // Migrate stored hash to PBKDF2
          if (isElectron) {
            await (window as any).electron.invoke('save-config', { pinHash: currentHash, encryptionSalt: getCurrentSalt() });
          } else {
            localStorage.setItem('web-auth-hash', currentHash);
          }
          setFailedAttempts(0);
          setIsSubmitting(false);
          onUnlock(currentHash, storagePath);
        } else {
          clearEncryptionKey();
          applyFailedAttemptPenalty();
          setIsSubmitting(false);
        }
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name.replace(/\.(json|enc)$/i, '');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        if (content && content.encryptedData) {
          setPendingFile({ content, name: fileName });
          setLoadFilePin('');
        } else if (isValidTaskArray(content)) {
          onLoadFile(content, fileName);
        } else {
          toast.error('Invalid task file format');
        }
      } catch {
        toast.error('Failed to parse file');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleLoadFileDecrypt = async () => {
    if (!pendingFile || loadFilePin.length < 4) return;
    if (isLockedOut) {
      toast.error(`Locked. Wait ${lockSeconds}s before retrying.`);
      return;
    }
    const currentFilePin = loadFilePin;
    setLoadFilePin(''); // Clear file PIN from state immediately
    const decrypted = await decryptDataWithPin(pendingFile.content.encryptedData, currentFilePin);
    if (isValidTaskArray(decrypted)) {
      onLoadFile(decrypted, pendingFile.name);
      setPendingFile(null);
      setFailedAttempts(0);
    } else {
      toast.error('Decryption failed. Wrong PIN or corrupted file.');
      applyFailedAttemptPenalty();
    }
  };

  const storageLocationLabel = isElectron
    ? (storagePath || 'Not configured')
    : 'Browser local storage (IndexedDB)';

  return (
    <div className="flex w-full min-h-screen items-center justify-center p-6 sm:p-12 md:p-24 bg-background">
      <div className="max-w-md w-full space-y-8 bg-card border border-border/40 p-8 rounded-2xl shadow-xl">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <LockKey className="w-6 h-6 text-primary" weight="duotone" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isSetup ? 'Setup Privdo' : 'Unlock Privdo'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isSetup ? 'Create a secure PIN. This encrypts all your data entirely on your device. Do not forget it!' : 'Enter your PIN to decrypt your local tasks.'}
          </p>
        </div>

        {!isSetup && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-mono truncate" title={storageLocationLabel}>
              {storageLocationLabel}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter Numeric PIN..."
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="text-center text-2xl tracking-[0.5em] placeholder:tracking-normal font-mono h-14"
              autoFocus
            />
            {isSetup && pin.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        pin.length >= i * 2
                          ? pin.length >= 6
                            ? 'bg-green-500'
                            : pin.length >= 4
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {pin.length < 4 ? 'Too short (min 4)' : pin.length < 6 ? 'Okay — 6+ digits recommended' : 'Strong PIN'}
                </p>
              </div>
            )}
          </div>

          {isElectron && isSetup && (
            <div className="space-y-2 pt-4 border-t border-border/50">
              <label className="text-sm font-medium block">Data Storage Location</label>
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={storagePath || 'No folder selected'} 
                  className="bg-muted text-muted-foreground font-mono text-xs overflow-ellipsis" 
                />
                <Button type="button" variant="secondary" onClick={handleSelectFolder}>
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full h-12 text-md" disabled={isLockedOut || isSubmitting}>
            <Keyhole className="w-5 h-5 mr-2" />
            {isLockedOut ? `Locked (${lockSeconds}s)` : isSetup ? 'Secure & Continue' : 'Decrypt Vault'}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          {pendingFile ? (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Decrypt <span className="font-medium text-foreground">{pendingFile.name}</span>
              </p>
              <Input
                type="password"
                placeholder="File PIN..."
                inputMode="numeric"
                pattern="[0-9]*"
                value={loadFilePin}
                onChange={(e) => setLoadFilePin(e.target.value.replace(/[^0-9]/g, ''))}
                className="text-center text-xl tracking-[0.5em] placeholder:tracking-normal font-mono h-12"
                onKeyDown={(e) => { if (e.key === 'Enter') handleLoadFileDecrypt(); }}
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => { setPendingFile(null); setLoadFilePin(''); }}>
                  Cancel
                </Button>
                <Button type="button" className="flex-1" onClick={handleLoadFileDecrypt} disabled={loadFilePin.length < 4 || isLockedOut}>
                  {isLockedOut ? `Locked (${lockSeconds}s)` : 'Decrypt & Load'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.enc"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileArrowUp className="w-5 h-5" />
                Load a vault file
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
