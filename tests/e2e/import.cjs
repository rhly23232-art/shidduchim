// End-to-end suite — run through tests/e2e/run.cjs (see docs/TESTING.md).
const { login, base, art, axeSrc, fixture } = require('./helpers.cjs')
const { chromium, devices } = require('playwright')
const fs = require('fs')
let fails = 0
const ok = (c, s) => {
  console.log(c ? '✓' : '✗', s)
  if (!c) fails++
}
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const axe = async (label) => {
    await page.addScriptTag({ content: axeSrc })
    const r = await page.evaluate(
      async () =>
        await window.axe.run(document, {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        }),
    )
    ok(r.violations.length === 0, `axe [${label}] ${r.violations.length}`)
    for (const v of r.violations)
      console.log(
        '   -',
        v.id,
        v.nodes
          .slice(0, 2)
          .map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1])
          .join(' || '),
      )
  }
  await login(page)
  await page.getByRole('link', { name: 'ייבוא מאקסל' }).click()
  await page.waitForSelector('text=גררו לכאן')
  await axe('import step 0')
  const [d] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'הורדת קובץ דוגמה' }).click(),
  ])
  await d.saveAs(art('template.xlsx'))
  ok(fs.statSync(art('template.xlsx')).size > 500, 'template downloaded')
  await page.screenshot({ path: art('import0.png') })
  // xlsx
  await page.locator('input[type=file]').setInputFiles(fixture('candidates-he.xlsx'))
  await page.waitForSelector('text=לאן שייכת כל עמודה')
  const sel = async (h) =>
    page.getByRole('combobox', { name: `שדה במערכת: ${h}`, exact: true }).inputValue()
  const m = {}
  for (const h of [
    'שם',
    'מין',
    'תאריך לידה',
    'תאריך עברי',
    'עיר מגורים',
    'עדה',
    'ישיבה/סמינר',
    'גובה',
    'שם האב',
    'שם האם',
    'טלפון',
    'הערות',
  ])
    m[h] = await sel(h)
  console.log('   mapping', JSON.stringify(m))
  ok(
    m['שם'] === 'full_name' &&
      m['מין'] === 'gender' &&
      m['תאריך לידה'] === 'birth_date' &&
      m['תאריך עברי'] === 'hebrew_birth_date' &&
      m['עיר מגורים'] === 'city' &&
      m['שם האב'] === 'father_name' &&
      m['שם האם'] === 'mother_name' &&
      m['טלפון'] === 'notes_extra',
    'auto mapping',
  )
  await page.screenshot({ path: art('import1.png'), fullPage: true })
  await axe('import mapping')
  await page.getByRole('button', { name: 'המשך' }).click()
  await page.waitForSelector('text=בדיקה לפני ייבוא')
  const txt = await page.locator('main').innerText()
  const num = (label) => Number((txt.split(label)[1] || '').trim().split('\n')[0])
  console.log(
    '   counts',
    num('מוכנים לייבוא'),
    num('כבר קיימים במאגר'),
    num('כפולים בתוך הקובץ'),
    num('שורות עם שגיאה'),
  )
  ok(
    num('מוכנים לייבוא') === 4 &&
      num('כבר קיימים במאגר') === 1 &&
      num('כפולים בתוך הקובץ') === 1 &&
      num('שורות עם שגיאה') === 2,
    'check counts (4 new / 1 existing / 1 in-file / 2 errors: no name, no gender)',
  )
  ok(txt.includes('לא צוין בחור / בחורה') || txt.includes('לא זוהה מין'), 'missing gender reported')
  ok(txt.includes('תאריך לידה לא זוהה: "31/02/2003"'), 'invalid date reported')
  await page.screenshot({ path: art('import2.png'), fullPage: true })
  await axe('import check')
  await page.getByRole('radio', { name: 'לעדכן את הכרטיס הקיים בפרטים מהקובץ' }).click()
  await page.getByRole('button', { name: /^ייבוא \d+ מועמדים/ }).click()
  await page.waitForSelector('text=הייבוא הסתיים', { timeout: 20000 })
  const res = await page.locator('main').innerText()
  console.log(
    '   result',
    res.split('\n').find((l) => l.includes('נוספו')),
  )
  ok(/נוספו 4/.test(res) && /עודכנו 1/.test(res), 'imported 4, updated 1')
  await page.screenshot({ path: art('import3.png') })
  // verify cards
  await page.goto(base + '/candidates?tab=all&q=' + encodeURIComponent('אהרן ברגר'))
  await page.waitForSelector('tbody tr')
  await page.waitForTimeout(800)
  const names = await page.locator('tbody tr td:first-child').allInnerTexts()
  ok(
    names.filter((n) => n.includes('אהרן ברגר')).length === 1,
    'no duplicate created for in-file dup: ' + JSON.stringify(names),
  )
  await page
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: /לפרטים המלאים/ })
    .click()
  await page.waitForSelector('[role=dialog] >> text=מידע אישי מורחב')
  await page.waitForSelector('[role=dialog] >> text=ר׳ משה', { timeout: 5000 }).catch(() => {})
  const det = await page.locator('[role=dialog]').innerText()
  ok(
    det.includes('03.05.2001') &&
      det.includes('180') &&
      det.includes('בעלזא') &&
      det.includes('ר׳ משה') &&
      det.includes('טלפון: 050-1234567'),
    'card fields: date, height m→cm, chassidut, father, extra column in notes',
  )
  await page.keyboard.press('Escape')
  await page.goto(base + '/candidates?tab=female&q=' + encodeURIComponent('רבקה וולף'))
  await page.waitForSelector('tbody tr')
  await page
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: /לפרטים המלאים/ })
    .click()
  await page.waitForSelector('[role=dialog] >> text=מידע אישי מורחב')
  const det2 = await page.locator('[role=dialog]').innerText()
  ok(
    /באב תשס/.test(det2) && /2002/.test(det2) && det2.includes('ליטא'),
    'hebrew date converted + eda ליטא',
  )
  await page.keyboard.press('Escape')
  await page.goto(base + '/candidates?tab=male&q=' + encodeURIComponent('יוסף כהן'))
  await page.waitForSelector('tbody tr')
  await page
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: /לפרטים המלאים/ })
    .click()
  await page.waitForSelector('[role=dialog] >> text=מידע אישי מורחב')
  const det3 = await page.locator('[role=dialog]').innerText()
  ok(
    det3.includes('עדכון מהקובץ') && det3.includes('ישיבת מיר'),
    'update merged notes, kept existing fields',
  )
  await page.keyboard.press('Escape')
  // csv windows-1255 with all-male mode? file has gender column
  await page.goto(base + '/import')
  await page.locator('input[type=file]').setInputFiles(fixture('candidates-windows1255.csv'))
  await page.waitForSelector('text=לאן שייכת כל עמודה')
  ok((await page.locator('main').innerText()).includes('מנחם לנדאו'), 'windows-1255 CSV decoded')
  await page.getByRole('button', { name: 'המשך' }).click()
  await page.waitForSelector('text=בדיקה לפני ייבוא')
  await page.getByRole('button', { name: /^ייבוא 2 מועמדים/ }).click()
  await page.waitForSelector('text=הייבוא הסתיים')
  await page.goto(base + '/candidates?tab=all&q=' + encodeURIComponent('מנחם לנדאו'))
  await page.waitForSelector('tbody tr')
  await page
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: /לפרטים המלאים/ })
    .click()
  await page.waitForSelector('[role=dialog] >> text=מידע אישי מורחב')
  const detailText = await page.locator('[role=dialog]').innerText()
  ok(
    /גיל\s*\n?\s*24/.test(detailText) && !/תאריך לידה לועזי\s*\n?\s*\d/.test(detailText),
    'age-only row → stored as age 24, no invented birth date',
  )
  // bad file types
  fs.writeFileSync(art('old.xls'), 'x')
  await page.goto(base + '/import')
  await page.locator('input[type=file]').setInputFiles(art('old.xls'))
  await page.waitForTimeout(500)
  ok((await page.locator('body').innerText()).includes('xls) אינו נתמך'), 'old .xls explained')
  // mobile
  const mp = await (await b.newContext({ ...devices['iPhone 13 Mini'] })).newPage()
  await login(mp)
  await mp.goto(base + '/import')
  await mp.waitForTimeout(600)
  await mp.locator('input[type=file]').setInputFiles(fixture('candidates-he.xlsx'))
  await mp.waitForSelector('text=לאן שייכת כל עמודה')
  ok(
    (await mp.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )) <= 0,
    'mobile mapping no page overflow',
  )
  await mp.screenshot({ path: art('m-import.png') })
  ok(errors.length === 0, 'console errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => {
  console.error('FAIL', e.message.split('\n').slice(0, 4).join(' | '))
  process.exit(1)
})
