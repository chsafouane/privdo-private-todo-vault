import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { activate, clearLicense, getLicenseInfo, isPro } from '@/lib/license'
import { Crown, Key, SignOut, CloudCheck, ArrowSquareOut } from '@phosphor-icons/react'

const CHECKOUT_URL_MONTHLY = import.meta.env.VITE_CHECKOUT_MONTHLY || '#'
const CHECKOUT_URL_YEARLY = import.meta.env.VITE_CHECKOUT_YEARLY || '#'

interface LicenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange: () => void
}

export function LicenseDialog({ open, onOpenChange, onStatusChange }: LicenseDialogProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const info = getLicenseInfo()
  const pro = isPro()

  const handleActivate = async () => {
    const trimmed = licenseKey.trim()
    if (!trimmed) return

    setLoading(true)
    const result = await activate(trimmed)
    setLoading(false)

    if (result.success) {
      toast.success('License activated! Cloud sync is now available.')
      setLicenseKey('')
      onStatusChange()
      onOpenChange(false)
    } else {
      toast.error(result.error || 'Activation failed')
    }
  }

  const handleDeactivate = () => {
    clearLicense()
    toast('License deactivated')
    onStatusChange()
    onOpenChange(false)
  }

  const formatKey = (value: string) => {
    const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 20)
    return clean.match(/.{1,5}/g)?.join('-') || clean
  }

  if (pro) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown size={20} weight="fill" className="text-yellow-500" />
              Pro License Active
            </DialogTitle>
            <DialogDescription>
              Cloud sync is enabled. Your encrypted tasks sync across all your devices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">License</span>
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                {info.licenseKey ? `${info.licenseKey.slice(0, 5)}...${info.licenseKey.slice(-5)}` : '—'}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last sync</span>
              <span className="text-sm">
                {info.lastSync ? new Date(info.lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="destructive" size="sm" onClick={handleDeactivate} className="gap-1.5">
              <SignOut size={16} />
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudCheck size={20} className="text-primary" />
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription>
            Sync your encrypted tasks across all your devices with cloud backup.
          </DialogDescription>
        </DialogHeader>

        {/* Pricing cards */}
        <div className="grid grid-cols-2 gap-3 py-4">
          <a
            href={CHECKOUT_URL_MONTHLY}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-colors text-center group"
          >
            <p className="text-2xl font-bold text-foreground">$2.50</p>
            <p className="text-xs text-muted-foreground">per month</p>
            <div className="mt-2 flex items-center justify-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowSquareOut size={12} />
              Checkout
            </div>
          </a>
          <a
            href={CHECKOUT_URL_YEARLY}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-lg border-2 border-primary/30 hover:border-primary transition-colors text-center relative group"
          >
            <Badge className="absolute -top-2 right-2 text-[10px]">Save 67%</Badge>
            <p className="text-2xl font-bold text-foreground">$10</p>
            <p className="text-xs text-muted-foreground">per year</p>
            <div className="mt-2 flex items-center justify-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowSquareOut size={12} />
              Checkout
            </div>
          </a>
        </div>

        {/* License key input */}
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Key size={14} />
            Already have a license key?
          </p>
          <div className="flex gap-2">
            <Input
              value={licenseKey}
              onChange={(e) => setLicenseKey(formatKey(e.target.value))}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              className="font-mono text-sm tracking-wider"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleActivate()
              }}
            />
            <Button onClick={handleActivate} disabled={licenseKey.length < 23 || loading}>
              {loading ? '...' : 'Activate'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
