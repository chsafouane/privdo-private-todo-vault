import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  onEmailSetup: (email: string, password: string, passphrase: string, isSignUp: boolean) => Promise<void>;
}

export function SyncSetup({ open, onClose, onPassphraseSetup, onEmailSetup }: SyncSetupProps) {
  const [step, setStep] = useState<'choose' | 'passphrase-new' | 'passphrase-join' | 'email'>('choose');
  const [generatedPassphrase, setGeneratedPassphrase] = useState('');
  const [inputPassphrase, setInputPassphrase] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailPassphrase, setEmailPassphrase] = useState('');
  const [emailTab, setEmailTab] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setStep('choose');
    setGeneratedPassphrase('');
    setInputPassphrase('');
    setEmail('');
    setPassword('');
    setEmailPassphrase('');
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
    if (!email || !password || !emailPassphrase.trim()) {
      setError('All fields are required.');
      return;
    }
    if (emailPassphrase.trim().split(/\s+/).length < 6) {
      setError('Encryption passphrase must be at least 6 words.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onEmailSetup(email, password, emailPassphrase.trim(), emailTab === 'signup');
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
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
                <div className="text-left">
                  <div className="font-medium">🔑 Passphrase — New Device</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Generate a passphrase to start syncing. No email needed.</div>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start h-auto py-3 px-4" onClick={() => setStep('passphrase-join')}>
                <div className="text-left">
                  <div className="font-medium">🔑 Passphrase — Join Existing</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Enter a passphrase from another device.</div>
                </div>
              </Button>
              {isSupabaseConfigured() && (
                <Button variant="outline" className="w-full justify-start h-auto py-3 px-4" onClick={() => setStep('email')}>
                  <div className="text-left">
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
                onClick={() => navigator.clipboard.writeText(generatedPassphrase)}
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
                Sign in or create an account, then set an encryption passphrase.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <Tabs value={emailTab} onValueChange={v => setEmailTab(v as 'signin' | 'signup')}>
                <TabsList className="w-full">
                  <TabsTrigger value="signin" className="flex-1">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin" className="space-y-3 mt-3">
                  <div>
                    <Label htmlFor="email-in">Email</Label>
                    <Input id="email-in" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div>
                    <Label htmlFor="pass-in">Password</Label>
                    <Input id="pass-in" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                </TabsContent>
                <TabsContent value="signup" className="space-y-3 mt-3">
                  <div>
                    <Label htmlFor="email-up">Email</Label>
                    <Input id="email-up" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div>
                    <Label htmlFor="pass-up">Password</Label>
                    <Input id="pass-up" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
                  </div>
                </TabsContent>
              </Tabs>
              <div>
                <Label htmlFor="sync-phrase">Encryption Passphrase</Label>
                <textarea
                  id="sync-phrase"
                  className="w-full min-h-[60px] rounded-lg border border-input bg-background p-3 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring mt-1"
                  value={emailPassphrase}
                  onChange={e => setEmailPassphrase(e.target.value)}
                  placeholder="Enter or paste your encryption passphrase..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This encrypts your data. Use the same passphrase on all devices.
                </p>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => { setStep('choose'); setError(''); }}>Back</Button>
              <Button onClick={handleEmailSubmit} disabled={loading}>
                {loading ? 'Connecting...' : emailTab === 'signup' ? 'Sign Up & Connect' : 'Sign In & Connect'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
