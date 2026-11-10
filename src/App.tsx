import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DirectionProvider } from '@radix-ui/react-direction'
import { MotionConfig } from 'framer-motion'
import { Component, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LogoMark } from '@/components/layout/Logo'
import { Button, buttonVariants } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { AuthProvider, useAuth } from '@/lib/auth'
import { installGlobalHandlers, logError } from '@/lib/log'
import { he } from '@/lib/strings.he'
import LoginPage from '@/pages/Login'

const AppShell = lazy(() =>
  import('@/components/layout/AppShell').then((m) => ({ default: m.AppShell })),
)
const HomePage = lazy(() => import('@/pages/Home'))
const CandidatesPage = lazy(() => import('@/pages/Candidates'))
const IdeasPage = lazy(() => import('@/pages/Ideas'))
const DesignSystemPage = lazy(() => import('@/pages/DesignSystem'))
const DocumentsPage = lazy(() => import('@/pages/Documents'))
const ResumeEditorPage = lazy(() => import('@/pages/ResumeEditor'))
const ResumeTablePage = lazy(() => import('@/pages/ResumeTable'))
const ImportPage = lazy(() => import('@/pages/Import'))
const BackupPage = lazy(() => import('@/pages/Backup'))

/** Hash routing for static hosting without rewrites (VITE_HASH_ROUTER=true); clean URLs otherwise. */
const Router = import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter

installGlobalHandlers()

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err, query) => logError('query', err, { key: query.queryKey.slice(0, 2) }),
  }),
  mutationCache: new MutationCache({
    onError: (err) => logError('mutation', err),
  }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
})

function FullScreenLoader() {
  return (
    <div
      className="grid min-h-[100dvh] place-items-center"
      role="status"
      aria-label={he.common.loading}
    >
      <LogoMark className="size-12 animate-pulse" />
    </div>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logError('render', error, {
      component: info.componentStack?.split('\n').slice(0, 4).join('\n'),
    })
  }
  override render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="grid min-h-[100dvh] place-items-center px-4 text-center">
        <div>
          <LogoMark className="mx-auto size-12" />
          <h1 className="mt-4 text-h1 text-foreground">{he.errors.boundaryTitle}</h1>
          <p className="mt-2 text-body text-muted-foreground">{he.errors.boundaryText}</p>
          <Button variant="primary" className="mt-5" onClick={() => window.location.reload()}>
            {he.errors.reload}
          </Button>
        </div>
      </main>
    )
  }
}

export default function App() {
  // Top-center keeps toasts clear of dialog footers and the form's save bar.
  const isMobile = useIsMobile()
  return (
    <ErrorBoundary>
      <DirectionProvider dir="rtl">
        <MotionConfig reducedMotion="user">
          <QueryClientProvider client={queryClient}>
            <TooltipProvider delayDuration={350} skipDelayDuration={150}>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AuthProvider>
                  <Suspense fallback={<FullScreenLoader />}>
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route
                        element={
                          <Protected>
                            <AppShell />
                          </Protected>
                        }
                      >
                        <Route index element={<HomePage />} />
                        <Route path="candidates" element={<CandidatesPage />} />
                        <Route path="ideas" element={<IdeasPage />} />
                        <Route path="documents" element={<DocumentsPage />} />
                        <Route path="documents/resume" element={<ResumeEditorPage />} />
                        <Route path="resume-table" element={<ResumeTablePage />} />
                        <Route path="import" element={<ImportPage />} />
                        <Route path="backup" element={<BackupPage />} />
                        <Route path="design-system" element={<DesignSystemPage />} />
                      </Route>
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </AuthProvider>
              </Router>
              <Toaster
                dir="rtl"
                position="top-center"
                offset={isMobile ? 12 : 20}
                closeButton
                toastOptions={{
                  unstyled: true,
                  classNames: {
                    toast:
                      'relative flex w-full items-start gap-3 rounded-lg border border-border bg-card p-4 pe-10 font-sans text-body text-foreground shadow-lg',
                    title: 'font-medium',
                    description: 'mt-1 text-body-sm text-muted-foreground',
                    icon: 'mt-0.5 shrink-0 [&_svg]:size-4',
                    success: '[&_[data-icon]]:text-success',
                    error: '[&_[data-icon]]:text-destructive',
                    warning: '[&_[data-icon]]:text-warning',
                    info: '[&_[data-icon]]:text-info',
                    actionButton: buttonVariants({ variant: 'primary', size: 'sm' }),
                    cancelButton: buttonVariants({ variant: 'outline', size: 'sm' }),
                    closeButton:
                      'absolute end-2 top-2 grid size-6 place-items-center rounded-sm text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-foreground [&_svg]:size-3.5',
                  },
                }}
              />
            </TooltipProvider>
          </QueryClientProvider>
        </MotionConfig>
      </DirectionProvider>
    </ErrorBoundary>
  )
}
