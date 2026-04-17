import { ReactNode } from 'react'
import type { Icon } from '@phosphor-icons/react'

export interface SectionHeaderProps {
  icon?: Icon
  title: string
  count?: number
  action?: ReactNode
  onClick?: () => void
  className?: string
}

export function SectionHeader({ icon: IconEl, title, count, action, onClick, className = '' }: SectionHeaderProps) {
  const labelContent = (
    <>
      {IconEl && <IconEl size={12} weight="bold" />}
      <span>{title}</span>
      {typeof count === 'number' && (
        <span className="text-muted-foreground/60 font-medium normal-case tracking-normal">
          · {count}
        </span>
      )}
    </>
  )

  return (
    <div className={`flex items-center justify-between px-3 mb-2 ${className}`}>
      {onClick ? (
        <button
          onClick={onClick}
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {labelContent}
        </button>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {labelContent}
        </div>
      )}
      {action}
    </div>
  )
}
