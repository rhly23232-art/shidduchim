import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Indeterminate loading indicator. Pair with visible or sr-only text. */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <Loader2 className={cn('size-4 animate-spin text-muted-foreground', className)} aria-hidden />
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
