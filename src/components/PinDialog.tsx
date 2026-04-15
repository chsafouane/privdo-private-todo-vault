import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface PinDialogProps {
  mode: 'export' | 'import' | null
  pinValue: string
  onPinChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function PinDialog({ mode, pinValue, onPinChange, onClose, onConfirm }: PinDialogProps) {
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'import' ? 'Decrypt Backup' : 'Encrypt Backup'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'import'
              ? 'Enter the PIN used to encrypt this backup file.'
              : 'Enter a PIN to encrypt this backup. You will need it to import these tasks later.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pinValue}
            onChange={(e) => onPinChange(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Enter PIN..."
            className="text-center text-xl tracking-[0.5em] placeholder:tracking-normal font-mono h-12"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm()
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pinValue.length < 4}
          >
            {mode === 'import' ? 'Import' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
