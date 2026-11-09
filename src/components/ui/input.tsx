import { ChevronDown } from 'lucide-react'
import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

/** Shared look of every text-like control (input, textarea, select, triggers). */
export const fieldBase =
  'w-full rounded-md border border-input bg-card px-3 text-body text-foreground transition-[border-color,box-shadow] duration-fast ease-out hover:border-input-hover focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-secondary disabled:opacity-70 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(fieldBase, 'min-h-20 resize-y py-2 leading-relaxed', className)}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

/** Native select (best on mobile), styled like Input. Chevron sits at the inline end. */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(fieldBase, 'h-10 cursor-pointer appearance-none pe-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  ),
)
NativeSelect.displayName = 'NativeSelect'
