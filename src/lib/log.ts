/**
 * Client-side observability.
 * - Every unexpected error goes through `logError` with a category, so diagnostics can tell
 *   a user mistake from a provider outage or a data-consistency problem.
 * - Entries are redacted (emails, tokens, phone numbers) before they are kept anywhere.
 * - Last 200 entries stay in memory for the support report (Help → "דוח תקלות").
 * - Optional: VITE_ERROR_ENDPOINT — errors are POSTed there (sendBeacon) as JSON lines.
 */
import { backendMode } from './api'

export type ErrorKind =
  | 'user' // the person can fix it (validation, conflict, wrong password)
  | 'recoverable' // transient (network, timeout) — retrying usually works
  | 'provider' // an external service failed (email, Gmail, storage)
  | 'data' // a consistency guard stopped an action (nothing was changed)
  | 'system' // a bug / unexpected state

export interface LogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  kind?: ErrorKind
  event: string
  message: string
  context?: Record<string, unknown>
}

const MAX = 200
const buffer: LogEntry[] = []

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
const TOKEN = /\b(eyJ[\w-]+\.[\w-]+\.[\w-]+|(?:sk|re|pk)_[A-Za-z0-9_]{12,}|[A-Fa-f0-9]{32,})\b/g
const PHONE = /\b0\d{1,2}-?\d{7}\b/g

export function redact(s: string): string {
  return s.replace(TOKEN, '[token]').replace(EMAIL, '[email]').replace(PHONE, '[phone]')
}

function redactDeep(v: unknown, depth = 0): unknown {
  if (depth > 4) return '[…]'
  if (typeof v === 'string') return redact(v).slice(0, 500)
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => redactDeep(x, depth + 1))
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => !/password|token|secret|authorization|apikey/i.test(k))
        .slice(0, 30)
        .map(([k, x]) => [k, redactDeep(x, depth + 1)]),
    )
  return v
}

const endpoint = (import.meta.env.VITE_ERROR_ENDPOINT as string | undefined)?.trim() || null

function ship(entry: LogEntry) {
  if (!endpoint || entry.level !== 'error') return
  try {
    const body = JSON.stringify({
      ...entry,
      app: APP_VERSION,
      backend: backendMode(),
      url: location.pathname,
    })
    if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' })))
      void fetch(endpoint, {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      })
  } catch {
    /* reporting must never break the app */
  }
}

export function log(entry: Omit<LogEntry, 'at'>) {
  const e: LogEntry = {
    ...entry,
    at: new Date().toISOString(),
    message: redact(entry.message).slice(0, 1000),
    context: entry.context ? (redactDeep(entry.context) as Record<string, unknown>) : undefined,
  }
  buffer.push(e)
  if (buffer.length > MAX) buffer.shift()
  const line = `[${e.level}]${e.kind ? `[${e.kind}]` : ''} ${e.event}: ${e.message}`
  if (e.level === 'error') console.error(line, e.context ?? '')
  else if (e.level === 'warn') console.warn(line, e.context ?? '')
  ship(e)
}

/** Category of an error, from its type / code / message. */
export function classify(err: unknown): ErrorKind {
  const e = err as { name?: string; code?: string | number; status?: number; message?: string }
  const msg = String(e?.message ?? err ?? '')
  if (e?.code === 'conflict' || e?.name === 'ZodError') return 'user'
  if (e?.name === 'JournalError') return 'data'
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError' || e?.code === 'timeout')
    return 'recoverable'
  if (err instanceof TypeError && /fetch|network|load failed/i.test(msg)) return 'recoverable'
  if (e?.status === 429 || e?.code === 'rate_limited') return 'user'
  if (typeof e?.status === 'number' && e.status >= 500) return 'provider'
  if (
    /StorageApiError|FunctionsHttpError|FunctionsFetchError|resend|gmail/i.test(`${e?.name} ${msg}`)
  )
    return 'provider'
  if (/JWT|session|not authenticated|auth/i.test(msg)) return 'user'
  return 'system'
}

export function logError(event: string, err: unknown, context?: Record<string, unknown>) {
  const e = err as { name?: string; code?: unknown; message?: string; stack?: string }
  log({
    level: 'error',
    kind: classify(err),
    event,
    message: e?.message ? `${e.name ?? 'Error'}: ${e.message}` : String(err),
    context: { ...context, code: e?.code, stack: e?.stack?.split('\n').slice(0, 6).join('\n') },
  })
}

export const recentLog = (): LogEntry[] => [...buffer]

let installed = false
/** Catches errors that escape every handler (bugs, failed lazy chunks, rejected promises). */
export function installGlobalHandlers() {
  if (installed) return
  installed = true
  window.addEventListener('error', (ev) =>
    logError('window.error', ev.error ?? ev.message, { source: ev.filename, line: ev.lineno }),
  )
  window.addEventListener('unhandledrejection', (ev) => logError('unhandledrejection', ev.reason))
}

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
