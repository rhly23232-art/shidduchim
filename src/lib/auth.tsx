import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi, type AppUser } from './api'

interface AuthState {
  user: AppUser | null
  loading: boolean
  signIn: typeof authApi.signIn
  signUp: typeof authApi.signUp
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    authApi
      .getUser()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false))
    const unsubscribe = authApi.onAuthChange((u) => {
      setUser((prev) => {
        // Different account (or sign-out) → never show cached data of the previous one.
        if (prev?.id !== u?.id) queryClient.clear()
        return u
      })
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: authApi.signIn,
      signUp: authApi.signUp,
      signOut: async () => {
        await authApi.signOut()
        queryClient.clear()
        setUser(null)
      },
    }),
    [user, loading, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
