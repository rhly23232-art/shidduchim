import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/** Removable token — e.g. an applied filter. */
export const Chip = forwardRef<
  HTMLSpanElement,
  { label: string; removeLabel: string; onRemove: () => void; className?: string }
>(({ label, removeLabel, onRemove, className }, ref) => (
  <span
    ref={ref}
    className={cn(
      'inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card pe-1 ps-3 text-body-sm text-foreground',
      className,
    )}
  >
    <span className="max-w-64 truncate">{label}</span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={removeLabel}
      className="grid size-5 place-items-center rounded-full text-muted-foreground transition-colors duration-fast hover:bg-secondary-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="size-3" strokeWidth={2.5} />
    </button>
  </span>
))
Chip.displayName = 'Chip'
