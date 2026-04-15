import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { generatePassphrase, validatePassphrase } from '@/lib/syncEncryption';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

interface SyncSetupProps {
  open: boolean;
  onClose: () => void;
  onPassphraseSetup: (passphrase: string) => void;
  onEmailSetup: (email: string, password: string) => Promise<void>;
}

export function SyncSetup({ open, onClose, onPassphraseSetup, onEmailSetup }: SyncSetupProps) {
  const [step, setStep] = useState<'choose' | 'passphrase-new' | 'passphrase-join' | 'email'>('choose');
  const [generatedPassphrase, setGeneratedPassphrase] = useState('');
  const [inputPassphrase, setInputPassphrase] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setStep('choose');
    setGeneratedPassphrase('');
    setInputPassphrase('');
    setEmail('');
    setPassword('');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGenerate = () => {
    setGeneratedPassphrase(generatePassphrase());
    setStep('passphrase-new');
  };

  const handlePassphraseConfirm = () => {
    if (generatedPassphrase) {
      onPassphraseSetup(generatedPassphrase);
      handleClose();
    }
  };

  const handlePassphraseJoin = () => {
    const trimmed = inputPassphrase.trim();
    if (validatePassphrase(trimmed)) {
      onPassphraseSetup(trimmed);
      handleClose();
    } else {
      setError('Invalid passphrase. Must be at least 6 BIP39 words.');
    }
  };

  const handleEmailSubmit = async () => {
    if (!email || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onEmailSetup(email, password);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        {step === 'choose' && (
          <>
            <DialogHeader>
              <DialogTitle>Set Up Sync</DialogTitle>
              <DialogDescription>
                Sync your tasks across devices. All data is end-to-end encrypted — the server never sees your tasks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Button variant="outline" className="w-full justify-start h-auto py-3 px-4" onClick={handleGenerate}>
                <div className="text-left whitespace-normal min-w-0">
                  <div className="font-medium">🔑 Passphrase — New Device</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Generate a passphrase to start syncing. No email needed.</div>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start h-auto py-3 px-4" onClick={() => setStep('passphrase-join')}>
                <div className="text-left whitespace-normal min-w-0">
                  <div className="font-medium">🔑 Passphrase — Join Existing</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Enter a passphrase from another device.</div>
                </div>
              </Button>
              {isSupabaseConfigured() && (
                <Button variant="outline" className="w-full justify-start h-auto py-3 px-4" onClick={() => setStep('email')}>
                  <div className="text-left whitespace-normal min-w-0">
                    <div className="font-medium">📧 Email Account</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Sign in or create an account. Easier to manage.</div>
                  </div>
                </Button>
              )}
            </div>
          </>
        )}

        {step === 'passphrase-new' && (
          <>
            <DialogHeader>
              <DialogTitle>Your Sync Passphrase</DialogTitle>
              <DialogDescription>
                Write this down or copy it. You'll need it to connect other devices.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-muted rounded-lg p-4 font-mono text-sm leading-relaxed select-all break-words">
                {generatedPassphrase}
              </div>
              <p className="text-xs text-destructive mt-3">
                ⚠️ If you lose this passphrase, your cloud data cannot be recovered.
              </p>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('choose')}>Back</Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassphrase);
                  setTimeout(() => {
                    navigator.clipboard.writeText('').catch(() => {});
                  }, 30_000);
                }}
              >
                Copy
              </Button>
              <Button onClick={handlePassphraseConfirm}>I've Saved It</Button>
            </DialogFooter>
          </>
        )}

        {step === 'passphrase-join' && (
          <>
            <DialogHeader>
              <DialogTitle>Enter Sync Passphrase</DialogTitle>
              <DialogDescription>
                Enter the passphrase from your other device.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <textarea
                className="w-full min-h-[80px] rounded-lg border border-input bg-background p-3 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={inputPassphrase}
                onChange={e => { setInputPassphrase(e.target.value); setError(''); }}
                placeholder="Enter your passphrase words..."
                autoComplete="off"
                data-1p-ignore
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => { setStep('choose'); setError(''); }}>Back</Button>
              <Button onClick={handlePassphraseJoin} disabled={!inputPassphrase.trim()}>Connect</Button>
            </DialogFooter>
          </>
        )}

        {step === 'email' && (
          <>
            <DialogHeader>
              <DialogTitle>Email Account</DialogTitle>
              <DialogDescription>
                Enter your email and a password to sync. Your data is encrypted using your credentials — the server never sees your tasks.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="email-field">Email</Label>
                <Input id="email-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <Label htmlFor="pass-field">Password</Label>
                <Input id="pass-field" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
                <p className="text-xs text-muted-foreground mt-1">
                  Use the same email and password on all devices to sync.
                </p>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => { setStep('choose'); setError(''); }}>Back</Button>
              <Button onClick={handleEmailSubmit} disabled={loading}>
                {loading ? 'Connecting...' : 'Connect'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
