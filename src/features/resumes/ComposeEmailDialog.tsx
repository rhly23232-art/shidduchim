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
import { errorMessage, formatBytes } from '@/lib/utils'
import { emailFormSchema, type EmailFormValues } from '@/lib/validators'

export interface EmailAttachment {
  /** Shown in the dialog */
  name: string
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
  attachment: EmailAttachment | null
  noAttachmentText?: string
  /** Server route (Supabase edge function); omitted → unavailable */
  sendViaServer?: (values: EmailFormValues) => Promise<void>
  /** mailto: fallback outside claude.ai */
  buildMailto?: (values: EmailFormValues) => Promise<string>
  /** Extra controls above the fields (e.g. choosing a candidate) */
  children?: ReactNode
}

/**
 * Compose + send an email with one attachment. Routes: the viewer's Gmail inside claude.ai,
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
  attachment,
  noAttachmentText = he.email.noResume,
  sendViaServer,
  buildMailto,
  children,
}: ComposeEmailDialogProps) {
  const [sending, setSending] = useState(false)
  const [route, setRoute] = useState<Route>(sendViaServer ? 'server' : 'none')
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
          attachment: attachment ? await attachment.load() : undefined,
        })
        toast.success(he.email.gmailSent(values.to))
      } else if (sendViaServer) {
        await sendViaServer(values)
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
      window.location.href = await buildMailto(values)
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

            <div className="flex items-center gap-3 rounded-md bg-secondary px-4 py-3 text-body">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {attachment ? (
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{he.email.attachment}: </span>
                  <span dir="auto" className="font-medium">
                    {attachment.name}
                  </span>
                  {attachment.size !== undefined && (
                    <span className="tabular text-muted-foreground">
                      {' · '}
                      <span dir="ltr">{formatBytes(attachment.size)}</span>
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">{noAttachmentText}</span>
              )}
            </div>

            <section className="rounded-md border border-border p-4" aria-labelledby="manual-send">
              <h3 id="manual-send" className="text-h4 text-foreground">
                {he.email.manualTitle}
              </h3>
              <p className="mt-1 text-body-sm text-muted-foreground">{he.email.manualText}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={`${subject}\n\n${body}`} label={he.email.copyAll} />
                {attachment && (
                  <Button size="sm" variant="ghost" onClick={attachment.download}>
                    <Download />
                    {he.email.downloadForAttach}
                  </Button>
                )}
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
