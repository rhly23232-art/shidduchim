import { useQueryClient } from '@tanstack/react-query'
import { Archive, Trash2, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Input } from '@/components/ui/input'
import { authApi, dataApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { he } from '@/lib/strings.he'
import { errorMessage } from '@/lib/utils'

const t = he.account
type Action = 'wipe' | 'delete'

/** Typed word + password before anything irreversible. */
function ConfirmDestructive({ action, onClose }: { action: Action | null; onClose: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [word, setWord] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<Action | null>(null)
  if (action !== last) {
    setLast(action)
    setWord('')
    setPassword('')
    setError(null)
  }
  const ready = word.trim() === t.confirmWord && password.length > 0

  const run = async () => {
    if (!user || !action) return
    setBusy(true)
    setError(null)
    try {
      if (action === 'wipe') {
        // verify the password (re-authenticates the same account)
        await authApi.signIn(user.email, password).catch(() => {
          throw new Error(t.wrongPassword)
        })
        await dataApi.deleteAllMyData()
        await qc.invalidateQueries()
        toast.success(t.wiped)
        onClose()
      } else {
        await authApi.deleteAccount(password)
        qc.clear()
        toast.success(t.deleted)
        navigate('/login', { replace: true })
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const title = action === 'delete' ? t.deleteTitle : t.wipeTitle
  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (ready && !busy) void run()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogHeader>
            <DialogTitle>{t.confirmTitle(title)}</DialogTitle>
            <DialogDescription>{t.confirmText}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label={t.typeWord} required>
              {(id, aria) => (
                <Input
                  id={id}
                  {...aria}
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  autoComplete="off"
                />
              )}
            </Field>
            <Field label={t.password} required>
              {(id, aria) => (
                <Input
                  id={id}
                  {...aria}
                  type="password"
                  dir="ltr"
                  className="text-start"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
            {error && <Alert tone="destructive">{error}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button onClick={onClose} disabled={busy}>
              {he.common.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={!ready} loading={busy}>
              {busy ? t.working : title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Account details, data export and erasure (wipe data / delete account). */
export default function AccountPage() {
  const { user } = useAuth()
  const [action, setAction] = useState<Action | null>(null)
  return (
    <main id="main" className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 pt-6 md:px-8">
      <p className="text-body text-muted-foreground">{t.subtitle}</p>
      <Card>
        <CardHeader>
          <CardTitle>{t.details}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-body">
            <dt className="text-muted-foreground">{t.name}</dt>
            <dd>{user?.fullName || '—'}</dd>
            <dt className="text-muted-foreground">{t.email}</dt>
            <dd dir="ltr" className="text-end">
              {user?.email}
            </dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.exportTitle}</CardTitle>
          <CardDescription>{t.exportText}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/backup">
              <Archive />
              {t.exportGo}
            </Link>
          </Button>
        </CardContent>
      </Card>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">{t.danger}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.wipeTitle}</p>
              <p className="text-body-sm text-muted-foreground">{t.wipeText}</p>
            </div>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setAction('wipe')}
            >
              <Trash2 />
              {t.wipeButton}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.deleteTitle}</p>
              <p className="text-body-sm text-muted-foreground">{t.deleteText}</p>
            </div>
            <Button variant="destructive" onClick={() => setAction('delete')}>
              <UserX />
              {t.deleteButton}
            </Button>
          </div>
        </CardContent>
      </Card>
      <ConfirmDestructive action={action} onClose={() => setAction(null)} />
    </main>
  )
}
