import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn('flex flex-col overflow-hidden', className)}
    {...props}
  />
))
Command.displayName = 'Command'

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2 border-b border-border px-3 pb-2">
    <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    <CommandPrimitive.Input
      ref={ref}
      className={cn('h-8 w-full bg-transparent text-body outline-none', className)}
      {...props}
    />
  </div>
))
CommandInput.displayName = 'CommandInput'

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-64 overflow-y-auto overscroll-contain pt-1', className)}
    {...props}
  />
))
CommandList.displayName = 'CommandList'

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-5 text-center text-body text-muted-foreground"
    {...props}
  />
))
CommandEmpty.displayName = 'CommandEmpty'

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground',
      className,
    )}
    {...props}
  />
))
CommandGroup.displayName = 'CommandGroup'

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-2 text-body outline-none data-[selected=true]:bg-secondary',
      className,
    )}
    {...props}
  />
))
CommandItem.displayName = 'CommandItem'
