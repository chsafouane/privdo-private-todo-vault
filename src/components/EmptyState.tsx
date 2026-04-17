import { ReactNode } from 'react'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
}: EmptyStateProps) {
  const py = size === 'sm' ? 'py-10' : size === 'lg' ? 'py-20' : 'py-16'
  const titleClass =
    size === 'lg'
      ? 'text-lg font-semibold tracking-tight'
      : 'text-base font-semibold'

  return (
    <div className={`text-center ${py} px-4 ${className}`}>
      {icon && (
        <div className="mx-auto mb-5 flex items-center justify-center">
          {icon}
        </div>
      )}
      <p className={`text-foreground ${titleClass}`}>{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
