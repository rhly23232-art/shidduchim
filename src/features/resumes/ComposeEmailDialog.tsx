import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Copy, Download, ExternalLink, Mail, Paperclip, Send } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { hostErrorCode, hostMcp, isHosted, sendViaGmail } from '@/lib/hostBridge'
import { he } from '@/lib/strings.he'
import { cn, errorMessage, formatBytes } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { emailFormSchema, type EmailFormValues } from '@/lib/validators'

export interface EmailAttachment {
  /** Stable id ('resume', 'photo', 'document') */
  id: string
  /** Shown in the dialog */
  name: string
  /** The sender can leave it out (checkbox, on by default) */
  optional?: boolean
  /** Text of the manual-download button */
  downloadLabel?: string
  size?: number
  /** Loads the bytes when sending through Gmail */
  load: () => Promise<{ blob: Blob; filename: string; mime: string }>
  /** Saves the file so it can be attached by hand */
  download: () => void
}

type Route = 'gmail' | 'server' | 'none'

export function gmailErrorText(err: unknown): string {
  const raw = errorMessage(err)
  // The connected Gmail may only have read access (no compose/send permission).
  if (/permission|scope|insufficient|forbidden|403/i.test(raw)) return he.email.gmailNoPermission
  switch (hostErrorCode(err)) {
    case 'server_not_connected':
    case 'server_not_found':
    case 'selection_required':
      return he.email.gmailNotConnected
    case 'needs_reauth':
      return he.email.gmailReauth
    case 'not_in_manifest':
    case 'approval_required':
    case 'blocked_by_policy':
    case 'not_granted':
      return he.email.gmailNotAllowed
    case 'too_large':
      return he.email.gmailTooBig
    case 'server_unavailable':
    case 'upstream_error':
    case 'cancelled':
    case 'timeout':
      return he.email.gmailUnclear
    default:
      return raw
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setDone(true)
            setTimeout(() => setDone(false), 1800)
          })
          .catch(() => toast.error(he.common.unknownError))
      }}
    >
      {done ? <Check className="text-success" /> : <Copy />}
      {done ? he.email.copied : label}
    </Button>
  )
}

export interface ComposeEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  /** Recomputed every time the dialog opens (and when `defaultsKey` changes while open). */
  defaults: EmailFormValues
  defaultsKey?: string
  toLabel?: string
  attachments: EmailAttachment[]
  noAttachmentText?: string
  /** Server route (Supabase edge function); omitted → unavailable. `included` = attachment ids */
  sendViaServer?: (
    values: EmailFormValues,
    idempotencyKey: string,
    included: string[],
  ) => Promise<void>
  /** mailto: fallback outside claude.ai */
  buildMailto?: (values: EmailFormValues, included: string[]) => Promise<string>
  /** Extra controls above the fields (e.g. choosing a candidate) */
  children?: ReactNode
}

/**
 * Compose + send an email with its attachments (e.g. resume + photo). Routes: the viewer's Gmail inside claude.ai,
 * the server (Resend) when configured, and always a manual path (copy text + save the file).
 */
