// Supabase Edge Function: sends an email with a REAL attachment via Resend —
// either a candidate's stored resume, or one Word document generated in the app (blank form).
//
// Secrets:  RESEND_API_KEY (required), RESEND_FROM (e.g. "שידוכים <noreply@your-domain.com>").
// Optional: RESEND_API_URL (default https://api.resend.com/emails — overridable for tests),
//           ALLOWED_ORIGINS (comma list; default "*"), EMAIL_LIMIT_HOUR (default 30),
//           EMAIL_LIMIT_DAY (default 200).
//
// Guarantees
// - All data access uses the caller's JWT, so Row Level Security applies.
// - Rate limit per user (hour/day), counted in public.email_log (users cannot delete rows).
// - Idempotency: the client sends `idempotencyKey`; a repeated request never sends twice.
// - Provider call has a timeout; one retry on network/5xx/429 with Resend's Idempotency-Key.
// - Structured JSON logs without message bodies, addresses or file contents.
// GET → health check (no secrets returned).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : (allowed[0] ?? '')
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ATTACHMENT = 10 * 1024 * 1024
const MAX_INLINE = 2 * 1024 * 1024
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PROVIDER_TIMEOUT_MS = Number(Deno.env.get('PROVIDER_TIMEOUT_MS') ?? 20_000)
const LIMIT_HOUR = Number(Deno.env.get('EMAIL_LIMIT_HOUR') ?? 30)
const LIMIT_DAY = Number(Deno.env.get('EMAIL_LIMIT_DAY') ?? 200)

type Level = 'info' | 'warn' | 'error'
function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    fn: 'send-resume-email',
    event,
    ...fields,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** POST to Resend with timeout; retries once on network errors, 429 and 5xx. */
async function sendWithResend(apiKey: string, idempotencyKey: string, payload: unknown) {
  const url = Deno.env.get('RESEND_API_URL') ?? 'https://api.resend.com/emails'
  let lastStatus = 0
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // Resend de-duplicates requests with the same key (safe retry)
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      })
      lastStatus = res.status
      if (res.ok)
        return { ok: true as const, id: ((await res.json()) as { id?: string }).id ?? null }
      const retryable = res.status === 429 || res.status >= 500
      log('warn', 'provider_error', { status: res.status, attempt, retryable })
      await res.body?.cancel()
      if (!retryable) return { ok: false as const, status: res.status }
    } catch (e) {
      log('warn', 'provider_unreachable', { attempt, error: String((e as Error)?.name ?? e) })
      lastStatus = 0
    }
    if (attempt === 1) await sleep(800)
  }
  return { ok: false as const, status: lastStatus }
}

