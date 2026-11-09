import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

/**
 * Grid of option buttons acting as a radio group (WAI-ARIA radiogroup, roving tabindex,
 * RTL-aware arrows). `allowDeselect` lets a second click clear the value (optional fields).
 */
export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  allowDeselect,
  size = 'md',
  className,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T | null) => void
  label: string
  allowDeselect?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const focusIdx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const onKeyDown = (e: KeyboardEvent) => {
    const idx = options.findIndex((o) => o.value === value)
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
    let next: number | null = null
    if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight') || e.key === 'ArrowDown')
      next = (idx + 1) % options.length
    else if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft') || e.key === 'ArrowUp')
      next = (idx - 1 + options.length) % options.length
    if (next === null) return
    e.preventDefault()
    onChange(options[next]!.value)
    ref.current?.querySelectorAll<HTMLButtonElement>('[role=radio]')[next]?.focus()
  }
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('grid gap-2', className)}
    >
      {options.map((o, i) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === focusIdx ? 0 : -1}
            onClick={() => onChange(on && allowDeselect ? null : o.value)}
            className={cn(
              'rounded-md border px-3 font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'h-9 text-body-sm' : 'h-10 text-body',
              on
                ? 'border-brand bg-accent text-accent-foreground'
                : 'border-input bg-card text-foreground hover:border-input-hover hover:bg-secondary',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
