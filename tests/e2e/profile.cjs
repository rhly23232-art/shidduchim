// End-to-end suite — profile menu: switch account, support, invite a friend.
const { login, base, backend, axeSrc } = require('./helpers.cjs')
const { chromium } = require('playwright')
let fails = 0
const ok = (c, s) => {
  console.log(c ? '✓' : '✗', s)
  if (!c) fails++
}
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext()
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const axe = async (label, sel) => {
    if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: axeSrc })
    const v = await page.evaluate(async (s) => (await window.axe.run(s || document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map((x) => x.id), sel)
    ok(v.length === 0, `axe [${label}] ${v.join(',')}`)
  }
  const menu = async () => {
    await page.getByRole('button', { name: 'תפריט משתמש' }).click()
    await page.getByRole('menu').waitFor()
  }
  const dialog = () => page.locator('[role=dialog][data-state=open]').last()
  await login(page)

  // ---- menu contents
  await menu()
  const items = await page.getByRole('menuitem').allInnerTexts()
  ok(['החלפת חשבון', 'תמיכה ועזרה', 'שיתוף חבר'].every((x) => items.some((i) => i.includes(x))), 'menu has switch / support / invite')
  ok(!items.some((i) => /החשבון שלי|דוח תקלות|מערכת העיצוב/.test(i)), 'removed items are gone: ' + items.join(' | '))

  // ---- support
  await page.getByRole('menuitem', { name: 'תמיכה ועזרה' }).click()
  await dialog().getByRole('heading', { name: 'שאלות נפוצות' }).waitFor()
  await dialog().locator('summary').first().click()
  ok(await dialog().locator('details[open]').count() === 1, 'FAQ answer opens')
  ok(await dialog().getByRole('button', { name: 'הורדת דוח תקלות' }).isVisible(), 'support has the diagnostic report')
  await axe('support dialog', '[role=dialog]')
  await page.keyboard.press('Escape')

  // ---- invite a friend
  await menu()
  await page.getByRole('menuitem', { name: 'שיתוף חבר' }).click()
  const text = await dialog().locator('textarea').inputValue()
  ok(text.includes('שידוכים') && text.includes(new URL(base).origin), 'invite text includes the app link')
  const wa = await dialog().getByRole('link', { name: 'וואטסאפ' }).getAttribute('href')
  ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('שידוכים'), 'WhatsApp link carries the message')
  await dialog().getByRole('button', { name: 'העתקה' }).click()
  await page.locator('[data-sonner-toast]', { hasText: 'ההזמנה הועתקה' }).waitFor({ timeout: 5000 })
  ok((await page.evaluate(() => navigator.clipboard.readText())).includes('שידוכים'), 'copy puts the invite on the clipboard')
  await axe('invite dialog', '[role=dialog]')
  await page.keyboard.press('Escape')

  // ---- switch account: create a second account, then switch back to the first
  const me = backend === 'supabase' ? 'demo@shidduchim.local' : 'demo@shidduchim.local'
  await menu()
  await page.getByRole('menuitem', { name: 'החלפת חשבון' }).click()
  ok((await dialog().innerText()).includes(me), 'switch dialog shows the current account')
  await page.waitForTimeout(400)
  await axe('switch dialog', '[role=dialog]')
  await dialog().getByRole('button', { name: 'יצירת חשבון חדש' }).click()
  await page.getByLabel('שם מלא').waitFor()
  ok(page.url().includes('/login'), 'create new account → sign-up screen')
  const email2 = `switch-${Date.now()}@example.com`
  await page.getByLabel('שם מלא').fill('חשבון שני')
  await page.getByLabel('דואר אלקטרוני').fill(email2)
  await page.getByLabel(/^סיסמה/).first().fill('Switch-12345')
  await page.locator('button[type=submit]').click()
  await page.getByRole('button', { name: 'תפריט משתמש' }).waitFor({ timeout: 15000 })
  await menu()
  ok((await page.getByRole('menu').innerText()).includes(email2), 'now signed in as the second account')
  await page.getByRole('menuitem', { name: 'החלפת חשבון' }).click()
  const back = dialog().getByRole('button', { name: /מעבר לחשבון של/ }).first()
  ok((await back.innerText()).includes(me), 'the first account is offered for switching')
  await back.click()
  await page.waitForSelector('input[type=password]')
  ok((await page.locator('input[type=email]').inputValue()) === me, 'login form is pre-filled with the chosen email')
  ok(await page.evaluate(() => document.activeElement?.getAttribute('type') === 'password'), 'focus is on the password')
  await page.fill('input[type=password]', 'shidduch123')
  await page.click('button[type=submit]')
  await page.getByRole('button', { name: 'תפריט משתמש' }).waitFor({ timeout: 15000 })
  await menu()
  ok((await page.getByRole('menu').innerText()).includes(me), 'switched back to the first account')
  await page.keyboard.press('Escape')

  ok(errors.length === 0, 'errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1) })
