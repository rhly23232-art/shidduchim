import { LogIn, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import {
  forgetAccount,
  recentAccounts,
  setLoginIntent,
  type RecentAccount,
} from '@/lib/recentAccounts'
import { he } from '@/lib/strings.he'

const t = he.switchAccount

function Avatar({ label }: { label: string }) {
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-body font-semibold text-accent-foreground"
      aria-hidden
    >
      {label.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/** Switch to another account on this device (sign out → sign in with that account). */
export function SwitchAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [, rerender] = useState(0)
  if (!user) return null
  const others = recentAccounts(user.email)
  const me = user.fullName || user.email

  const go = async (state: { email?: string; signup?: boolean }) => {
    onOpenChange(false)
    setLoginIntent(state)
    await signOut()
    navigate('/login', { replace: true })
  }
  const label = (a: RecentAccount) => a.fullName || a.email

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="flex items-center gap-3 rounded-md border border-brand/40 bg-accent/40 p-3">
            <Avatar label={me} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-foreground">{me}</p>
              <p className="truncate text-caption text-muted-foreground" dir="ltr">
                {user.email}
              </p>
            </div>
            <span className="text-caption text-muted-foreground">{t.current}</span>
          </div>

          {others.length > 0 && (
            <section aria-labelledby="recent-accounts">
              <h3 id="recent-accounts" className="mb-2 text-label text-muted-foreground">
                {t.recent}
              </h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {others.map((a) => (
                  <li key={a.email} className="flex items-center gap-1 pe-1">
                    <button
                      type="button"
                      onClick={() => void go({ email: a.email })}
                      aria-label={t.choose(label(a))}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-3 text-start transition-colors duration-fast hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar label={label(a)} />
                      <span className="min-w-0">
                        <span className="block truncate text-body font-medium text-foreground">
                          {label(a)}
                        </span>
                        <span
                          className="block truncate text-caption text-muted-foreground"
                          dir="ltr"
                        >
                          {a.email}
                        </span>
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.forget(label(a))}
                      onClick={() => {
                        forgetAccount(a.email)
                        rerender((n) => n + 1)
                      }}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => void go({})}>
              <LogIn />
              {t.other}
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => void go({ signup: true })}>
              <UserPlus />
              {t.create}
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">{t.note}</p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
