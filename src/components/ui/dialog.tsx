import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react'
import { useReturnFocus } from '@/hooks/useReturnFocus'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-overlay/40 data-[state=closed]:duration-fast data-[state=open]:duration-base data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = 'DialogOverlay'

interface DialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideClose?: boolean
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, hideClose, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const focus = useReturnFocus(onOpenAutoFocus, onCloseAutoFocus)
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        {...focus}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg outline-none',
          'data-[state=closed]:duration-fast data-[state=open]:duration-base data-[state=open]:ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]',
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className="absolute end-4 top-4 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={he.common.close}
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = 'DialogContent'

export const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col gap-1 border-b border-border px-6 pb-4 pe-16 pt-5', className)}
    {...props}
  />
)
export const DialogBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5', className)}
    {...props}
  />
)
export const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-6 py-4',
      className,
    )}
    {...props}
  />
)

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-h2 text-foreground', className)}
    {...props}
  />
))
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-body text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = 'DialogDescription'
