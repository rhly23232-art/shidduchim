import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { useReturnFocus } from '@/hooks/useReturnFocus'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'
import { DialogOverlay } from './dialog'

export const Sheet = DialogPrimitive.Root
export const SheetTitle = DialogPrimitive.Title
export const SheetDescription = DialogPrimitive.Description

interface SheetContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: 'end' | 'start' | 'bottom'
}

/** Side panel. In RTL, "end" is the left edge. */
export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = 'end', onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const focus = useReturnFocus(onOpenAutoFocus, onCloseAutoFocus)
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        {...focus}
        className={cn(
          'fixed z-50 flex flex-col bg-card shadow-lg outline-none data-[state=closed]:duration-fast data-[state=open]:duration-slow data-[state=open]:ease-out data-[state=open]:animate-in data-[state=closed]:animate-out',
          side === 'end' &&
            'inset-y-0 end-0 h-[100dvh] w-full max-w-[760px] border-e border-border data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-left-8 data-[state=open]:slide-in-from-left-8',
          side === 'start' &&
            'inset-y-0 start-0 h-[100dvh] w-[86vw] max-w-[320px] border-s border-border data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-8 data-[state=open]:slide-in-from-right-8',
          side === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-lg border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute end-4 top-4 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={he.common.close}
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
SheetContent.displayName = 'SheetContent'
