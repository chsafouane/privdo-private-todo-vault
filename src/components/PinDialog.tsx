import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { LockKey, LockKeyOpen } from '@phosphor-icons/react'

export interface PinDialogProps {
  mode: 'export' | 'import' | null
  pinValue: string
  onPinChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

const PIN_LENGTH = 6
const MIN_PIN = 4

export function PinDialog({ mode, pinValue, onPinChange, onClose, onConfirm }: PinDialogProps) {
  const isImport = mode === 'import'
  const canSubmit = pinValue.length >= MIN_PIN

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
            {isImport ? <LockKeyOpen size={22} weight="fill" /> : <LockKey size={22} weight="fill" />}
          </div>
          <DialogTitle className="text-center text-xl font-bold tracking-tight">
            {isImport ? 'Decrypt backup' : 'Encrypt backup'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isImport
              ? 'Enter the PIN used to encrypt this backup file (4–6 digits).'
              : 'Choose a PIN (4–6 digits) to encrypt this backup. You will need it to import these tasks later.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <InputOTP
            maxLength={PIN_LENGTH}
            value={pinValue}
            onChange={(v) => onPinChange(v.replace(/[^0-9]/g, ''))}
            pattern="^[0-9]*$"
            autoFocus
            onComplete={() => { if (pinValue.length === PIN_LENGTH) onConfirm() }}
          >
            <InputOTPGroup className="gap-2">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-12 w-10 text-lg font-semibold rounded-md border-l shadow-[var(--shadow-sm)]"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canSubmit}
            className="bg-gradient-to-br from-primary to-primary-strong text-primary-foreground shadow-[var(--shadow-brand)] ring-1 ring-inset ring-white/15 hover:brightness-105 disabled:shadow-none disabled:ring-0 disabled:from-muted disabled:to-muted disabled:text-muted-foreground"
          >
            {isImport ? 'Import' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
