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
      className={cn(
        'relative h-1.5 w-full overflow-hidden rounded-full bg-secondary-hover',
        className,
      )}
    >
      <ProgressPrimitive.Indicator
        className="h-full bg-primary transition-[width] duration-base ease-out"
        style={{ width: `${value}%`, marginInlineStart: 0 }}
      />
    </ProgressPrimitive.Root>
  )
}
