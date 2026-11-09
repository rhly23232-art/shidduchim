// Supabase Edge Function: sends a candidate's resume as a REAL email attachment via Resend.
// Secrets: RESEND_API_KEY (required), RESEND_FROM (e.g. "שידוכים <noreply@your-domain.com>").
// Optional: RESEND_API_URL (defaults to https://api.resend.com/emails — overridable for tests).
// All data access uses the caller's JWT, so Row Level Security still applies.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ATTACHMENT = 10 * 1024 * 1024

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM')
  if (!apiKey || !from) return json({ ok: false, error: 'שירות הדואר אינו מוגדר בשרת' }, 503)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ ok: false, error: 'נדרשת התחברות' }, 401)

  let input: { candidateId?: unknown; to?: unknown; subject?: unknown; body?: unknown }
  try {
    input = await req.json()
  } catch {
    return json({ ok: false, error: 'בקשה לא תקינה' }, 400)
  }
  const { candidateId, to, subject, body } = input
  if (typeof candidateId !== 'string' || !UUID_RE.test(candidateId)) return json({ ok: false, error: 'מזהה מועמד לא תקין' }, 400)
  if (typeof to !== 'string' || !EMAIL_RE.test(to.trim())) return json({ ok: false, error: 'כתובת דואר לא תקינה' }, 400)
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 200) return json({ ok: false, error: 'נושא לא תקין' }, 400)
  if (typeof body !== 'string' || !body.trim() || body.length > 5000) return json({ ok: false, error: 'תוכן לא תקין' }, 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return json({ ok: false, error: 'נדרשת התחברות' }, 401)

  // RLS guarantees the caller can only reach their own candidate.
  const { data: candidate, error: cErr } = await supabase
    .from('candidates')
    .select('id, first_name, last_name')
    .eq('id', candidateId)
    .maybeSingle()
  if (cErr) return json({ ok: false, error: cErr.message }, 500)
  if (!candidate) return json({ ok: false, error: 'המועמד/ת לא נמצא/ה' }, 404)

  const { data: resume } = await supabase
    .from('resumes')
    .select('storage_path, file_name, mime_type, size_bytes')
    .eq('candidate_id', candidateId)
    .maybeSingle()

  const attachments: { filename: string; content: string }[] = []
  if (resume) {
    if (resume.size_bytes > MAX_ATTACHMENT) return json({ ok: false, error: 'הקובץ גדול מדי לשליחה' }, 413)
    const { data: file, error: dlErr } = await supabase.storage.from('resumes').download(resume.storage_path)
    if (dlErr || !file) return json({ ok: false, error: 'לא ניתן לקרוא את קובץ הרזומה' }, 500)
    attachments.push({ filename: resume.file_name, content: toBase64(new Uint8Array(await file.arrayBuffer())) })
  }

  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1b2333">${escapeHtml(body).replace(/\n/g, '<br>')}</div>`
  const res = await fetch(Deno.env.get('RESEND_API_URL') ?? 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to.trim()],
      reply_to: userData.user.email ?? undefined,
      subject: subject.trim(),
      text: body,
      html,
      attachments,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    console.error('resend error', res.status, detail)
    return json({ ok: false, error: 'שליחת המייל נכשלה בשירות הדואר' }, 502)
  }
  const sent = (await res.json()) as { id?: string }
  return json({ ok: true, id: sent.id ?? null, attached: attachments.length > 0 })
})
