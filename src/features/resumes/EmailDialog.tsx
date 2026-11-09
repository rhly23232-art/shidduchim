import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Copy, Download, ExternalLink, Mail, Paperclip, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { dataApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { hostErrorCode, hostMcp, isHosted, sendViaGmail } from '@/lib/hostBridge'
import { he } from '@/lib/strings.he'
import type { CandidateRow } from '@/lib/types'
import { errorMessage, formatBytes, fullName } from '@/lib/utils'
import { emailFormSchema, type EmailFormValues } from '@/lib/validators'
import { buildEmailBody, buildMailto, emailSubject, sendViaServer } from './sendResumeEmail'
import { useResumeActions } from './uploadResume'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: CandidateRow
  defaultTo?: string
}

type Route = 'gmail' | 'server' | 'none'

function gmailErrorText(err: unknown): string {
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

export function EmailDialog({ open, onOpenChange, candidate, defaultTo = '' }: Props) {
  const { user } = useAuth()
  const { download } = useResumeActions()
  const [sending, setSending] = useState(false)
  const [route, setRoute] = useState<Route>(dataApi.supportsServerEmail ? 'server' : 'none')
  const hosted = isHosted()
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { to: '', subject: '', body: '' },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      to: defaultTo,
      subject: emailSubject(candidate),
      body: buildEmailBody(candidate, user?.fullName ?? null),
    })
    // Inside the claude.ai viewer: send through the viewer's own Gmail (real attachment).
    let alive = true
    void hostMcp().then((mcp) => {
      if (alive && mcp) setRoute('gmail')
    })
    return () => {
      alive = false
    }
  }, [open, candidate, user?.fullName, form, defaultTo])

  const resume = candidate.resume

  const onSend = form.handleSubmit(async (values) => {
    setSending(true)
    try {
      if (route === 'gmail') {
        const attachment = resume
          ? {
              blob: await dataApi.getResumeBlob(resume),
              filename: resume.file_name,
              mime: resume.mime_type,
            }
          : undefined
        await sendViaGmail({ ...values, attachment })
        toast.success(he.email.gmailSent(values.to))
      } else {
        await sendViaServer({ candidateId: candidate.id, ...values })
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
    try {
      window.location.href = await buildMailto(candidate, values.to, values.subject, values.body)
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
            <DialogTitle>{he.email.title}</DialogTitle>
            <DialogDescription>{fullName(candidate)}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label={he.email.to} error={errors.to?.message} required>
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
                  autoFocus
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
              {resume ? (
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{he.email.attachment}: </span>
                  <span dir="auto" className="font-medium">
                    {resume.file_name}
                  </span>
                  <span className="tabular text-muted-foreground">
                    {' · '}
                    <span dir="ltr">{formatBytes(resume.size_bytes)}</span>
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">{he.email.noResume}</span>
              )}
            </div>

            <section className="rounded-md border border-border p-4" aria-labelledby="manual-send">
              <h3 id="manual-send" className="text-h4 text-foreground">
                {he.email.manualTitle}
              </h3>
              <p className="mt-1 text-body-sm text-muted-foreground">{he.email.manualText}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={`${subject}\n\n${body}`} label={he.email.copyAll} />
                {resume && (
                  <Button size="sm" variant="ghost" onClick={() => void download(resume)}>
                    <Download />
                    {he.email.downloadForAttach}
                  </Button>
                )}
                {!hosted && (
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
