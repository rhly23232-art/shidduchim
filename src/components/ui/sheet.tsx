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
  side?: 'end' | 'bottom'
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
          'data-[state=open]:duration-250 fixed z-50 flex flex-col bg-surface shadow-pop outline-none data-[state=closed]:duration-200 data-[state=open]:ease-out data-[state=open]:animate-in data-[state=closed]:animate-out',
          side === 'end' &&
            'inset-y-0 left-0 h-[100dvh] w-full max-w-[760px] border-e border-line data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-left-8 data-[state=open]:slide-in-from-left-8',
          side === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t border-line data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute end-3 top-3 grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          aria-label={he.common.close}
        >
          <X className="size-[18px]" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
SheetContent.displayName = 'SheetContent'
