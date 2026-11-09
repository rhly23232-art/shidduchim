import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn('size-9', className)}>
      <rect width="40" height="40" rx="10" className="fill-navy-900" />
      <circle cx="16.5" cy="20" r="7.5" fill="none" strokeWidth="2.6" className="stroke-gold-500" />
      <circle
        cx="23.5"
        cy="20"
        r="7.5"
        fill="none"
        strokeWidth="2.6"
        className="stroke-cream-100"
      />
    </svg>
  )
}

export function Logo({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-none">
        <p className="font-heading text-[22px] font-bold text-navy-900">{he.app.name}</p>
        {subtitle && <p className="mt-1 text-[11.5px] text-ink-muted">{he.app.tagline}</p>}
      </div>
    </div>
  )
}
