import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const alertVariants = cva('flex items-start gap-3 rounded-lg border px-4 py-3 text-body', {
  variants: {
    tone: {
      info: 'border-info/20 bg-info-soft text-foreground [&>svg]:text-info',
      success: 'border-success/20 bg-success-soft text-foreground [&>svg]:text-success',
      warning: 'border-warning/20 bg-warning-soft text-foreground [&>svg]:text-warning',
      destructive:
        'border-destructive/20 bg-destructive-soft text-foreground [&>svg]:text-destructive',
      neutral: 'border-border bg-secondary text-foreground [&>svg]:text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'info' },
})

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
  neutral: Info,
} as const

interface AlertProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  title?: ReactNode
  icon?: ReactNode
  /** Optional action (button/link) shown at the inline end. */
  action?: ReactNode
}

/** Inline message: success / error / warning / info. Icon + text, never color alone. */
export function Alert({ tone, title, icon, action, className, children, ...props }: AlertProps) {
  const Icon = ICONS[tone ?? 'info']
  return (
    <div
      role={tone === 'destructive' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {icon ?? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
