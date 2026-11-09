import { isDemoMode } from '../env'
import { demoAuth, demoData } from './demoApi'
import { createHostBackend, type HostAssets, type HostDb, type HostUser } from './hostDbApi'
import { supabaseAuth, supabaseData } from './supabaseApi'
import type { AuthApi, DataApi } from './types'

export type BackendMode = 'supabase' | 'host' | 'demo'

let mode: BackendMode = isDemoMode ? 'demo' : 'supabase'
let currentAuth: AuthApi = isDemoMode ? demoAuth : supabaseAuth
let currentData: DataApi = isDemoMode ? demoData : supabaseData

/** Which storage the app uses right now (decided once at boot). */
export const backendMode = (): BackendMode => mode

interface HostClaude {
  use(name: string): Promise<unknown>
}

/**
 * Picks the backend before the first render:
 *  1. Supabase when it is configured;
 *  2. inside claude.ai, the Artifact database of the signed-in account;
 *  3. otherwise the local in-browser demo.
 */
export async function initBackend(): Promise<BackendMode> {
  if (!isDemoMode) return mode
  const claude = (window as unknown as { claude?: HostClaude }).claude
  if (!claude || typeof claude.use !== 'function') return mode
  try {
    const [db, user, assets] = await Promise.all([
      claude.use('db') as Promise<HostDb | null>,
      claude.use('user') as Promise<HostUser | null>,
      (claude.use('assets') as Promise<HostAssets | null>).catch(() => null),
    ])
    if (!db || !user) return mode
    const me = await user.me()
    if (!me.id) return mode
    const host = createHostBackend(db, { id: me.id, name: me.name, email: me.email }, assets)
    currentAuth = host.auth
    currentData = host.data
    mode = 'host'
  } catch {
    /* stay on the local demo */
  }
  return mode
}

/** Stable facades: callers keep these references; the implementation is chosen at boot. */
export const authApi: AuthApi = new Proxy({} as AuthApi, {
  get: (_t, key) => Reflect.get(currentAuth, key, currentAuth),
})
export const dataApi: DataApi = new Proxy({} as DataApi, {
  get: (_t, key) => Reflect.get(currentData, key, currentData),
})
export type * from './types'
