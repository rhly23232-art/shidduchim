// Integration test for supabase/functions/send-resume-email against a local mock of Resend.
//
// 1. Local stack:            npx supabase start   (+ npx supabase db reset)
// 2. Mock provider + function (two terminals):
//      node scripts/verify-email-function.ts --mock          (mock Resend on :9999)
//      RESEND_API_KEY=test RESEND_FROM="test <noreply@test.local>" \
//      RESEND_API_URL=http://127.0.0.1:9999/emails EMAIL_LIMIT_HOUR=8 PROVIDER_TIMEOUT_MS=1500 \
//      SUPABASE_URL=… SUPABASE_ANON_KEY=… deno run --allow-net --allow-env supabase/functions/send-resume-email/index.ts
// 3. node scripts/verify-email-function.ts   (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
import { createServer } from 'node:http'
import { createClient } from '@supabase/supabase-js'

if (process.argv.includes('--mock')) {
  const state: Record<string, unknown> & {
    count: number
    keys: string[]
    mode: string
    failLeft: number
  } = {
    count: 0,
    keys: [],
    mode: 'ok',
    failLeft: 0,
  }
  createServer((req, res) => {
    if (req.url === '/__state') return void res.end(JSON.stringify(state))
    if (req.url?.startsWith('/__mode')) {
      const u = new URL(req.url, 'http://x')
      state.mode = u.searchParams.get('m') ?? 'ok'
      state.failLeft = Number(u.searchParams.get('n') ?? 0)
      return void res.end('ok')
    }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      state.count++
      state.keys.push(String(req.headers['idempotency-key']))
      const j = JSON.parse(body) as { attachments?: { filename: string; content: string }[] }
      state.last = { attachments: (j.attachments ?? []).map((a) => [a.filename, a.content.length]) }
      if (state.mode === 'fail' && state.failLeft > 0) {
        state.failLeft--
        res.writeHead(503)
        return void res.end('{}')
      }
      if (state.mode === 'hang') return void setTimeout(() => res.end('{"id":"late"}'), 5000)
      if (state.mode === 'reject') {
        res.writeHead(422)
        return void res.end('{"message":"bad"}')
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: 'msg_' + state.count }))
    })
  }).listen(9999, () => console.log('mock Resend on :9999'))
} else {
  const FN = process.env.FUNCTION_URL ?? 'http://127.0.0.1:8000/'
  const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  let fails = 0
  const ok = (c: boolean | undefined, s: string) => {
    console.log(c ? '✓' : '✗', s)
    if (!c) fails++
  }
  const { data: auth } = await sb.auth.signInWithPassword({
    email: 'demo@shidduchim.local',
    password: 'shidduch123',
  })
  const token = auth.session!.access_token
  const { data: cands } = await sb.from('candidates').select('id').limit(1)
  const cid = cands![0]!.id
  const call = (body: Record<string, unknown>, t = token) =>
    fetch(FN, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => ({
      status: r.status,
      body: (await r.json()) as {
        ok?: boolean
        code?: string
        duplicate?: boolean
        attached?: boolean
      },
    }))
  const mock = (q: string) => fetch('http://127.0.0.1:9999' + q).then((r) => r.text())
  const state = async () =>
    JSON.parse(await mock('/__state')) as {
      count: number
      keys: string[]
      last: { attachments: unknown }
    }
  const base = { to: 'family@example.com', subject: 'נושא', body: 'גוף ההודעה' }
  const K1 = crypto.randomUUID()
  let r = await call({ ...base, candidateId: cid, idempotencyKey: K1 })
  ok(r.status === 200 && r.body.ok, 'send resume email → 200 ' + JSON.stringify(r.body))
  let s = await state()
  ok(s.count === 1 && s.keys[0] === K1, 'provider got 1 request with Idempotency-Key')
  r = await call({ ...base, candidateId: cid, idempotencyKey: K1 })
  ok(r.status === 200 && r.body.duplicate === true, 'same key again → duplicate, not re-sent')
  s = await state()
  ok(s.count === 1, 'provider still 1 request')
  const docx = Buffer.from('PK\x03\x04 fake docx').toString('base64')
  r = await call({
    ...base,
    idempotencyKey: crypto.randomUUID(),
    attachment: {
      filename: 'טופס.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      base64: docx,
    },
  })
  ok(r.status === 200 && r.body.attached, 'inline Word attachment → 200 with attachment')
  s = await state()
  ok(JSON.stringify(s.last.attachments).includes('טופס.docx'), 'attachment reached provider')
  await mock('/__mode?m=fail&n=1')
  r = await call({ ...base, candidateId: cid, idempotencyKey: crypto.randomUUID() })
  s = await state()
  ok(
    r.status === 200 && s.count === 4 && s.keys[2] === s.keys[3],
    'provider 503 once → retried with same key → 200',
  )
  await mock('/__mode?m=reject')
  r = await call({ ...base, candidateId: cid, idempotencyKey: crypto.randomUUID() })
  ok(r.status === 502 && r.body.code === 'provider_error', 'provider 422 → 502, no retry')
  await mock('/__mode?m=hang')
  const t0 = Date.now()
  r = await call({ ...base, candidateId: cid, idempotencyKey: crypto.randomUUID() })
  ok(
    r.status === 502 && Date.now() - t0 < 6000,
    `provider hangs → timeout handled in ${Date.now() - t0}ms`,
  )
  // a failed send can be retried with the same key (same dialog) and is delivered once
  await mock('/__mode?m=reject')
  const K2 = crypto.randomUUID()
  r = await call({ ...base, candidateId: cid, idempotencyKey: K2 })
  ok(r.status === 502, 'send fails at the provider → 502')
  await mock('/__mode?m=ok')
  r = await call({ ...base, candidateId: cid, idempotencyKey: K2 })
  ok(
    r.status === 200 && r.body.ok,
    'retry with the same key after a failure → 200 ' + JSON.stringify(r.body),
  )
  // keep sending until the hourly limit (EMAIL_LIMIT_HOUR) answers 429
  let limited = false
  for (let n = 0; n < 10 && !limited; n++) {
    r = await call({ ...base, candidateId: cid, idempotencyKey: crypto.randomUUID() })
    limited = r.status === 429 && r.body.code === 'rate_limited'
  }
  ok(limited, 'hourly limit reached → 429 rate_limited')
  r = await call({ ...base, to: 'not-an-email', candidateId: cid })
  ok(r.status === 400, 'invalid address → 400')
  r = await call({ ...base, candidateId: cid }, 'bad-token')
  ok(r.status === 401, 'bad token → 401')
  r = await call({ ...base, candidateId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() })
  ok(r.status === 404 || r.status === 429, 'unknown candidate → 404 (or rate-limited) ' + r.status)
  const { data: logRows } = await sb.from('email_log').select('status, recipient_domain')
  ok(
    (logRows ?? []).length >= 6 &&
      (logRows ?? []).every(
        (l: { recipient_domain: string }) => l.recipient_domain === 'example.com',
      ),
    `email_log: ${(logRows ?? []).map((l: { status: string }) => l.status).join(',')} — only the domain is stored`,
  )
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  process.exit(fails ? 1 : 0)
}
