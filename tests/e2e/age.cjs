// End-to-end suite — age without an exact birth date (typed age, grows with time).
const { login, base, axeSrc } = require('./helpers.cjs')
const { chromium } = require('playwright')
let fails = 0
const ok = (c, s) => {
  console.log(c ? '✓' : '✗', s)
  if (!c) fails++
}
;(async () => {
  const b = await chromium.launch()
  const page = await (await b.newContext()).newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  const name = 'בדיקת גיל ' + [...String(Date.now()).slice(-5)].map((d) => 'אבגדהוזחטי'[d]).join('')
  const form = () => page.locator('[role=dialog][data-state=open]').filter({ has: page.locator('input[name=full_name]') })
  const ageInput = () => form().getByLabel('גיל', { exact: true })
  const row = async () => {
    await page.goto(base + '/candidates?tab=male&q=' + encodeURIComponent(name))
    await page.waitForSelector('tbody tr td:first-child >> text=/\\S/')
    return page.locator('tbody tr').first()
  }

  // ---- create with an age only
  await page.goto(base + '/candidates?tab=male')
  await page.getByRole('button', { name: 'הוספת מועמד/ת' }).first().click()
  await page.waitForSelector('input[name=full_name]')
  await page.waitForTimeout(300)
  const box = await ageInput().boundingBox()
  const heb = await form().locator('#heb-date-label').boundingBox()
  ok(box && heb && box.x > heb.x, 'age box comes before the dates (to their right in RTL)')
  await page.locator('input[name=full_name]').fill(name)
  await ageInput().fill('15')
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.waitForTimeout(300)
  ok((await form().innerText()).includes('הגיל צריך להיות בין 16 ל-70'), 'age out of range is refused')
  await ageInput().fill('23')
  await page.addScriptTag({ content: axeSrc })
  const v = await page.evaluate(async () => (await window.axe.run('[role=dialog]', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map((x) => x.id))
  ok(v.length === 0, 'axe: form with the age box ' + v.join(','))
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.waitForSelector(`[role=dialog][data-state=open] h2:has-text("${name}")`, { timeout: 8000 })
  ok(true, 'saved with an age and no birth date')
  await page.keyboard.press('Escape')
  let r = await row()
  ok((await r.locator('td:nth-child(2)').innerText()).trim() === '23', 'table shows the typed age')

  // ---- age filter includes typed ages
  await page.goto(base + '/candidates?tab=male&ageMin=23&ageMax=23&q=' + encodeURIComponent(name))
  await page.waitForSelector('tbody tr td:first-child >> text=/\\S/', { timeout: 8000 }).catch(() => {})
  ok((await page.locator('tbody tr').count()) === 1, 'age filter 23–23 finds the candidate')
  await page.goto(base + '/candidates?tab=male&ageMin=24&ageMax=30&q=' + encodeURIComponent(name))
  await page.waitForTimeout(1200)
  ok((await page.locator('tbody tr', { hasText: name }).count()) === 0, 'age filter 24–30 excludes it')

  // ---- edit: the typed age is shown; a birth date replaces it
  r = await row()
  await r.getByRole('button', { name: new RegExp('לפרטים המלאים של ' + name) }).click()
  await page.getByRole('button', { name: 'עריכה' }).click()
  await page.waitForSelector('input[name=full_name]')
  await page.waitForTimeout(400)
  ok((await ageInput().inputValue()) === '23', 'edit form shows the typed age')
  await page.locator('input[name=birth_date]').fill('2000-01-01')
  await page.waitForTimeout(300)
  const exp = String(new Date().getFullYear() - 2000)
  ok((await ageInput().inputValue()) === exp && (await ageInput().getAttribute('readonly')) !== null,
    'with a birth date the age is computed and read-only: ' + (await ageInput().inputValue()))
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.waitForTimeout(1200)
  await page.keyboard.press('Escape').catch(() => {})
  r = await row()
  ok((await r.locator('td:nth-child(2)').innerText()).trim() === exp, 'table shows the age from the birth date')

  // ---- clean up
  await r.getByRole('button', { name: new RegExp('פעולות נוספות עבור ' + name) }).click()
  await page.getByRole('menuitem', { name: 'מחיקה' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
  await page.waitForTimeout(800)

  ok(errors.length === 0, 'errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1) })
