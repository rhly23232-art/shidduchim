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
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-navy-100">
      <SliderPrimitive.Range className="absolute h-full bg-navy-900" />
    </SliderPrimitive.Track>
    {thumbLabels.map((label) => (
      <SliderPrimitive.Thumb
        key={label}
        aria-label={label}
        className="block size-5 cursor-grab rounded-full border-2 border-navy-900 bg-surface shadow-card transition-[box-shadow,transform] duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/45 active:cursor-grabbing"
      />
    ))}
  </SliderPrimitive.Root>
))
RangeSlider.displayName = 'RangeSlider'
