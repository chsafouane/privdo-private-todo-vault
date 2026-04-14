import { useState, useEffect } from 'react';
import { LockKey, Keyhole, FolderOpen } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hashPin, setEncryptionKeyFromPin } from '@/lib/encryption';
import { toast } from 'sonner';

interface PinScreenProps {
  onUnlock: (pinTargetHash: string, folderPath: string | null) => void;
}

export function PinScreen({ onUnlock }: PinScreenProps) {
  const [pin, setPin] = useState('');
  const [isSetup, setIsSetup] = useState(true);
  const [storedHash, setStoredHash] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const elec = (window as any).electron;
      setIsElectron(!!elec);

      if (elec) {
        const config = await elec.invoke('get-config');
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
    if (isElectron && isSetup && !storagePath) {
      toast.error('Please select a storage folder first.');
      return;
    }

    const currentHash = hashPin(pin);

    if (isSetup) {
      // Set new PIN
      setEncryptionKeyFromPin(pin);
      
      if (isElectron) {
        await (window as any).electron.invoke('save-config', { pinHash: currentHash, storagePath });
      } else {
        localStorage.setItem('web-auth-hash', currentHash);
      }
      
      toast.success('PIN created. Keys generated.');
      onUnlock(currentHash, storagePath);
    } else {
      // Verify existing PIN
      if (currentHash === storedHash) {
        setEncryptionKeyFromPin(pin);
        onUnlock(currentHash, storagePath);
      } else {
        toast.error('Incorrect PIN.');
        setPin('');
      }
    }
  };

  return (
    <div className="flex w-full min-h-screen items-center justify-center p-6 sm:p-12 md:p-24 bg-background">
      <div className="max-w-md w-full space-y-8 bg-card border border-border/40 p-8 rounded-2xl shadow-xl">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <LockKey className="w-6 h-6 text-primary" weight="duotone" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isSetup ? 'Setup Local Todo' : 'Unlock Todos'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isSetup ? 'Create a secure PIN. This encrypts all your data entirely on your device. Do not forget it!' : 'Enter your PIN to decrypt your local tasks.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter Numeric PIN..."
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
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

          <Button type="submit" className="w-full h-12 text-md">
            <Keyhole className="w-5 h-5 mr-2" />
            {isSetup ? 'Secure & Continue' : 'Decrypt Tasks'}
          </Button>
        </form>
      </div>
    </div>
  );
}
