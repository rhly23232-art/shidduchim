// End-to-end suite — run through tests/e2e/run.cjs (see docs/TESTING.md).
const { login, base, art, axeSrc, fixture } = require('./helpers.cjs')
const { chromium, devices } = require('playwright')
const fs = require('fs')
const { execSync } = require('child_process')
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
  const axe = async (label, sel) => {
    await page.addScriptTag({ content: axeSrc })
    const r = await page.evaluate(
      async (s) =>
        await window.axe.run(s || document, {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        }),
      sel,
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
  let n = 0
  const dl = async (fn) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), fn()])
    const p = art('dl-') + ++n
    await d.saveAs(p)
    const head = fs.readFileSync(p).subarray(0, 4).toString('hex')
    const ext =
      head === '504b0304'
        ? fs.readFileSync(p).includes('xl/workbook.xml')
          ? 'xlsx'
          : 'docx'
        : 'other'
    fs.renameSync(p, p + '.' + ext)
    return p + '.' + ext
  }

  await login(page)
  await page.waitForSelector('text=פנקס הרעיונות')
  // sidebar rows
  ok((await page.getByRole('link', { name: 'מסמכים' }).count()) === 1, 'sidebar: מסמכים row')
  ok(
    (await page.getByRole('link', { name: 'טבלת רזומה' }).count()) === 1,
    'sidebar: טבלת רזומה row',
  )
  await page.getByRole('link', { name: 'מסמכים' }).click()
  await page.waitForSelector('text=מסמך רזומה')
  ok((await page.locator('header h1').innerText()) === 'מסמכים', 'documents page title')
  await page.screenshot({ path: art('documents.png') })
  await axe('documents')
  // blank download
  const blank = await dl(() => page.getByRole('button', { name: 'הורדת טופס ריק' }).click())
  ok(
    /\.docx$/.test(blank) && fs.statSync(blank).size > 1000,
    'blank form downloaded: ' + blank.split('/').pop(),
  )
  ok(
    execSync(`python3 -c "import docx;print(len(docx.Document('${blank}').paragraphs))"`)
      .toString()
      .trim() > 20,
    'blank form opens as Word',
  )
  // send to mother
  await page.getByRole('button', { name: 'שליחה לאמא למילוי' }).click()
  await page.waitForSelector('[role=dialog]')
  await page.waitForTimeout(300)
  await axe('send blank dialog', '[role=dialog]')
  ok(
    (await page.locator('[role=dialog]').innerText()).includes('טופס-רזומה.docx'),
    'send dialog shows attachment',
  )
  await page.locator('#blank-resume-candidate').click()
  await page.waitForTimeout(200)
  await page.getByRole('option', { name: /יוסף כהן/ }).click()
  await page.waitForTimeout(300)
  ok(
    (await page.getByLabel('נושא').inputValue()).includes('יוסף כהן'),
    'picking candidate updates subject',
  )
  ok(
    (await page.getByLabel('תוכן ההודעה').inputValue()).includes('לכבוד משפחת כהן'),
    'body addressed to family',
  )
  await page.getByLabel('כתובת המייל של האם').fill('bad')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /שליחה/ })
    .last()
    .click({ force: true })
    .catch(() => {})
  const manual = await dl(() => page.getByRole('button', { name: 'הורדת הרזומה לצירוף' }).click())
  ok(/\.docx$/.test(manual), 'manual: attachment download works')
  await page.screenshot({ path: art('send-blank.png') })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // editor
  await page.getByRole('link', { name: 'מילוי במערכת' }).click()
  await page.waitForSelector('text=פרטים אישיים')
  await page.evaluate(() => localStorage.removeItem('shidduchim-resume-draft'))
  await page.reload()
  await page.waitForSelector('text=פרטים אישיים')
  ok(
    await page.getByRole('button', { name: 'הורדה כקובץ Word' }).isDisabled(),
    'editor: empty form cannot export',
  )
  await axe('editor')
  await page.locator('#resume-candidate').click()
  await page.waitForTimeout(200)
  await page.getByRole('option', { name: /משה לוי/ }).click()
  await page.waitForTimeout(1000)
  ok((await page.getByLabel('שם מלא').inputValue()) === 'משה לוי', 'editor: auto-filled from card')
  await page.getByLabel('כתובת').fill('רחוב הרב 5')
  await page.getByLabel('תיאור אופי').fill('בחור רציני\nשקדן')
  await page.waitForTimeout(700)
  await page.screenshot({ path: art('editor.png'), fullPage: true })
  await page.reload()
  await page.waitForSelector('text=פרטים אישיים')
  await page.waitForTimeout(400)
  ok(
    (await page.getByLabel('כתובת').inputValue()) === 'רחוב הרב 5',
    'editor: draft survives refresh',
  )
  const filled = await dl(() => page.getByRole('button', { name: 'הורדה כקובץ Word' }).click())
  const txt = execSync(
    `python3 -c "import docx;print('|'.join(p.text for p in docx.Document('${filled}').paragraphs))"`,
  ).toString()
  ok(
    txt.includes('משה לוי') && txt.includes('רחוב הרב 5') && txt.includes('שקדן'),
    'editor: Word contains typed values',
  )
  // attach to card (משה לוי has a resume in samples? confirm replace if needed)
  await page.getByRole('button', { name: 'שמירה כרזומה בכרטיס' }).click()
  await page.waitForTimeout(400)
  if (await page.getByRole('alertdialog').count()) {
    await page.getByRole('alertdialog').getByRole('button', { name: 'החלפה' }).click()
  }
  await page.waitForSelector('text=הרזומה הועלה', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  // email filled
  await page.getByRole('button', { name: 'שליחה במייל' }).click()
  await page.waitForSelector('[role=dialog]')
  ok(
    (await page.locator('[role=dialog]').innerText()).includes('.docx'),
    'editor email: docx attached',
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // resume table
  await page.getByRole('link', { name: 'טבלת רזומה' }).click()
  await page.waitForSelector('table')
  await page.screenshot({ path: art('resume-table.png') })
  await axe('resume table')
  const rowMoshe = page.locator('tr', { hasText: 'משה לוי' })
  ok(
    (await rowMoshe.innerText()).includes('.docx'),
    'resume table: attached resume shows for משה לוי',
  )
  const all = await page.locator('tbody tr').count()
  await page.getByRole('checkbox', { name: 'רק עם רזומה' }).click()
  await page.waitForTimeout(200)
  const withR = await page.locator('tbody tr').count()
  ok(withR > 0 && withR < all, `only-with filter: ${withR}/${all}`)
  await page.getByRole('radio', { name: 'בחורות' }).click()
  await page.waitForTimeout(200)
  ok(
    (await page.locator('tbody tr').allInnerTexts()).every((t) => t.includes('בחורה')),
    'gender filter',
  )
  await page.getByRole('radio', { name: 'הכל' }).click()
  await page.getByRole('checkbox', { name: 'רק עם רזומה' }).click()
  await page.getByRole('searchbox', { name: /חיפוש לפי שם, עיר/ }).fill('לוי')
  await page.waitForTimeout(200)
  ok(
    (await page.locator('tbody tr').count()) >= 1 &&
      (await page.locator('tbody tr').allInnerTexts()).every((t) => t.includes('לוי')),
    'search',
  )
  const res = await dl(() =>
    page
      .locator('tr', { hasText: 'משה לוי' })
      .getByRole('button', { name: /^הורדה/ })
      .click(),
  )
  ok(res.endsWith('.docx'), 'resume download from table: ' + res.split('/').pop())
  await page
    .locator('tr', { hasText: 'משה לוי' })
    .getByRole('button', { name: /^צפייה/ })
    .click()
  await page
    .waitForSelector('[role=dialog] >> text=רחוב הרב 5', { timeout: 10000 })
    .then(() => ok(true, 'viewer renders the generated Word'))
    .catch(() => ok(false, 'viewer renders the generated Word'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.getByRole('searchbox', { name: /חיפוש לפי שם, עיר/ }).fill('')
  const xl = await dl(() => page.getByRole('button', { name: 'ייצוא כל המועמדים לאקסל' }).click())
  const xrows = execSync(
    `python3 -W ignore -c "import openpyxl;ws=openpyxl.load_workbook('${xl}').active;print(ws.max_row, ws.sheet_view.rightToLeft)"`,
  )
    .toString()
    .trim()
  ok(
    xl.endsWith('.xlsx') && xrows.startsWith(String(all + 1)),
    `export all xlsx: rows=${xrows} (candidates ${all})`,
  )
  // filter-bar export is xlsx too
  await page.goto(base + '/candidates?tab=male')
  await page.waitForSelector('tbody tr')
  const xl2 = await dl(() => page.getByRole('button', { name: 'ייצוא לאקסל' }).click())
  ok(xl2.endsWith('.xlsx'), 'table export is xlsx: ' + xl2.split('/').pop())

  // palette entries
  await page
    .getByRole('button', { name: /חיפוש מהיר/ })
    .first()
    .click()
  await page.waitForTimeout(300)
  ok(
    (await page.getByRole('option', { name: 'טבלת רזומה' }).count()) === 1,
    'palette has new pages',
  )
  await page.keyboard.press('Escape')

  // mobile
  const m = await (await b.newContext({ ...devices['iPhone 13 Mini'] })).newPage()
  m.on('pageerror', (e) => errors.push('m ' + e.message))
  await login(m)
  for (const p of ['/documents', '/documents/resume', '/resume-table']) {
    await m.goto(base + p)
    await m.waitForTimeout(800)
    const ov = await m.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    ok(ov <= 0, `mobile ${p} overflow ${ov}`)
    await m.screenshot({ path: art(`m${p.replace(/\//g, '-')}.png`) })
  }
  ok(errors.length === 0, 'console errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => {
  console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | '))
  process.exit(1)
})
