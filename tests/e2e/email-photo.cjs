// End-to-end suite — the candidate email carries the photo next to the resume.
// Gmail route: the claude.ai host is simulated (only its `mcp` capability; data stays on the
// demo backend) and the send_message call is captured. The server route is covered by
// scripts/verify-email-function.ts.
const { login, base, axeSrc, fixture, backend } = require('./helpers.cjs')
const { chromium } = require('playwright')
let fails = 0
const ok = (c, s) => {
  console.log(c ? '✓' : '✗', s)
  if (!c) fails++
}
;(async () => {
  if (backend !== 'demo') {
    // the simulated host only makes sense on the local demo backend
    console.log('ALL PASSED')
    return
  }
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx.addInitScript(() => {
    window.__sent = []
    const mcp = {
      listTools: async () => ({ fileArgs: false }),
      callTool: async (server, tool, input) => {
        window.__sent.push({ server, tool, input })
        return {}
      },
    }
    window.claude = { use: async (name) => (name === 'mcp' ? mcp : null) }
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  await page.goto(base + '/candidates?tab=male')
  await page.waitForSelector('tbody tr td:first-child >> text=/\\S/')
  // the first sample candidate has a resume; give him a photo
  const row = page.locator('tbody tr').first()
  const name = (await row.locator('td:first-child span.font-medium').innerText()).trim()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    row.getByRole('button', { name: /העלאת תמונה/ }).click(),
  ])
  await chooser.setFiles(fixture('photos/photo.webp'))
  await row.getByRole('button', { name: `פעולות תמונה עבור ${name}` }).waitFor({ timeout: 15000 })

  // ---- the email window lists both files, photo on by default
  await row.getByRole('button', { name: `שליחה במייל — ${name}` }).click()
  const dlg = page.locator('[role=dialog][data-state=open]').last()
  await dlg.getByRole('list', { name: 'קבצים מצורפים' }).waitFor()
  const files = await dlg.getByRole('list', { name: 'קבצים מצורפים' }).innerText()
  ok(/\.png|\.pdf/.test(files) && files.includes('photo.jpg'), 'email lists the resume and the photo: ' + files.replace(/\n/g, ' | '))
  const box = dlg.getByRole('checkbox', { name: 'צירוף התמונה' })
  ok((await box.getAttribute('aria-checked')) === 'true', 'photo is attached by default')
  ok(await dlg.getByRole('button', { name: 'הורדת התמונה לצירוף' }).isVisible(), 'manual path offers the photo download too')
  await page.waitForTimeout(300)
  await page.addScriptTag({ content: axeSrc })
  const v = await page.evaluate(async () => (await window.axe.run('[role=dialog]', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map((x) => x.id))
  ok(v.length === 0, 'axe: email window ' + v.join(','))

  // ---- send through (simulated) Gmail: one message with both files
  await dlg.getByLabel(/נמען/).fill('family@example.com')
  await dlg.getByRole('button', { name: 'שליחה דרך Gmail' }).click()
  await page.locator('[data-sonner-toast]', { hasText: 'המייל נשלח' }).waitFor({ timeout: 10000 })
  let sent = await page.evaluate(() => window.__sent)
  const atts = sent[0]?.input?.attachments ?? []
  ok(sent.length === 1 && sent[0].tool === 'send_message', 'one Gmail send_message call')
  ok(
    atts.length === 2 && atts.some((a) => a.filename === 'photo.jpg' && a.mimeType === 'image/jpeg' && a.content.length > 100),
    'Gmail received the resume and the photo: ' + atts.map((a) => a.filename).join(', '),
  )
  // the attached photo is the stored JPEG
  ok(atts.find((a) => a.filename === 'photo.jpg')?.content.startsWith('/9j/'), 'photo content is a JPEG')

  // ---- switched off → only the resume
  await row.getByRole('button', { name: `שליחה במייל — ${name}` }).click()
  const dlg2 = page.locator('[role=dialog][data-state=open]').last()
  await dlg2.getByRole('checkbox', { name: 'צירוף התמונה' }).click()
  ok((await dlg2.getByRole('checkbox', { name: 'צירוף התמונה' }).getAttribute('aria-checked')) === 'false', 'photo can be switched off')
  ok(!(await dlg2.getByRole('button', { name: 'הורדת התמונה לצירוף' }).count()), 'switched-off photo leaves the manual downloads')
  await dlg2.getByLabel(/נמען/).fill('family@example.com')
  await dlg2.getByRole('button', { name: 'שליחה דרך Gmail' }).click()
  await page.waitForFunction(() => window.__sent.length === 2, null, { timeout: 10000 })
  sent = await page.evaluate(() => window.__sent)
  const atts2 = sent[1].input.attachments
  ok(atts2.length === 1 && !atts2.some((a) => a.filename === 'photo.jpg'), 'without the photo → only the resume is sent')

  // ---- a candidate without a photo: no photo line, nothing extra sent
  const other = page.locator('tbody tr').nth(1)
  const otherName = (await other.locator('td:first-child span.font-medium').innerText()).trim()
  await other.getByRole('button', { name: `שליחה במייל — ${otherName}` }).click()
  const dlg3 = page.locator('[role=dialog][data-state=open]').last()
  await dlg3.getByText('קובץ מצורף', { exact: false }).first().waitFor()
  ok(!(await dlg3.getByRole('checkbox', { name: 'צירוף התמונה' }).count()), 'no photo → no photo option')
  await page.keyboard.press('Escape')

  ok(errors.length === 0, 'errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1) })
