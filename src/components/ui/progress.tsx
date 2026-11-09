import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

export function Progress({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      aria-label={label}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-navy-100', className)}
    >
      <ProgressPrimitive.Indicator
        className="h-full bg-gold-500 transition-[width] duration-200 ease-out"
        style={{ width: `${value}%`, marginInlineStart: 0 }}
      />
    </ProgressPrimitive.Root>
  )
}
