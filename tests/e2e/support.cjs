// End-to-end suite — run through tests/e2e/run.cjs (see docs/TESTING.md).
const { login, art } = require('./helpers.cjs')
const { chromium } = require('playwright')
const fs = require('fs')
let fails = 0
const ok = (c, s) => {
  console.log(c ? '✓' : '✗', s)
  if (!c) fails++
}
;(async () => {
  const b = await chromium.launch()
  const page = await (await b.newContext({ acceptDownloads: true })).newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  await page.getByRole('button', { name: 'תפריט משתמש' }).click()
  ok(
    /v\d+\.\d+\.\d+\+/.test(await page.getByRole('menu').innerText()),
    'user menu shows the app version',
  )
  const [d] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'דוח תקלות לתמיכה' }).click(),
  ])
  const p = art('support-report.json')
  await d.saveAs(p)
  const raw = fs.readFileSync(p, 'utf8')
  const r = JSON.parse(raw)
  ok(r.app && r.backend && r.browser?.userAgent, 'report has version, backend and browser')
  const byName = Object.fromEntries(r.health.map((h) => [h.name, h]))
  ok(
    byName['auth session']?.ok && byName['database read']?.ok && byName['history journal']?.ok,
    'health checks pass: ' + r.health.map((h) => `${h.name}=${h.ok}`).join(', '),
  )
  ok(!/יוסף כהן|demo@shidduchim/.test(raw), 'report contains no candidate names or account email')
  ok(errors.length === 0, 'errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => {
  console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | '))
  process.exit(1)
})
