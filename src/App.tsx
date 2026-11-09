import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DirectionProvider } from '@radix-ui/react-direction'
import { MotionConfig } from 'framer-motion'
import { Component, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LogoMark } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { AuthProvider, useAuth } from '@/lib/auth'
import { he } from '@/lib/strings.he'
import LoginPage from '@/pages/Login'

const AppShell = lazy(() =>
  import('@/components/layout/AppShell').then((m) => ({ default: m.AppShell })),
)
const HomePage = lazy(() => import('@/pages/Home'))
const CandidatesPage = lazy(() => import('@/pages/Candidates'))
const IdeasPage = lazy(() => import('@/pages/Ideas'))

/** Hash routing for static hosting without rewrites (VITE_HASH_ROUTER=true); clean URLs otherwise. */
const Router = import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter

const queryClient = new QueryClient({
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
  override render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="grid min-h-[100dvh] place-items-center px-4 text-center">
        <div>
          <LogoMark className="mx-auto size-12" />
          <h1 className="mt-4 text-2xl font-bold text-navy-900">{he.errors.boundaryTitle}</h1>
          <p className="mt-2 text-sm text-ink-muted">{he.errors.boundaryText}</p>
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
                  classNames: {
                    toast: '!rounded-xl !border-line !bg-surface !text-ink !shadow-pop !font-sans',
                    description: '!text-ink-muted',
                    success: '[&_[data-icon]]:!text-success',
                    error: '[&_[data-icon]]:!text-danger',
                    actionButton: '!bg-navy-900 !text-surface',
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
