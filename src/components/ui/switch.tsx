import { cn } from '@/lib/utils'

/** On/off toggle (WAI-ARIA switch). */
export function Switch({
  checked,
  onChange,
  label,
  id,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  id?: string
  className?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        checked ? 'bg-primary' : 'bg-input-hover',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-[inset-inline-start] duration-base',
          checked ? 'start-[1.375rem]' : 'start-0.5',
        )}
      />
    </button>
  )
}
