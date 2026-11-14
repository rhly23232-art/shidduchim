// End-to-end suite — moving a candidate to the opposite table (drag to tab / sidebar, menu, undo).
const { login, base } = require('./helpers.cjs')
const { chromium } = require('playwright')
let fails = 0
const ok = (c, s) => {
  console.log(c ? '✓' : '✗', s)
  if (!c) fails++
}
;(async () => {
  const b = await chromium.launch()
  const page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  const open = async (tab, q) => {
    await page.goto(base + `/candidates?tab=${tab}` + (q ? '&q=' + encodeURIComponent(q) : ''))
    await page.waitForSelector('tbody tr td:first-child >> text=/\\S/', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
  const inTable = async (tab, name) => {
    await open(tab, name)
    return (await page.locator('tbody tr', { hasText: name }).count()) > 0
  }
  const toast = () => page.locator('[data-sonner-toast]').last()
  const drag = async (row, target, check) => {
    const a = await row.locator('td').nth(1).boundingBox()
    const t = await target.boundingBox()
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 4, { steps: 3 })
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 12 })
    if (check) await check()
    await page.mouse.up()
  }

  // ---- drag a בחור onto the בחורות tab
  await open('male')
  const row = page.locator('tbody tr').first()
  const name = (await row.locator('td:first-child span.font-medium').innerText()).trim()
  const femaleTab = page.getByRole('tab', { name: 'בחורות' })
  const maleTab = page.getByRole('tab', { name: 'בחורים' })
  await drag(row, femaleTab, async () => {
    const cls = await femaleTab.getAttribute('class')
    ok(/bg-accent/.test(cls) && /outline-brand/.test(cls), 'hovered opposite tab is highlighted')
    ok(!/outline-brand|outline-dashed/.test((await maleTab.getAttribute('class')) || ''), 'same-gender tab is not a target')
  })
  await toast().waitFor({ timeout: 8000 })
  ok((await toast().innerText()).includes(`${name} הועבר/ה לטבלת הבחורות`), 'toast confirms the move: ' + name)
  ok(/animate-drop-flash/.test((await femaleTab.getAttribute('class')) || ''), 'target flashes after the drop')
  await page.waitForTimeout(800)
  ok((await page.locator('tbody tr', { hasText: name }).count()) === 0, 'row left the בחורים table')

  // ---- undo from the toast
  await toast().getByRole('button', { name: 'ביטול' }).click()
  await page.locator('[data-sonner-toast]', { hasText: 'ההעברה בוטלה' }).waitFor({ timeout: 8000 })
  ok(await inTable('male', name), 'undo → back in the בחורים table')

  // ---- drag onto the sidebar item
  await open('male', name)
  const side = page.locator('nav a', { hasText: 'בחורות' }).first()
  await drag(page.locator('tbody tr', { hasText: name }).first(), side)
  await page.locator('[data-sonner-toast]', { hasText: 'הועבר/ה לטבלת הבחורות' }).last().waitFor({ timeout: 8000 })
  ok(await inTable('female', name), 'drag to sidebar → appears in the בחורות table')

  // ---- keyboard / menu path back
  await page.getByRole('button', { name: new RegExp('פעולות נוספות עבור ' + name) }).click()
  await page.getByRole('menuitem', { name: 'העברה לטבלת הבחורים' }).click()
  await page.locator('[data-sonner-toast]', { hasText: 'הועבר/ה לטבלת הבחורים' }).last().waitFor({ timeout: 8000 })
  ok(await inTable('male', name), 'row menu → moved back to בחורים')

  // ---- history records the change
  await page.getByRole('button', { name: new RegExp('לפרטים המלאים של ' + name) }).click()
  await page.getByRole('button', { name: /היסטוריית שינויים/ }).click()
  await page.waitForTimeout(800)
  const hist = await page.locator('[role=dialog][data-state=open]').last().innerText()
  ok(/בחור \/ בחורה/.test(hist), 'history shows the gender change')

  ok(errors.length === 0, 'errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1) })
