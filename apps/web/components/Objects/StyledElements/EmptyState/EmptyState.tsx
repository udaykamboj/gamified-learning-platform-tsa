import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared empty / no-results / error state: one icon, a plain-language heading,
 * a short explanation and an optional next action.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  tone?: 'neutral' | 'error'
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('sl-card flex flex-col items-center px-6 py-12 text-center md:py-16', className)}
    >
      {icon && (
        <span
          className={cn(
            'grid size-12 place-items-center rounded-full [&_svg]:size-6',
            tone === 'error' ? 'bg-error-surface text-error' : 'bg-muted text-muted-foreground'
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <h2 className="mt-4 text-card-title font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 max-w-md text-ui text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
