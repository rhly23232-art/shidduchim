import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Visual box only — for use inside an element that already carries the checked state. */
export function CheckboxIndicator({
  checked,
  className,
}: {
  checked: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-sm border transition-colors duration-fast',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input-hover bg-card',
        className,
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </span>
  )
}

/** Accessible checkbox (WAI-ARIA). With `children`, renders as a labelled row. */
export function Checkbox({
  checked,
  onChange,
  label,
  children,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  children?: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={children ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex items-center gap-2 rounded-sm text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        children ? 'min-h-6' : 'size-5 justify-center',
        className,
      )}
    >
      <CheckboxIndicator checked={checked} className={children ? undefined : 'size-5'} />
      {children}
    </button>
  )
}
