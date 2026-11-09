import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger
export const DropdownMenuGroup = DropdownPrimitive.Group

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, align = 'end', ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      collisionPadding={12}
      className={cn(
        'z-50 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-card p-1 text-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]',
        className,
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2 text-body outline-none transition-colors duration-fast data-[disabled]:pointer-events-none data-[highlighted]:bg-secondary data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
      destructive &&
        'text-destructive data-[highlighted]:bg-destructive-soft [&_svg]:text-destructive',
      className,
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Separator
    ref={ref}
    className={cn('my-1 h-px bg-border', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Label
    ref={ref}
    className={cn('px-3 py-2 text-caption text-muted-foreground', className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = 'DropdownMenuLabel'
