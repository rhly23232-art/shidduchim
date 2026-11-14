import { ChevronDown, Download, Mail, UserCog } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { APP_VERSION } from '@/lib/log'
import { he } from '@/lib/strings.he'
import { errorMessage } from '@/lib/utils'
import { downloadSupportReport } from './supportReport'

const t = he.supportCenter

/** Where support requests go — set at build time (VITE_SUPPORT_EMAIL). */
const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || null

export function SupportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')

  const report = () => {
    const id = toast.loading(he.support.preparing)
    downloadSupportReport()
      .then((name) => toast.success(he.support.ready, { id, description: name }))
      .catch((e) => toast.error(he.support.failed, { id, description: errorMessage(e) }))
  }

  const mailto = SUPPORT_EMAIL
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t.mailSubject)}&body=${encodeURIComponent(
        `${message.trim()}\n\n—\n${he.support.version(APP_VERSION)}`,
      )}`
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-6">
          <section aria-labelledby="faq-title">
            <h3 id="faq-title" className="mb-2 text-h4 text-foreground">
              {t.faqTitle}
            </h3>
            <div className="divide-y divide-border rounded-md border border-border">
              {t.faq.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body font-medium text-foreground transition-colors duration-fast hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{f.q}</span>
                    <ChevronDown
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-base group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="px-4 pb-4 text-body text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section aria-labelledby="contact-title" className="space-y-3">
            <h3 id="contact-title" className="text-h4 text-foreground">
              {t.contactTitle}
            </h3>
            {mailto ? (
              <>
                <Field label={t.message}>
                  {(id, aria) => (
                    <Textarea
                      id={id}
                      {...aria}
                      rows={4}
                      maxLength={2000}
                      placeholder={t.messagePlaceholder}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  )}
                </Field>
                <Button asChild variant="primary">
                  <a href={mailto}>
                    <Mail />
                    {t.send}
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-body text-muted-foreground">{t.noContact}</p>
            )}
            <div className="rounded-md border border-border bg-secondary/50 p-4">
              <p className="text-body font-medium text-foreground">{t.reportTitle}</p>
              <p className="mt-1 text-body-sm text-muted-foreground">{t.reportText}</p>
              <Button size="sm" className="mt-3" onClick={report}>
                <Download />
                {t.reportButton}
              </Button>
            </div>
          </section>

          <Button
            variant="link"
            className="h-auto px-0"
            onClick={() => {
              onOpenChange(false)
              navigate('/account')
            }}
          >
            <UserCog />
            {t.accountLink}
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