Deno.serve(async (req) => {
  const cors = corsFor(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM')
  if (req.method === 'GET') return json({ ok: true, configured: !!apiKey && !!from })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  if (!apiKey || !from)
    return json({ ok: false, error: 'שירות הדואר אינו מוגדר בשרת', code: 'not_configured' }, 503)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ ok: false, error: 'נדרשת התחברות' }, 401)

  let input: {
    candidateId?: unknown
    to?: unknown
    subject?: unknown
    body?: unknown
    attachment?: unknown
    idempotencyKey?: unknown
  }
  try {
    input = await req.json()
  } catch {
    return json({ ok: false, error: 'בקשה לא תקינה' }, 400)
  }
  const { candidateId, to, subject, body, attachment } = input
  const idempotencyKey =
    typeof input.idempotencyKey === 'string' && UUID_RE.test(input.idempotencyKey)
      ? input.idempotencyKey
      : crypto.randomUUID()
  // Either a candidate's stored resume, or one generated Word document from the app (blank form).
  const inline =
    attachment && typeof attachment === 'object'
      ? (attachment as { filename?: unknown; mime?: unknown; base64?: unknown })
      : null
  if (inline) {
    if (typeof inline.filename !== 'string' || !/^[^/\\]{1,120}\.docx$/i.test(inline.filename))
      return json({ ok: false, error: 'שם קובץ לא תקין' }, 400)
    if (inline.mime !== DOCX_MIME) return json({ ok: false, error: 'סוג קובץ לא נתמך' }, 400)
    if (typeof inline.base64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(inline.base64))
      return json({ ok: false, error: 'קובץ לא תקין' }, 400)
    if ((inline.base64.length * 3) / 4 > MAX_INLINE)
      return json({ ok: false, error: 'הקובץ גדול מדי לשליחה' }, 413)
  } else if (typeof candidateId !== 'string' || !UUID_RE.test(candidateId))
    return json({ ok: false, error: 'מזהה מועמד לא תקין' }, 400)
  if (typeof to !== 'string' || !EMAIL_RE.test(to.trim()) || to.length > 254)
    return json({ ok: false, error: 'כתובת דואר לא תקינה' }, 400)
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 200)
    return json({ ok: false, error: 'נושא לא תקין' }, 400)
  if (typeof body !== 'string' || !body.trim() || body.length > 5000)
    return json({ ok: false, error: 'תוכן לא תקין' }, 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return json({ ok: false, error: 'נדרשת התחברות' }, 401)
  const uid = userData.user.id

  // ---- idempotency: a repeated request never sends twice
  const { data: prior } = await supabase
    .from('email_log')
    .select('id, status, provider_id, created_at')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (prior?.status === 'sent') {
    log('info', 'duplicate_request', { user: uid, logId: prior.id })
    return json({ ok: true, id: prior.provider_id, duplicate: true })
  }
  const STALE_MS = 120_000
  if (prior?.status === 'pending' && Date.now() - new Date(prior.created_at).getTime() < STALE_MS)
    return json(
      { ok: false, error: 'השליחה הקודמת עדיין בתהליך. בדקו בעוד דקה.', code: 'in_progress' },
      409,
    )
  // A failed (or abandoned) attempt with the same key is retried on the same log row;
  // the provider's Idempotency-Key still guarantees at most one delivered email.

  // ---- rate limit (per user)
  const since = (ms: number) => new Date(Date.now() - ms).toISOString()
  const [{ count: lastHour }, { count: lastDay }] = await Promise.all([
    supabase
      .from('email_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since(3_600_000)),
    supabase
      .from('email_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since(86_400_000)),
  ])
  if ((lastHour ?? 0) >= LIMIT_HOUR || (lastDay ?? 0) >= LIMIT_DAY) {
    log('warn', 'rate_limited', { user: uid, lastHour, lastDay })
    return json(
      { ok: false, error: 'הגעתם למגבלת השליחה. נסו שוב מאוחר יותר.', code: 'rate_limited' },
      429,
    )
  }

  const attachments: { filename: string; content: string }[] = []
  if (inline) {
    attachments.push({ filename: inline.filename as string, content: inline.base64 as string })
  } else {
    // RLS guarantees the caller can only reach their own candidate.
    const { data: candidate, error: cErr } = await supabase
      .from('candidates')
      .select('id')
      .eq('id', candidateId)
      .maybeSingle()
    if (cErr) {
      log('error', 'db_error', { user: uid, step: 'candidate', code: cErr.code })
      return json({ ok: false, error: 'שגיאת מסד נתונים' }, 500)
    }
    if (!candidate) return json({ ok: false, error: 'המועמד/ת לא נמצא/ה' }, 404)

    const { data: resume } = await supabase
      .from('resumes')
      .select('storage_path, file_name, mime_type, size_bytes')
      .eq('candidate_id', candidateId)
      .maybeSingle()
    if (resume) {
      if (resume.size_bytes > MAX_ATTACHMENT)
        return json({ ok: false, error: 'הקובץ גדול מדי לשליחה' }, 413)
      const { data: file, error: dlErr } = await supabase.storage
        .from('resumes')
        .download(resume.storage_path)
      if (dlErr || !file) {
        log('error', 'storage_error', { user: uid, step: 'resume_download' })
        return json({ ok: false, error: 'לא ניתן לקרוא את קובץ הרזומה' }, 500)
      }
      attachments.push({
        filename: resume.file_name,
        content: toBase64(new Uint8Array(await file.arrayBuffer())),
      })
    }
  }

  const recipient = to.trim()
  let logId: string
  if (prior) {
    logId = prior.id
    await supabase.from('email_log').update({ status: 'pending', error: null }).eq('id', logId)
  } else {
    const { data: row, error: logErr } = await supabase
      .from('email_log')
      .insert({
        idempotency_key: idempotencyKey,
        kind: inline ? 'document' : 'resume',
        candidate_id: inline ? null : candidateId,
        recipient_domain: recipient.split('@')[1]!.toLowerCase(),
      })
      .select('id')
      .single()
    if (logErr || !row) {
      // unique violation = a concurrent duplicate request is already sending
      if (logErr?.code === '23505')
        return json(
          { ok: false, error: 'השליחה הקודמת עדיין בתהליך. בדקו בעוד דקה.', code: 'in_progress' },
          409,
        )
      log('error', 'db_error', { user: uid, step: 'log_insert', code: logErr?.code })
      return json({ ok: false, error: 'שגיאת מסד נתונים' }, 500)
    }
    logId = row.id
  }

  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#2b2622">${escapeHtml(body).replace(/\n/g, '<br>')}</div>`
  const started = Date.now()
  const sent = await sendWithResend(apiKey, idempotencyKey, {
    from,
    to: [recipient],
    reply_to: userData.user.email ?? undefined,
    subject: subject.trim(),
    text: body,
    html,
    attachments,
  })
  await supabase
    .from('email_log')
    .update(
      sent.ok
        ? { status: 'sent', provider_id: sent.id }
        : { status: 'failed', error: `provider status ${sent.status}` },
    )
    .eq('id', logId)

  log(sent.ok ? 'info' : 'error', sent.ok ? 'sent' : 'send_failed', {
    user: uid,
    logId,
    kind: inline ? 'document' : 'resume',
    attachments: attachments.length,
    ms: Date.now() - started,
    status: sent.ok ? 200 : sent.status,
  })
  if (!sent.ok)
    return json(
      {
        ok: false,
        error:
          sent.status === 0
            ? 'לא התקבל אישור משירות הדואר. ייתכן שההודעה נשלחה — שליחה חוזרת מאותו חלון לא תשכפל אותה.'
            : 'שליחת המייל נכשלה בשירות הדואר',
        code: 'provider_error',
      },
      502,
    )
  return json({ ok: true, id: sent.id, attached: attachments.length > 0 })
})
