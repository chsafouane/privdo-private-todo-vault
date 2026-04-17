import { LockKey } from '@phosphor-icons/react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showWordmark?: boolean
  className?: string
}

const SIZES = {
  sm: { tile: 'h-7 w-7 rounded-[8px]', icon: 14, word: 'text-sm' },
  md: { tile: 'h-9 w-9 rounded-[10px]', icon: 18, word: 'text-base' },
  lg: { tile: 'h-12 w-12 rounded-[12px]', icon: 24, word: 'text-xl' },
  xl: { tile: 'h-16 w-16 rounded-[16px]', icon: 32, word: 'text-2xl' },
} as const

export function Logo({ size = 'md', showWordmark = false, className = '' }: LogoProps) {
  const s = SIZES[size]
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${s.tile} flex items-center justify-center bg-gradient-to-br from-primary to-primary-strong text-primary-foreground shadow-[var(--shadow-brand)] ring-1 ring-inset ring-white/15 flex-shrink-0`}
        aria-hidden="true"
      >
        <LockKey size={s.icon} weight="fill" />
      </div>
      {showWordmark && (
        <span className={`${s.word} font-bold tracking-tight text-foreground`}>Privdo</span>
      )}
    </div>
  )
}
