import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { Database, FlaskConical, LogIn, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogoMark } from '@/components/layout/Logo'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/api/demoApi'
import { useAuth } from '@/lib/auth'
import { authApi, backendMode } from '@/lib/api'
import { he } from '@/lib/strings.he'
import { errorMessage } from '@/lib/utils'
import { loginSchema, signupSchema, type LoginValues, type SignupValues } from '@/lib/validators'

type Mode = 'login' | 'signup'

function LoginForm({ onDone }: { onDone: () => void }) {
  const { signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const submit = form.handleSubmit(async (v) => {
    setError(null)
    try {
      await signIn(v.email, v.password)
      onDone()
    } catch (e) {
      setError(errorMessage(e))
    }
  })
  const demo = async () => {
    setError(null)
    form.setValue('email', DEMO_EMAIL)
    form.setValue('password', DEMO_PASSWORD)
    await submit()
  }
  const { errors, isSubmitting } = form.formState
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label={he.auth.email} error={errors.email?.message} required>
        {(id, aria) => (
          <Input
            id={id}
            {...aria}
            type="email"
            dir="ltr"
            className="text-start"
            autoComplete="email"
            autoFocus
            {...form.register('email')}
          />
        )}
      </Field>
      <Field label={he.auth.password} error={errors.password?.message} required>
        {(id, aria) => (
          <Input
            id={id}
            {...aria}
            type="password"
            dir="ltr"
            className="text-start"
            autoComplete="current-password"
            {...form.register('password')}
          />
        )}
      </Field>
      {error && <Alert tone="destructive">{error}</Alert>}
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
        {!isSubmitting && <LogIn />}
        {he.auth.login}
      </Button>
      {backendMode() === 'demo' && (
        <>
          <div className="flex items-center gap-3 text-caption text-muted-foreground" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            {he.auth.or}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button size="lg" className="w-full" onClick={() => void demo()} disabled={isSubmitting}>
            <FlaskConical />
            {he.auth.demoLogin}
          </Button>
          <p className="text-center text-caption text-muted-foreground">{he.auth.demoHint}</p>
        </>
      )}
    </form>
  )
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const { signUp } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  })
  const submit = form.handleSubmit(async (v) => {
    setError(null)
    try {
      const res = await signUp(v.email, v.password, v.fullName)
      if (res.signedIn) {
        toast.success(he.auth.signupSuccess)
        onDone()
      } else setPendingConfirm(true)
    } catch (e) {
      setError(errorMessage(e))
    }
  })
  const { errors, isSubmitting } = form.formState
  if (pendingConfirm) {
    return <Alert tone="success">{he.auth.checkEmail}</Alert>
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label={he.auth.fullName} error={errors.fullName?.message} required>
        {(id, aria) => (
          <Input id={id} {...aria} autoComplete="name" autoFocus {...form.register('fullName')} />
        )}
      </Field>
      <Field label={he.auth.email} error={errors.email?.message} required>
        {(id, aria) => (
          <Input
            id={id}
            {...aria}
            type="email"
            dir="ltr"
            className="text-start"
            autoComplete="email"
            {...form.register('email')}
          />
        )}
      </Field>
      <Field
        label={he.auth.password}
        error={errors.password?.message}
        required
        hint={he.validation.passwordMin}
      >
        {(id, aria) => (
          <Input
            id={id}
            {...aria}
            type="password"
            dir="ltr"
            className="text-start"
            autoComplete="new-password"
            {...form.register('password')}
          />
        )}
      </Field>
      {error && <Alert tone="destructive">{error}</Alert>}
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
        {!isSubmitting && <UserPlus />}
        {he.auth.signup}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [firstVisit, setFirstVisit] = useState(false)
  // Database mode, first visit: no account yet → open on "create account".
  useEffect(() => {
    if (backendMode() !== 'host' || !authApi.hasAccounts) return
    void authApi.hasAccounts().then((has) => {
      if (!has) {
        setFirstVisit(true)
        setMode('signup')
      }
    })
  }, [])
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (!loading && user) return <Navigate to={from} replace />
  const done = () => navigate(from, { replace: true })

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <h1 className="mt-4 text-h1 text-foreground">{he.app.name}</h1>
          <p className="mt-1 text-body text-muted-foreground">{he.app.tagline}</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex h-1" aria-hidden>
            <span className="flex-1 bg-tint-blue-strong" />
            <span className="flex-1 bg-tint-violet-strong" />
            <span className="flex-1 bg-tint-teal-strong" />
            <span className="flex-1 bg-tint-amber-strong" />
          </div>
          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <h2 className="text-h2 text-foreground">
                  {mode === 'login' ? he.auth.loginTitle : he.auth.signupTitle}
                </h2>
                {backendMode() === 'host' && (
                  <Alert
                    tone="info"
                    className="mt-3"
                    icon={<Database className="mt-0.5 size-4 shrink-0" aria-hidden />}
                  >
                    {firstVisit ? he.hostDb.firstAccount : he.hostDb.loginNote}
                  </Alert>
                )}
                <p className="mb-6 mt-1 text-body text-muted-foreground">
                  {mode === 'login' ? he.auth.loginSubtitle : he.auth.signupSubtitle}
                </p>
                {mode === 'login' ? <LoginForm onDone={done} /> : <SignupForm onDone={done} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <p className="mt-6 text-center">
          <Button variant="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? he.auth.toSignup : he.auth.toLogin}
          </Button>
        </p>
      </div>
    </main>
  )
}
