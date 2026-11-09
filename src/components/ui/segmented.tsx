import { useRef, type KeyboardEvent } from 'react'
import { TINTS, type TintName } from '@/lib/palette'
import { cn } from '@/lib/utils'

export interface SegmentedItem<T extends string> {
  value: T
  label: string
  id?: string
  /** For role="tab": id of the panel this tab controls. */
  controls?: string
  /** Identity color shown when selected (dot + text). */
  tint?: TintName
}

/**
 * Segmented control. `role="tablist"` for view switching (WAI-ARIA tabs),
 * `role="radiogroup"` for picking a value in a form. Roving tabindex, RTL-aware arrows.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  role = 'tablist',
  size = 'md',
  className,
}: {
  items: SegmentedItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  role?: 'tablist' | 'radiogroup'
  size?: 'sm' | 'md'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent) => {
    const idx = items.findIndex((i) => i.value === value)
    let next: number | null = null
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'
    if (e.key === fwd || e.key === 'ArrowDown') next = (idx + 1) % items.length
    else if (e.key === back || e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    if (next === null) return
    e.preventDefault()
    onChange(items[next]!.value)
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('[data-seg]')
    requestAnimationFrame(() => buttons?.[next!]?.focus())
  }
  const itemRole = role === 'tablist' ? 'tab' : 'radio'
  return (
    <div
      ref={ref}
      role={role}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('inline-flex gap-1 rounded-md bg-secondary p-1', className)}
    >
      {items.map((item) => {
        const on = item.value === value
        return (
          <button
            key={item.value}
            id={item.id}
            data-seg
            type="button"
            role={itemRole}
            aria-selected={role === 'tablist' ? on : undefined}
            aria-checked={role === 'radiogroup' ? on : undefined}
            aria-controls={item.controls}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm font-medium transition-[background-color,color,box-shadow] duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'h-7 px-3 text-body-sm' : 'h-8 px-4 text-body',
              on
                ? cn('bg-card shadow-sm', item.tint ? TINTS[item.tint].fg : 'text-foreground')
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.tint && (
              <span
                className={cn(
                  'me-2 size-2 rounded-full transition-opacity duration-fast',
                  TINTS[item.tint].strong,
                  !on && 'opacity-50',
                )}
                aria-hidden
              />
            )}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
