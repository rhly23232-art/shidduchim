import { Copy, Mail, MessageCircle, Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/alert'
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
import { isHosted } from '@/lib/hostBridge'
import { he } from '@/lib/strings.he'

const t = he.invite

/**
 * The link a friend should open. A public address can be set at build time
 * (VITE_PUBLIC_URL); otherwise the site's own address. Inside claude.ai the page runs in a
 * sandbox whose address is not shareable — the claude.ai Share menu is used instead.
 */
function inviteUrl(): string | null {
  const configured = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim()
  if (configured) return configured
  if (isHosted()) return null
  return window.location.origin
}

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const url = inviteUrl()
  const [text, setText] = useState(() => t.message(url))
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t.copied)
    } catch {
      toast.error(t.copyFailed)
    }
  }
  const share = async () => {
    try {
      await navigator.share({ title: he.app.name, text })
    } catch {
      /* the person closed the share sheet */
    }
  }
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`
  const email = `mailto:?subject=${encodeURIComponent(t.emailSubject)}&body=${encodeURIComponent(text)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!url && <Alert tone="info">{t.hostedNote}</Alert>}
          <Field label={t.messageLabel}>
            {(id, aria) => (
              <Textarea
                id={id}
                {...aria}
                rows={5}
                maxLength={1000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {canShare && (
              <Button
                variant="primary"
                className="col-span-2 sm:col-span-3"
                onClick={() => void share()}
              >
                <Share2 />
                {t.share}
              </Button>
            )}
            <Button asChild>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                {t.whatsapp}
              </a>
            </Button>
            <Button asChild>
              <a href={email}>
                <Mail />
                {t.email}
              </a>
            </Button>
            <Button onClick={() => void copy()}>
              <Copy />
              {t.copy}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
