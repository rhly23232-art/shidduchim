import { initials, TINTS, tintFor, type TintName } from '@/lib/palette'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: 'size-7 text-caption',
  md: 'size-9 text-body-sm',
  lg: 'size-12 text-body-lg',
} as const

/** Initials on a soft tint. Decorative: the name is always shown next to it. */
export function Avatar({
  name,
  colorKey,
  tint,
  size = 'md',
  className,
}: {
  name: string
  /** Stable key (e.g. candidate id) that picks the color. */
  colorKey?: string
  tint?: TintName
  size?: keyof typeof SIZES
  className?: string
}) {
  const t = TINTS[tint ?? tintFor(colorKey ?? name)]
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 select-none place-items-center rounded-full font-semibold',
        t.bg,
        t.fg,
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
