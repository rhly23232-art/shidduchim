// End-to-end suite — run through tests/e2e/run.cjs (see docs/TESTING.md).
const { login, base, art, axeSrc, fixture } = require('./helpers.cjs')
const { chromium } = require('playwright')
let fails = 0
const ok = (c, s) => {
  console.log(c ? '✓' : '✗', s)
  if (!c) fails++
}
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p1 = await ctx.newPage()
  const errors = []
  p1.on('pageerror', (e) => errors.push(e.message))
  await login(p1)
  const p2 = await ctx.newPage()
  p2.on('pageerror', (e) => errors.push(e.message))
  const openEdit = async (p) => {
    await p.goto(base + '/candidates?tab=all&q=' + encodeURIComponent('יוסף כהן'))
    await p.waitForTimeout(900)
    await p
      .locator('tbody tr', { hasText: 'יוסף כהן' })
      .first()
      .getByRole('button', { name: /לפרטים המלאים/ })
      .click()
    await p.waitForSelector('[role=dialog] >> text=מידע אישי מורחב')
    await p.waitForTimeout(600)
    await p.getByRole('button', { name: 'עריכה' }).click()
    await p.waitForSelector('input[name=city]')
  }
  await openEdit(p1)
  await openEdit(p2)
  await p2.locator('input[name=city]').fill('חיפה')
  await p2.getByRole('button', { name: 'שמירה' }).click()
  await p2.waitForTimeout(1500)
  ok(
    (await p2.locator('body').innerText()).includes('נשמר') ||
      !(await p2.locator('input[name=city]').count()),
    'window 2 saved',
  )
  await p1.locator('input[name=height_cm]').fill('185')
  await p1.getByRole('button', { name: 'שמירה' }).click()
  const dlg = p1.getByRole('alertdialog')
  await dlg.waitFor({ timeout: 8000 }).catch(() => {})
  ok(
    (await dlg.count()) === 1 && (await dlg.innerText()).includes('עודכן בינתיים'),
    'window 1: stale save refused → conflict dialog',
  )
  await p1.screenshot({ path: art('conflict.png') })
  await dlg.getByRole('button', { name: 'חזרה לטופס' }).click()
  await p1.waitForTimeout(300)
  ok(
    (await p1.locator('input[name=height_cm]').inputValue()) === '185',
    '"back to form" keeps the typed changes',
  )
  await p1.getByRole('button', { name: 'שמירה' }).click()
  await p1.getByRole('alertdialog').waitFor()
  await p1.getByRole('alertdialog').getByRole('button', { name: 'שמירה בכל זאת' }).click()
  await p1.waitForTimeout(1800)
  await p1.goto(base + '/candidates?tab=all&q=' + encodeURIComponent('יוסף כהן'))
  await p1.waitForTimeout(900)
  await p1
    .locator('tbody tr', { hasText: 'יוסף כהן' })
    .first()
    .getByRole('button', { name: /לפרטים המלאים/ })
    .click()
  await p1.waitForSelector('[role=dialog] >> text=מידע אישי מורחב')
  await p1.waitForTimeout(800)
  const t = await p1.locator('[role=dialog]').innerText()
  ok(t.includes('185'), 'overwrite saved window 1 values')
  await p1.getByRole('button', { name: 'היסטוריית שינויים' }).click()
  await p1.waitForTimeout(1200)
  const h = await p1.getByRole('dialog').last().innerText()
  ok(h.includes('חיפה') && h.includes('185'), 'both saves are in the history (nothing lost)')
  ok(errors.length === 0, 'errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => {
  console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | '))
  process.exit(1)
})
