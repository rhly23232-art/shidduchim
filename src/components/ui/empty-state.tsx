import type { ReactNode } from 'react'
import { TINTS, type TintName } from '@/lib/palette'
import { cn } from '@/lib/utils'

/** Explains why an area is empty and what to do next (one clear action). */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
  headingLevel = 2,
  tint,
}: {
  /** Identity color of the area the empty state belongs to. */
  tint?: TintName
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'destructive'
  className?: string
  headingLevel?: 2 | 3
}) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div
      role={tone === 'destructive' ? 'alert' : undefined}
      className={cn('flex flex-col items-center px-6 py-16 text-center', className)}
    >
      {icon && (
        <span
          className={cn(
            'grid size-12 place-items-center rounded-full [&_svg]:size-6',
            tone === 'destructive'
              ? 'bg-destructive-soft text-destructive'
              : tint
                ? cn(TINTS[tint].bg, TINTS[tint].fg)
                : 'bg-secondary text-muted-foreground',
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <H className="mt-4 text-h3 text-foreground">{title}</H>
      {description && (
        <p className="mt-1 max-w-md text-body text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
