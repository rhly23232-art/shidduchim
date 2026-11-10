import { authApi, backendMode, dataApi } from '@/lib/api'
import { env } from '@/lib/env'
import { saveFile, todayStamp } from '@/lib/files/save'
import { APP_VERSION, recentLog, redact } from '@/lib/log'

interface Check {
  name: string
  ok: boolean
  ms: number
  detail?: string
}

async function timed(name: string, fn: () => Promise<string | undefined>): Promise<Check> {
  const t = performance.now()
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout 10s')), 10_000)),
    ])
    return { name, ok: true, ms: Math.round(performance.now() - t), detail: detail || undefined }
  } catch (e) {
    return {
      name,
      ok: false,
      ms: Math.round(performance.now() - t),
      detail: redact(String((e as Error)?.message ?? e)),
    }
  }
}

/** Live health checks of everything the app depends on (no personal data). */
export async function healthChecks(): Promise<Check[]> {
  const checks: Check[] = [
    await timed('auth session', async () =>
      (await authApi.getUser()) ? 'signed in' : 'signed out',
    ),
    await timed('database read', async () => {
      const c = await dataApi.countCandidates()
      return `candidates: ${c.male + c.female}`
    }),
    await timed(
      'history journal',
      async () => `entries (last 5): ${(await dataApi.journal.list({ limit: 5 })).length}`,
    ),
  ]
  if (backendMode() === 'supabase' && env.supabaseUrl && env.supabaseAnonKey) {
    checks.push(
      await timed('email function', async () => {
        const r = await fetch(`${env.supabaseUrl}/functions/v1/send-resume-email`, {
          headers: { apikey: env.supabaseAnonKey!, Authorization: `Bearer ${env.supabaseAnonKey}` },
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = (await r.json()) as { configured?: boolean }
        if (!j.configured) throw new Error('deployed but RESEND_API_KEY / RESEND_FROM missing')
        return 'configured'
      }),
    )
  }
  return checks
}

/** A JSON file the user can send to support: environment, health, recent (redacted) errors. */
export async function downloadSupportReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    app: APP_VERSION,
    backend: backendMode(),
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    page: location.pathname,
    health: await healthChecks(),
    recentLog: recentLog(),
  }
  const name = `דוח-תקלות-${todayStamp()}.json`
  await saveFile(name, new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  return name
}
