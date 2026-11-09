import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, Info, Loader2, Paperclip, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Field } from '@/components/ui/field'
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
import { Input, Textarea } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { dataApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { he } from '@/lib/strings.he'
import type { CandidateRow } from '@/lib/types'
import { errorMessage, formatBytes, fullName } from '@/lib/utils'
import { emailFormSchema, type EmailFormValues } from '@/lib/validators'
import { buildEmailBody, buildMailto, emailSubject, sendViaServer } from './sendResumeEmail'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: CandidateRow
}

export function EmailDialog({ open, onOpenChange, candidate }: Props) {
  const { user } = useAuth()
  const [sending, setSending] = useState(false)
  const [opening, setOpening] = useState(false)
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { to: '', subject: '', body: '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        to: '',
        subject: emailSubject(candidate),
        body: buildEmailBody(candidate, user?.fullName ?? null),
      })
    }
  }, [open, candidate, user?.fullName, form])

  const serverEnabled = dataApi.supportsServerEmail

  const onSend = form.handleSubmit(async (values) => {
    setSending(true)
    try {
      await sendViaServer({ candidateId: candidate.id, ...values })
      toast.success(he.email.sent(values.to))
      onOpenChange(false)
    } catch (err) {
      toast.error(he.email.sendFailed, {
        description: errorMessage(err),
        action: { label: he.email.mailtoButton, onClick: () => void onMailto() },
      })
    } finally {
      setSending(false)
    }
  })

  const onMailto = form.handleSubmit(async (values) => {
    setOpening(true)
    try {
      const href = await buildMailto(candidate, values.to, values.subject, values.body)
      window.location.href = href
    } catch (err) {
      toast.error(he.email.sendFailed, { description: errorMessage(err) })
    } finally {
      setOpening(false)
    }
  })

  const { errors } = form.formState
  const resume = candidate.resume

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
                  className="text-left"
                  autoFocus
                  {...form.register('to')}
                />
              )}
            </Field>
            <Field label={he.email.subject} error={errors.subject?.message} required>
              {(id, aria) => <Input id={id} {...aria} {...form.register('subject')} />}
            </Field>
            <Field label={he.email.body} error={errors.body?.message} required>
              {(id, aria) => <Textarea id={id} {...aria} rows={9} {...form.register('body')} />}
            </Field>

            <div className="flex items-center gap-2.5 rounded-lg bg-navy-50 px-3 py-2.5 text-sm">
              <Paperclip className="size-4 shrink-0 text-navy-700" aria-hidden />
              {resume ? (
                <span className="min-w-0 truncate">
                  <span className="text-ink-muted">{he.email.attachment}: </span>
                  <span dir="auto" className="font-medium">
                    {resume.file_name}
                  </span>
                  <span className="tabular text-ink-muted">
                    {' · '}
                    <span dir="ltr">{formatBytes(resume.size_bytes)}</span>
                  </span>
                </span>
              ) : (
                <span className="text-ink-muted">{he.email.noResume}</span>
              )}
            </div>

            <p className="flex gap-2 rounded-lg border border-gold-300 bg-gold-100/50 px-3 py-2.5 text-[13px] leading-relaxed text-gold-700">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {dataApi.supportsShareLinks ? he.email.mailtoNote : he.email.mailtoNoteDemo}
            </p>
          </DialogBody>
          <DialogFooter className="justify-between">
            <Button variant="ghost" onClick={() => void onMailto()} disabled={opening || sending}>
              {opening ? <Loader2 className="animate-spin" /> : <ExternalLink />}
              {he.email.mailtoButton}
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sending}>
                {he.common.cancel}
              </Button>
              <Tooltip content={serverEnabled ? null : he.email.serverUnavailableDemo}>
                <span tabIndex={serverEnabled ? undefined : 0} className="inline-flex">
                  <Button type="submit" variant="primary" disabled={!serverEnabled || sending}>
                    {sending ? <Loader2 className="animate-spin" /> : <Send />}
                    {sending ? he.email.sending : he.email.send}
                  </Button>
                </span>
              </Tooltip>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
