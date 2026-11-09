import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Button — the only clickable action component in the app.
 * Variants: primary (one per area), outline (default), secondary, ghost, destructive, link.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-button transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
        outline:
          'border border-input bg-card text-foreground shadow-sm hover:border-input-hover hover:bg-secondary',
        secondary: 'bg-secondary text-foreground hover:bg-secondary-hover',
        ghost: 'text-foreground hover:bg-secondary',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive-hover',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-body-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-5 text-body-lg',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Shows a spinner, keeps the width and blocks clicks. */
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading, disabled, type, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
