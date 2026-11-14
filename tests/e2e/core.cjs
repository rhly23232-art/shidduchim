// End-to-end suite — run through tests/e2e/run.cjs (see docs/TESTING.md).
const { login, base, art, axeSrc, fixture } = require('./helpers.cjs')
const { chromium, devices } = require('playwright')
let fails = 0
const ok = (cond, s) => {
  console.log(cond ? '✓' : '✗', s)
  if (!cond) fails++
}
;(async () => {
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const axe = async (label, ctx) => {
    await page.addScriptTag({ content: axeSrc })
    const res = await page.evaluate(
      async (c) =>
        await window.axe.run(c || document, {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        }),
      ctx,
    )
    ok(res.violations.length === 0, `axe [${label}] violations: ${res.violations.length}`)
    for (const v of res.violations)
      console.log(
        '   -',
        v.id,
        v.impact,
        v.nodes.length,
        v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1])
          .join(' || '),
      )
  }
  const names = async () =>
    await page.locator('tbody tr td:first-child span.font-medium').allInnerTexts()
  const waitRows = () => page.waitForSelector('tbody tr td:first-child >> text=/\\S/')

  // ---- login
  await page.goto(base + '/login')
  await page.waitForSelector('input[type=email]')
  await page.waitForTimeout(300)
  await axe('login')
  await page.getByRole('button', { name: 'כניסה', exact: true }).click()
  await page.waitForTimeout(300)
  ok((await page.locator('[role=alert]').count()) > 0, 'login validation shows errors')
  await login(page, { skipGoto: true })
  await axe('home')

  // ---- home navigation
  await page
    .getByRole('link', { name: /בחורות/ })
    .first()
    .click()
  await waitRows()
  ok(page.url().includes('tab=female'), 'home card → female table')
  await axe('table female')

  // ---- tabs (keyboard)
  await page.getByRole('tab', { name: 'טבלת בחורות' }).focus()
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300)
  ok(page.url().includes('tab=all'), 'tabs: ArrowLeft (RTL forward) → all')
  ok(
    await page.evaluate(
      () =>
        document.activeElement?.getAttribute('role') === 'tab' &&
        document.activeElement?.getAttribute('aria-selected') === 'true',
    ),
    'tabs: focus follows selection',
  )
  await page.getByRole('tab', { name: 'טבלת בחורים' }).click()
  await waitRows()

  // ---- search
  await page.locator('[role=search] input').fill('כהן')
  await page.waitForTimeout(700)
  ok(
    (await names()).every((n) => n.includes('כהן')),
    'search filters rows: ' + (await names()).join(', '),
  )
  ok(page.url().includes('q='), 'search synced to URL')
  await page
    .getByRole('button', { name: 'ניקוי החיפוש' })
    .click()
    .catch(() => {})
  await page.goto(base + '/candidates?tab=male')
  await waitRows()

  // ---- sort
  await page.getByRole('button', { name: /^גיל —/ }).click()
  await page.waitForTimeout(400)
  const ages = (await page.locator('tbody tr td:nth-child(2)').allInnerTexts()).map(Number)
  ok(
    ages.every((a, i) => i === 0 || ages[i - 1] <= a),
    'sort by age asc: ' + ages.join(','),
  )
  ok((await page.locator('th[aria-sort=ascending]').count()) === 1, 'aria-sort set')

  // ---- filters: age popover, location multi-select, eda
  await page.goto(base + '/candidates?tab=male')
  await waitRows()
  await page.getByRole('button', { name: /^עיר \/ אזור/ }).click()
  await page.waitForTimeout(300)
  await axe('location popover', '[data-radix-popper-content-wrapper]')
  await page.getByRole('option', { name: 'ירושלים' }).first().click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok(decodeURIComponent(page.url()).includes('city=ירושלים'), 'location filter → URL')
  ok(
    (await page.getByRole('button', { name: /הסרת הסינון/ }).count()) >= 1 ||
      (await page.locator('text=ירושלים').count()) > 0,
    'filter chip visible',
  )
  await page.getByRole('button', { name: 'עדה', exact: true }).click()
  await page.waitForTimeout(300)
  await page.getByRole('radio', { name: 'ליטא' }).click()
  await page.waitForTimeout(400)
  await axe('eda popover', '[data-radix-popper-content-wrapper]')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok(page.url().includes('eda=litai'), 'eda filter → URL')
  await page.screenshot({ path: art('filters-active.png') })
  await page.getByRole('button', { name: /איפוס/ }).first().click()
  await page.waitForTimeout(400)
  ok(!page.url().includes('eda=') && !page.url().includes('city='), 'reset clears filters')
  await page.getByRole('button', { name: /^גיל/ }).first().click()
  await page.waitForTimeout(300)
  await page.fill('#age-min', '24')
  await page.waitForTimeout(700)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok(page.url().includes('ageMin=24'), 'age filter → URL')
  const ages2 = (await page.locator('tbody tr td:nth-child(2)').allInnerTexts()).map(Number)
  ok(ages2.length > 0 && ages2.every((a) => a >= 24), 'age filter rows: ' + ages2.join(','))
  await page.goto(base + '/candidates?tab=male')
  await waitRows()

  // ---- create
  await page.getByRole('button', { name: 'הוספת מועמד/ת' }).first().click()
  await page.waitForSelector('input[name=full_name]')
  await page.waitForTimeout(400)
  await axe('form', '[role=dialog]')
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.waitForTimeout(300)
  ok((await page.locator('[role=dialog] [role=alert]').count()) > 0, 'form: required validation')
  await page.getByRole('radio', { name: 'בחורה' }).click()
  ok(
    (await page.locator('input[name=gender]').inputValue()) === 'female',
    'form: gender radio sets value',
  )
  await page.getByRole('radio', { name: 'בחור', exact: true }).click()
  await page.locator('input[name=full_name]').fill('בדיקת עיצוב חדש')
  await page.locator('input[name=city]').fill('צפת')
  await page.locator('input[name=institution]').fill('ישיבת הבדיקה')
  await page.getByRole('radio', { name: 'חסידות' }).click()
  await page.locator('#form-eda-detail').fill('ויז׳ניץ')
  await page.locator('input[name=birth_date]').fill('2002-05-01')
  await page.waitForTimeout(200)
  ok(
    (await page.locator('#heb-date-year option:checked').innerText()).length > 0,
    'gregorian → hebrew date synced',
  )
  await page.getByRole('switch', { name: 'מידע נוסף' }).click()
  await page.locator('input[name="family.father_name"]').fill('ר׳ אברהם')
  await page.screenshot({ path: art('form-filled.png') })
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.waitForSelector('[role=dialog][data-state=open] h2:has-text("בדיקת עיצוב חדש")', {
    timeout: 8000,
  })
  const t = await page.locator('[role=dialog][data-state=open]').last().innerText()
  ok(
    /צפת/.test(t) && /ויז׳ניץ/.test(t) && /ר׳ אברהם/.test(t),
    'create: saved & opened detail with all fields',
  )
  await axe('detail', '[role=dialog]')

  // ---- edit
  await page.getByRole('button', { name: 'עריכה' }).click()
  await page.waitForTimeout(500)
  await page.locator('input[name=city]').fill('טבריה')
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.waitForTimeout(1200)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)
  await page.goto(base + '/candidates?tab=male&q=' + encodeURIComponent('בדיקת עיצוב'))
  await waitRows()
  ok(
    (await page.locator('tbody tr').first().innerText()).includes('טבריה'),
    'edit: city updated in table',
  )

  // ---- row actions menu + delete
  await page.getByRole('button', { name: /פעולות נוספות עבור בדיקת עיצוב חדש/ }).click()
  await page.waitForTimeout(300)
  await axe('row menu', '[role=menu]')
  await page.getByRole('menuitem', { name: 'מחיקה' }).click()
  await page.waitForTimeout(300)
  await axe('confirm delete', '[role=alertdialog]')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /מחיקה|מחק/ })
    .click()
  await page.waitForTimeout(800)
  ok(
    (await page.locator('tbody >> text=בדיקת עיצוב חדש').count()) === 0,
    'delete: removed from table',
  )

  // ---- modal open / close / focus return (keyboard)
  await page.goto(base + '/candidates?tab=male')
  await waitRows()
  const btn = page
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: /לפרטים המלאים/ })
  await btn.focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector('[role=dialog]')
  ok(page.url().includes('c='), 'detail: URL has c=')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  ok(
    await page.evaluate(() =>
      (document.activeElement?.getAttribute('aria-label') || '').startsWith('לפרטים המלאים'),
    ),
    'detail: focus returns to trigger',
  )

  // ---- ideas
  await page.goto(base + '/ideas')
  await page.waitForTimeout(800)
  await axe('ideas')
  await page.getByRole('button', { name: 'רעיון חדש' }).first().click()
  await page.waitForTimeout(300)
  await page.getByRole('dialog').getByRole('button', { name: 'שמירה' }).click()
  await page.waitForTimeout(200)
  ok((await page.locator('[role=dialog] [role=alert]').count()) > 0, 'idea: required validation')
  await axe('idea editor', '[role=dialog]')
  await page.getByLabel(/כותרת/).fill('רעיון בדיקה לעיצוב')
  await page.getByRole('dialog').getByRole('button', { name: 'שמירה' }).click()
  await page.waitForTimeout(700)
  const card = page.locator('li', { hasText: 'רעיון בדיקה לעיצוב' })
  ok((await card.count()) === 1, 'idea: created')
  await card.getByRole('button', { name: /הצמדה/ }).click()
  await page.waitForTimeout(500)
  ok((await card.locator('text=מוצמד').count()) === 1, 'idea: pinned')
  await card.getByRole('button', { name: 'סימון כטופל' }).click()
  await page.waitForTimeout(500)
  ok(
    (await page.locator('li', { hasText: 'רעיון בדיקה לעיצוב' }).count()) === 0,
    'idea: done hides it',
  )
  await page.getByRole('button', { name: /הצגת/ }).click()
  await page.waitForTimeout(400)
  const card2 = page.locator('li', { hasText: 'רעיון בדיקה לעיצוב' })
  ok((await card2.locator('text=טופל').count()) >= 1, 'idea: shown as done with badge')
  await axe('ideas with done')
  await card2.getByRole('button', { name: 'מחיקה' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
  await page.waitForTimeout(600)
  ok((await page.locator('li', { hasText: 'רעיון בדיקה לעיצוב' }).count()) === 0, 'idea: deleted')

  // ---- palette, sidebar, design system
  await page
    .getByRole('button', { name: /חיפוש מהיר|חיפוש מועמדים/ })
    .first()
    .click()
  await page.waitForTimeout(400)
  ok((await page.getByRole('dialog').count()) === 1, 'command palette opens')
  await axe('palette', '[role=dialog]')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'סגירת תפריט' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: art('rail.png') })
  await axe('icon rail')
  await page.getByRole('button', { name: 'פתיחת תפריט' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'תפריט משתמש' }).click()
  await page.waitForTimeout(300)
  ok(!(await page.getByRole('menuitem', { name: /מערכת העיצוב/ }).count()), 'user menu no longer lists the design system')
  await page.keyboard.press('Escape')
  await page.goto(base + '/design-system')
  await page.waitForTimeout(800)
  ok(page.url().includes('/design-system'), 'design system page still reachable by address')
  await axe('design system')
  await page.getByRole('button', { name: 'Toast הצלחה' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: art('toast.png') })
  await page.getByRole('button', { name: 'מגירה' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: art('drawer.png') })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // ---- responsive
  for (const [label, vp] of [
    ['laptop 1280', { width: 1280, height: 800 }],
    ['tablet 820', { width: 820, height: 1180 }],
  ]) {
    const p2 = await b.newPage({ viewport: vp })
    await login(p2)
    for (const path of [
      '/',
      '/candidates?tab=male',
      '/candidates?tab=all',
      '/ideas',
      '/design-system',
    ]) {
      await p2.goto(base + path)
      await p2.waitForTimeout(700)
      const ov = await p2.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      ok(ov <= 0, `${label} ${path} horizontal overflow ${ov}`)
    }
    await p2.goto(base + '/candidates?tab=male')
    await p2.waitForTimeout(700)
    await p2.screenshot({ path: art(`${label.split(' ')[0]}-table.png`) })
    await p2.close()
  }
  const ctx = await b.newContext({ ...devices['iPhone 13 Mini'] })
  const m = await ctx.newPage()
  m.on('pageerror', (e) => errors.push('mobile ' + e.message))
  await login(m)
  await m.screenshot({ path: art('m-home.png') })
  for (const path of [
    '/',
    '/candidates?tab=male',
    '/candidates?tab=all',
    '/ideas',
    '/design-system',
  ]) {
    await m.goto(base + path)
    await m.waitForTimeout(800)
    const ov = await m.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    ok(ov <= 0, `mobile ${path} horizontal overflow ${ov}`)
  }
  await m.goto(base + '/candidates?tab=male')
  await m.waitForSelector('article')
  await m.screenshot({ path: art('m-list.png') })
  await m.getByRole('button', { name: 'פתיחת מסננים' }).click()
  await m.waitForTimeout(500)
  await m.screenshot({ path: art('m-filters.png') })
  await m.keyboard.press('Escape')
  await m.waitForTimeout(400)
  await m.getByRole('button', { name: 'פתיחת תפריט' }).click()
  await m.waitForTimeout(500)
  await m.screenshot({ path: art('m-drawer.png') })
  await m.keyboard.press('Escape')
  await m.waitForTimeout(400)
  await m
    .locator('article')
    .first()
    .getByRole('button', { name: /לפרטים המלאים/ })
    .click()
  await m.waitForTimeout(600)
  await m.screenshot({ path: art('m-detail.png') })
  const ovd = await m.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  ok(ovd <= 0, 'mobile detail overflow ' + ovd)
  await m.keyboard.press('Escape')
  await m.waitForTimeout(400)
  await m.getByRole('button', { name: 'הוספת מועמד/ת' }).first().click()
  await m.waitForTimeout(600)
  await m.screenshot({ path: art('m-form.png') })

  ok(errors.length === 0, 'console/runtime errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED: ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => {
  console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | '))
  process.exit(1)
})
