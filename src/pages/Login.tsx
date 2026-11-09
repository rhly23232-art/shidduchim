import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { Database, FlaskConical, Loader2, LogIn, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogoMark } from '@/components/layout/Logo'
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
            className="text-left"
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
            className="text-left"
            autoComplete="current-password"
            {...form.register('password')}
          />
        )}
      </Field>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
        {he.auth.login}
      </Button>
      {backendMode() === 'demo' && (
        <>
          <div className="flex items-center gap-3 text-xs text-ink-muted" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            {he.auth.or}
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button size="lg" className="w-full" onClick={() => void demo()} disabled={isSubmitting}>
            <FlaskConical />
            {he.auth.demoLogin}
          </Button>
          <p className="text-center text-xs text-ink-muted">{he.auth.demoHint}</p>
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
    return (
      <p className="rounded-lg bg-success-soft px-4 py-3 text-sm text-success" role="status">
        {he.auth.checkEmail}
      </p>
    )
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
            className="text-left"
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
            className="text-left"
            autoComplete="new-password"
            {...form.register('password')}
          />
        )}
      </Field>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
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
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-cream-50 px-4 py-10">
      {/* soft decorative rings */}
      <svg
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 w-[900px] max-w-none -translate-x-1/2 opacity-[0.5]"
        viewBox="0 0 900 500"
      >
        <circle
          cx="390"
          cy="250"
          r="230"
          fill="none"
          strokeWidth="1.5"
          className="stroke-gold-300"
        />
        <circle
          cx="510"
          cy="250"
          r="230"
          fill="none"
          strokeWidth="1.5"
          className="stroke-navy-200"
        />
      </svg>
      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark className="size-14" />
          <h1 className="mt-4 text-4xl font-bold text-navy-900">{he.app.name}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">{he.app.tagline}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <h2 className="text-2xl font-bold text-navy-900">
                {mode === 'login' ? he.auth.loginTitle : he.auth.signupTitle}
              </h2>
              {backendMode() === 'host' && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-[13px] text-success">
                  <Database className="size-4 shrink-0" aria-hidden />
                  {firstVisit ? he.hostDb.firstAccount : he.hostDb.loginNote}
                </p>
              )}
              <p className="mb-6 mt-3 text-sm text-ink-muted">
                {mode === 'login' ? he.auth.loginSubtitle : he.auth.signupSubtitle}
              </p>
              {mode === 'login' ? <LoginForm onDone={done} /> : <SignupForm onDone={done} />}
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="mt-5 text-center">
          <Button variant="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? he.auth.toSignup : he.auth.toLogin}
          </Button>
        </p>
      </div>
    </main>
  )
}
