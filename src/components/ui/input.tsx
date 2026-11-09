import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-[inset_0_1px_1px_hsl(var(--ink)/0.03)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-ink-muted/70 hover:border-navy-200 focus-visible:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/35 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/25'

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
    className={cn(fieldBase, 'min-h-[5rem] resize-y py-2 leading-relaxed', className)}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b6474' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export const NativeSelect = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, style, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(fieldBase, 'h-10 cursor-pointer appearance-none pe-3 ps-9', className)}
    style={{
      backgroundImage: CHEVRON,
      backgroundRepeat: 'no-repeat',
      backgroundSize: '16px',
      backgroundPosition: 'left 0.75rem center',
      ...style,
    }}
    {...props}
  >
    {children}
  </select>
))
NativeSelect.displayName = 'NativeSelect'
