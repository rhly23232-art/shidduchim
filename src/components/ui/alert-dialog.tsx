import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type { ReactNode } from 'react'
import { useReturnFocus } from '@/hooks/useReturnFocus'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'
import { buttonVariants } from './button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

/** Accessible confirmation dialog (Radix AlertDialog). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = he.common.cancel,
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  const focus = useReturnFocus()
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-overlay/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialogPrimitive.Content
          {...focus}
          className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg duration-base data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]"
        >
          <AlertDialogPrimitive.Title className="text-h3 text-foreground">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-body text-muted-foreground">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AlertDialogPrimitive.Cancel className={buttonVariants({ variant: 'outline' })}>
              {cancelLabel}
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              className={cn(buttonVariants({ variant: destructive ? 'destructive' : 'primary' }))}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
