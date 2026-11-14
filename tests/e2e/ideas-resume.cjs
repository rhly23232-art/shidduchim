// End-to-end suite — resume upload / replace / delete from an idea card (linked candidates).
const { login, art, axeSrc } = require('./helpers.cjs')
const { chromium } = require('playwright')
const fs = require('fs')
let fails = 0
const ok = (c, s) => {
  console.log(c ? '✓' : '✗', s)
  if (!c) fails++
}
const pdf = (name, text) => {
  const p = art(name)
  fs.writeFileSync(p, `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n% ${text}\ntrailer<</Root 1 0 R>>\n%%EOF\n`)
  return p
}
;(async () => {
  const b = await chromium.launch()
  const page = await (await b.newContext()).newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  await page.goto(page.url().replace(/\/[^/]*$/, '') + '/ideas')
  await page.getByRole('button', { name: 'רעיון חדש' }).first().waitFor()

  // A fresh idea linked to one בחור, so the test does not depend on seed state.
  await page.getByRole('button', { name: 'רעיון חדש' }).first().click()
  const dlg = page.locator('[role=dialog][data-state=open]').filter({ has: page.getByLabel(/כותרת/) })
  const title = 'בדיקת רזומה ' + Date.now()
  await dlg.getByLabel(/כותרת/).fill(title)
  await dlg.locator('#idea-male').click()
  const opt = page.getByRole('option').nth(1)
  await opt.waitFor()
  await opt.click()
  await dlg.getByRole('button', { name: 'שמירה' }).click()
  await dlg.waitFor({ state: 'hidden' })

  const card = page.locator('main li', { hasText: title }).first()
  const list = card.getByRole('list', { name: /רזומות המועמדים/ })
  ok(await list.waitFor({ timeout: 10000 }).then(() => true, () => false), 'idea card shows a resume row for the linked candidate')
  const row = list.locator('li').first()
  const name = (await row.locator('button').first().innerText()).trim()

  // Start clean: if the sampled candidate already has a resume, delete it first.
  if (!(await row.innerText()).includes('אין רזומה')) {
    await row.getByRole('button', { name: new RegExp('פעולות') }).click()
    await page.getByRole('menuitem', { name: 'מחיקת רזומה' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
    await row.getByText('אין רזומה').waitFor({ timeout: 10000 })
  }
  ok((await row.innerText()).includes('אין רזומה'), `"${name}" starts without a resume`)

  // Upload
  await row.locator('input[type=file]').setInputFiles(pdf('idea-a.pdf', 'first'))
  await row.getByText('idea-a.pdf').waitFor({ timeout: 15000 })
  ok(true, 'upload from the idea card → file name shown in the card')

  // Same resume is visible in the candidate card (shared cache)
  await row.locator('button').first().click()
  const detail = page.locator('[role=dialog][data-state=open]').last()
  await detail.getByText('idea-a.pdf').waitFor({ timeout: 10000 })
  ok(true, 'the candidate card shows the resume uploaded from the idea')
  await page.keyboard.press('Escape')
  await detail.waitFor({ state: 'hidden' })

  // Replace (asks for confirmation)
  await row.locator('input[type=file]').setInputFiles(pdf('idea-b.pdf', 'second'))
  const confirm = page.getByRole('alertdialog')
  await confirm.waitFor()
  ok((await confirm.innerText()).includes('idea-b.pdf'), 'replace asks for confirmation naming the new file')
  await confirm.getByRole('button', { name: /החלפה/ }).click()
  await row.getByText('idea-b.pdf').waitFor({ timeout: 15000 })
  ok(!(await row.innerText()).includes('idea-a.pdf'), 'after replace → only the new file is shown')

  // axe on the card
  await page.addScriptTag({ content: axeSrc })
  const v = await page.evaluate(async (t) => {
    const el = [...document.querySelectorAll('main li')].find((li) => li.textContent.includes(t))
    const r = await window.axe.run(el, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
    return r.violations.map((x) => x.id)
  }, title)
  ok(v.length === 0, 'axe: no violations in the idea card ' + v.join(','))

  // Delete via the menu
  await row.getByRole('button', { name: new RegExp('פעולות') }).click()
  await page.getByRole('menuitem', { name: 'מחיקת רזומה' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
  await row.getByText('אין רזומה').waitFor({ timeout: 10000 })
  ok(true, 'delete from the idea card → "אין רזומה"')

  // An idea with no linked candidate shows the hint that opens the editor
  await card.getByRole('button', { name: 'עריכה' }).click()
  await dlg.locator('#idea-male').click()
  await page.getByRole('option', { name: 'ללא' }).first().click()
  await dlg.getByRole('button', { name: 'שמירה' }).click()
  await dlg.waitFor({ state: 'hidden' })
  const hint = card.getByRole('button', { name: /קשרו בחור או בחורה/ })
  ok(await hint.waitFor({ timeout: 10000 }).then(() => true, () => false), 'unlinked idea shows the link hint')
  await hint.click()
  ok(await dlg.isVisible(), 'the hint opens the idea editor')
  await page.keyboard.press('Escape')

  ok(errors.length === 0, 'errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1) })
