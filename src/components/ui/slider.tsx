import * as SliderPrimitive from '@radix-ui/react-slider'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

export const RangeSlider = forwardRef<
  ElementRef<typeof SliderPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabels: [string, string] }
>(({ className, thumbLabels, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    dir="rtl"
    className={cn('relative flex w-full touch-none select-none items-center py-2', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary-hover">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    {thumbLabels.map((label) => (
      <SliderPrimitive.Thumb
        key={label}
        aria-label={label}
        className="block size-5 cursor-grab rounded-full border-2 border-primary bg-card shadow-sm transition-[box-shadow,transform] duration-fast hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 active:cursor-grabbing"
      />
    ))}
  </SliderPrimitive.Root>
))
RangeSlider.displayName = 'RangeSlider'
