/**
 * Accounts signed in on this device, for "switch account" (no passwords — email + name only).
 * Per-browser convenience: lives in localStorage and is never sent anywhere.
 */
export interface RecentAccount {
  email: string
  fullName: string | null
  at: string
}

const KEY = 'shidduchim.recentAccounts'
const MAX = 5

function read(): RecentAccount[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(v)
      ? v.filter((a): a is RecentAccount => !!a && typeof a.email === 'string')
      : []
  } catch {
    return []
  }
}

function write(list: RecentAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* storage unavailable — switching still works by typing the email */
  }
}

const norm = (e: string) => e.trim().toLowerCase()

export function rememberAccount(email: string | null | undefined, fullName?: string | null) {
  if (!email) return
  const rest = read().filter((a) => norm(a.email) !== norm(email))
  write([{ email: norm(email), fullName: fullName || null, at: new Date().toISOString() }, ...rest])
}

export function forgetAccount(email: string) {
  write(read().filter((a) => norm(a.email) !== norm(email)))
}

/** Recently used accounts on this device, newest first, without `exceptEmail`. */
export function recentAccounts(exceptEmail?: string | null): RecentAccount[] {
  return read().filter((a) => !exceptEmail || norm(a.email) !== norm(exceptEmail))
}

// ---------- what the login screen should open with after "switch account" ----------
// (kept outside the route state: signing out redirects to /login on its own)
export interface LoginIntent {
  email?: string
  signup?: boolean
}
let intent: LoginIntent | null = null
export const setLoginIntent = (i: LoginIntent | null) => {
  intent = i
}
export const peekLoginIntent = (): LoginIntent | null => intent
