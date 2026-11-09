import { useId, type ReactNode } from 'react'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'
import { Label } from './label'

export interface FieldAria {
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: (id: string, aria: FieldAria) => ReactNode
}

/** Label + control + helper/error text, wired for screen readers. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy =
    [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <>
            <span className="ms-1 text-destructive" aria-hidden>
              *
            </span>
            <span className="sr-only"> ({he.common.required})</span>
          </>
        )}
      </Label>
      {children(id, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-caption font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