export function ComposeEmailDialog({
  open,
  onOpenChange,
  title,
  description,
  defaults,
  defaultsKey,
  toLabel = he.email.to,
  attachments,
  noAttachmentText = he.email.noResume,
  sendViaServer,
  buildMailto,
  children,
}: ComposeEmailDialogProps) {
  const [sending, setSending] = useState(false)
  // One key per opening of the dialog: retries of the same message are never sent twice.
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID())
  const [route, setRoute] = useState<Route>(sendViaServer ? 'server' : 'none')
  // optional attachments the sender switched off
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const included = attachments.filter((a) => !excluded.has(a.id))
  const toggle = (id: string, on: boolean) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (on) next.delete(id)
      else next.add(id)
      return next
    })
    // a different set of files is a different email: never reuse the previous key
    setIdemKey(crypto.randomUUID())
  }
  const hosted = isHosted()
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: defaults,
  })

  useEffect(() => {
    if (!open) return
    // keep a typed address when only the subject/body defaults change
    const to = form.getValues('to') || defaults.to
    form.reset({ ...defaults, to })
    setIdemKey(crypto.randomUUID())
    setExcluded(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open / key change only
  }, [open, defaultsKey])

  const hasServer = !!sendViaServer
  useEffect(() => {
    if (!open) return
    setRoute(hasServer ? 'server' : 'none')
    // Inside the claude.ai viewer: send through the viewer's own Gmail (real attachment).
    let alive = true
    void hostMcp().then((mcp) => {
      if (alive && mcp) setRoute('gmail')
    })
    return () => {
      alive = false
    }
  }, [open, hasServer])

  const onSend = form.handleSubmit(async (values) => {
    setSending(true)
    try {
      if (route === 'gmail') {
        await sendViaGmail({
          ...values,
          attachments: await Promise.all(included.map((a) => a.load())),
        })
        toast.success(he.email.gmailSent(values.to))
      } else if (sendViaServer) {
        await sendViaServer(
          values,
          idemKey,
          included.map((a) => a.id),
        )
        toast.success(he.email.sent(values.to))
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(he.email.sendFailed, {
        description: route === 'gmail' ? gmailErrorText(err) : errorMessage(err),
        duration: 15000,
      })
    } finally {
      setSending(false)
    }
  })

  const onMailto = form.handleSubmit(async (values) => {
    if (!buildMailto) return
    try {
      window.location.href = await buildMailto(
        values,
        included.map((a) => a.id),
      )
    } catch (err) {
      toast.error(he.email.sendFailed, { description: errorMessage(err) })
    }
  })

  const { errors } = form.formState
  const subject = form.watch('subject')
  const body = form.watch('body')
  const canSend = route !== 'none'

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-xl">
        <form onSubmit={onSend} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {children}
            <Field label={toLabel} error={errors.to?.message} required>
              {(id, aria) => (
                <Input
                  id={id}
                  {...aria}
                  type="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={he.email.toPlaceholder}
                  className="text-start"
                  autoFocus={!children}
                  {...form.register('to')}
                />
              )}
            </Field>
            <Field label={he.email.subject} error={errors.subject?.message} required>
              {(id, aria) => <Input id={id} {...aria} {...form.register('subject')} />}
            </Field>
            <Field label={he.email.body} error={errors.body?.message} required>
              {(id, aria) => <Textarea id={id} {...aria} rows={8} {...form.register('body')} />}
            </Field>

            <div className="rounded-md bg-secondary px-4 py-3 text-body">
              {attachments.length ? (
                <ul className="space-y-2" aria-label={he.email.attachments}>
                  {attachments.map((a) => {
                    const on = !excluded.has(a.id)
                    return (
                      <li key={a.id} className="flex min-w-0 items-center gap-3">
                        <Paperclip
                          className={cn(
                            'size-4 shrink-0',
                            on ? 'text-muted-foreground' : 'text-muted-foreground/40',
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate',
                            !on && 'line-through opacity-60',
                          )}
                        >
                          <span className="text-muted-foreground">{he.email.attachment}: </span>
                          <span dir="auto" className="font-medium">
                            {a.name}
                          </span>
                          {a.size !== undefined && (
                            <span className="tabular text-muted-foreground">
                              {' · '}
                              <span dir="ltr">{formatBytes(a.size)}</span>
                            </span>
                          )}
                        </span>
                        {a.optional && (
                          <Checkbox
                            checked={on}
                            onChange={(v) => toggle(a.id, v)}
                            label={he.email.attachPhoto}
                            className="shrink-0 text-body-sm"
                          >
                            {he.email.attachPhoto}
                          </Checkbox>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <span className="flex items-center gap-3 text-muted-foreground">
                  <Paperclip className="size-4 shrink-0" aria-hidden />
                  {noAttachmentText}
                </span>
              )}
            </div>

            <section className="rounded-md border border-border p-4" aria-labelledby="manual-send">
              <h3 id="manual-send" className="text-h4 text-foreground">
                {he.email.manualTitle}
              </h3>
              <p className="mt-1 text-body-sm text-muted-foreground">{he.email.manualText}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={`${subject}\n\n${body}`} label={he.email.copyAll} />
                {included.map((a) => (
                  <Button key={a.id} size="sm" variant="ghost" onClick={a.download}>
                    <Download />
                    {a.downloadLabel ?? he.email.downloadForAttach}
                  </Button>
                ))}
                {!hosted && buildMailto && (
                  <Button size="sm" variant="ghost" onClick={() => void onMailto()}>
                    <ExternalLink />
                    {he.email.mailtoButton}
                  </Button>
                )}
              </div>
            </section>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              {he.common.cancel}
            </Button>
            <Tooltip content={canSend ? null : he.email.serverUnavailableDemo}>
              <span tabIndex={canSend ? undefined : 0} className="inline-flex">
                <Button type="submit" variant="primary" disabled={!canSend} loading={sending}>
                  {sending ? null : route === 'gmail' ? <Mail /> : <Send />}
                  {sending
                    ? route === 'gmail'
                      ? he.email.gmailSending
                      : he.email.sending
                    : route === 'gmail'
                      ? he.email.viaGmail
                      : he.email.send}
                </Button>
              </span>
            </Tooltip>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
