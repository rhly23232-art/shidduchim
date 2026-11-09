import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Look of every filter button in a filter bar (age, location, institution, community).
 * Active = a filter is applied: tinted, with a brand border — never a heavy fill.
 */
export function filterTriggerClass(active: boolean, className?: string) {
  return cn(
    'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-body-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    active
      ? 'border-brand/50 bg-accent text-accent-foreground hover:border-brand'
      : 'border-input bg-card text-foreground hover:border-input-hover hover:bg-secondary',
    className,
  )
}

export function FilterChevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      className={cn('size-4 opacity-70 transition-transform duration-fast', open && 'rotate-180')}
      aria-hidden
    />
  )
}

/** Small count shown inside an active filter trigger. */
export function FilterCount({ value }: { value: number }) {
  return (
    <span className="tabular grid min-w-5 place-items-center rounded-full bg-primary px-1 text-caption font-semibold leading-5 text-primary-foreground">
      {value}
    </span>
  )
}
