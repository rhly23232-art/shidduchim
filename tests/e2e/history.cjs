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
  const open = async (name) => {
    await page.goto(base + '/candidates?tab=all&q=' + encodeURIComponent(name))
    await page.waitForTimeout(700)
    await page
      .locator('tbody tr', { hasText: name })
      .first()
      .getByRole('button', { name: /לפרטים המלאים/ })
      .click()
    await page.waitForSelector('[role=dialog] >> text=מידע אישי מורחב')
    await page.waitForTimeout(500)
  }
  await login(page)
  ok(
    (await page.getByRole('link', { name: /גיבוי ושחזור — מומלץ לגבות/ }).count()) === 1,
    'sidebar: backup row with "recommended" reminder',
  )

  // ---- edit → history → revert
  await open('יוסף כהן')
  await page.getByRole('button', { name: 'עריכה' }).click()
  await page.waitForSelector('input[name=city]')
  await page.locator('input[name=city]').fill('צפת')
  await page.locator('input[name=height_cm]').fill('181')
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.waitForTimeout(1200)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(300)
  await open('יוסף כהן')
  await page.getByRole('button', { name: 'היסטוריית שינויים' }).click()
  await page.waitForSelector('text=היסטוריית שינויים – יוסף כהן')
  await page.waitForTimeout(500)
  const hist = await page.getByRole('dialog').last().innerText()
  ok(
    /2 שדות שונו/.test(hist) &&
      hist.includes('ירושלים') &&
      hist.includes('צפת') &&
      hist.includes('178') &&
      hist.includes('181'),
    'history shows field changes before→after',
  )
  await page.screenshot({ path: art('history.png') })
  await axe('history panel', '[role=dialog]:last-of-type')
  await page.getByRole('button', { name: 'חזרה למצב שלפני השינוי' }).first().click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'חזרה למצב שלפני השינוי' })
    .click()
  await page.waitForTimeout(1500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.goto(base + '/candidates?tab=all&q=' + encodeURIComponent('יוסף כהן'))
  await page.waitForTimeout(800)
  ok(
    (await page.locator('tbody tr', { hasText: 'יוסף כהן' }).first().innerText()).includes(
      'ירושלים',
    ),
    'revert restored city',
  )

  // ---- delete (has resume + idea link) → trash → restore
  await open('חיים וייס')
  const hadResume = (await page.locator('[role=dialog]').innerText()).includes('.png')
  await page.getByRole('button', { name: /למחוק את חיים וייס/ }).click()
  ok(
    (await page.getByRole('alertdialog').innerText()).includes('סל המחזור'),
    'delete confirm mentions recycle bin',
  )
  await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
  await page.waitForTimeout(1500)
  await page.goto(base + '/ideas')
  await page.waitForTimeout(800)
  const ideaBefore = await page.locator('li', { hasText: 'לחשוב על חיים וייס' }).innerText()
  ok(!ideaBefore.includes('חיים וייס\n'), 'idea lost its link after delete')
  await page.getByRole('link', { name: /גיבוי ושחזור/ }).click()
  await page.waitForSelector('text=סל מחזור')
  await page.waitForTimeout(800)
  const trash = await page.locator('main').innerText()
  ok(
    trash.includes('חיים וייס') && trash.includes('עוד 30 ימים'),
    'trash lists deleted candidate with days left',
  )
  await page.screenshot({ path: art('backup.png'), fullPage: true })
  await axe('backup page')
  await page
    .locator('li', { hasText: 'חיים וייס' })
    .filter({ hasText: 'עוד 30' })
    .getByRole('button', { name: 'שחזור' })
    .click()
  await page.waitForSelector('text=חיים וייס שוחזר/ה', { timeout: 10000 })
  await page.waitForTimeout(800)
  ok(
    !(await page.locator('main li', { hasText: 'חיים וייס' }).count()) ||
      !(await page.locator('main').innerText())
        .split('סל מחזור')[1]
        .split('פעולות אחרונות')[0]
        .includes('חיים וייס'),
    'removed from trash',
  )
  await open('חיים וייס')
  const d = await page.locator('[role=dialog]').innerText()
  ok(d.includes('ישיבת עטרת ישראל'), 'restored card fields')
  ok(!hadResume || d.includes('.png'), 'restored resume file (' + hadResume + ')')
  await page.keyboard.press('Escape')
  await page.goto(base + '/ideas')
  await page.waitForTimeout(800)
  ok(
    (await page.locator('li', { hasText: 'לחשוב על חיים וייס' }).innerText()).includes('חיים וייס'),
    'idea re-linked to restored candidate',
  )

  // ---- delete a candidate WITH a resume → restore brings the file back
  await open('אברהם פרידמן')
  const fileBefore = ((await page.locator('[role=dialog]').innerText()).match(/[^\n]*\.png/) || [
    '',
  ])[0]
  await page.getByRole('button', { name: /למחוק את אברהם פרידמן/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
  await page.waitForTimeout(1500)
  await page.goto(base + '/backup')
  await page.waitForTimeout(800)
  ok(
    !fileBefore ||
      (
        await page
          .locator('li', { hasText: 'אברהם פרידמן' })
          .filter({ hasText: 'עוד 30' })
          .innerText()
      ).includes('כולל רזומה'),
    'trash marks entry with resume',
  )
  await page
    .locator('li', { hasText: 'אברהם פרידמן' })
    .filter({ hasText: 'עוד 30' })
    .getByRole('button', { name: 'שחזור' })
    .click()
  await page.waitForSelector('text=אברהם פרידמן שוחזר/ה', { timeout: 10000 })
  await open('אברהם פרידמן')
  ok(
    !fileBefore || (await page.locator('[role=dialog]').innerText()).includes(fileBefore.trim()),
    'resume file restored: ' + (fileBefore.trim() || '(no resume in seed)'),
  )
  await page.keyboard.press('Escape')

  // ---- idea delete → restore
  await page.goto(base + '/ideas')
  await page.waitForTimeout(800)
  await page
    .locator('li', { hasText: 'לברר על בחורים' })
    .getByRole('button', { name: 'מחיקה' })
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
  await page.waitForTimeout(800)
  await page.goto(base + '/backup')
  await page.waitForTimeout(800)
  await page
    .locator('li', { hasText: 'לברר על בחורים' })
    .filter({ hasText: 'עוד 30' })
    .getByRole('button', { name: 'שחזור' })
    .click()
  await page.waitForTimeout(1000)
  await page.goto(base + '/ideas')
  await page.waitForTimeout(800)
  ok(
    (await page.locator('li', { hasText: 'לברר על בחורים' }).count()) === 1,
    'idea restored from trash',
  )

  // ---- activity
  await page.goto(base + '/backup')
  await page.waitForTimeout(800)
  const act = (await page.locator('main').innerText()).split('פעולות אחרונות')[1] || ''
  ok(
    act.includes('שוחזר') && act.includes('עודכן') && act.includes('יוסף כהן'),
    'activity log lists actions',
  )

  // ---- backup → wipe one → restore
  await page.goto(base + '/candidates?tab=all')
  await page.waitForTimeout(900)
  const total = await page.locator('tbody tr').count()
  await page.goto(base + '/backup')
  await page.waitForTimeout(800)
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: 'הורדת גיבוי מלא' }).click(),
  ])
  const zp = art('backup.zip')
  await dl.saveAs(zp)
  const info = execSync(
    `python3 -c "import zipfile,json;z=zipfile.ZipFile('${zp}');d=json.loads(z.read('backup.json'));print(len(d['candidates']),len(d['ideas']),len([n for n in z.namelist() if n.startswith('resumes/')]))"`,
  )
    .toString()
    .trim()
  console.log('   backup', info)
  ok(info.startsWith(`${total} 3`), `backup has all ${total} candidates and 3 ideas: ` + info)
  ok(!(await page.getByRole('link', { name: /מומלץ לגבות/ }).count()), 'reminder gone after backup')
  // delete two candidates then purge from trash, then restore from file
  for (const n of ['שרה גרינברג', 'מנחם שטרן']) {
    await open(n)
    await page.getByRole('button', { name: new RegExp(`למחוק את ${n}`) }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
    await page.waitForTimeout(1000)
  }
  await page.goto(base + '/backup')
  await page.waitForTimeout(800)
  await page.locator('input[type=file][accept=".zip"]').setInputFiles(zp)
  await page.waitForTimeout(800)
  const pv = await page.locator('main').innerText()
  ok(
    pv.includes(`${total} מועמדים`) && pv.includes(`${total - 2} מהמועמדים כבר נמצאים`),
    `restore preview: ${total - 2} of ${total} exist`,
  )
  await page.getByRole('button', { name: 'שחזור 2 מועמדים חסרים' }).click()
  await page.waitForSelector('text=שוחזרו 2 מועמדים', { timeout: 20000 })
  await page.goto(base + '/candidates?tab=all')
  await page.waitForTimeout(900)
  const names = await page.locator('tbody tr td:first-child').allInnerTexts()
  ok(
    names.length === total &&
      names.some((n) => n.includes('שרה גרינברג')) &&
      names.some((n) => n.includes('מנחם שטרן')),
    `restore from file brought back exactly the missing 2 (total ${total})`,
  )

  // mobile
  const mp = await (await b.newContext({ ...devices['iPhone 13 Mini'] })).newPage()
  await login(mp)
  await mp.goto(base + '/backup')
  await mp.waitForTimeout(900)
  ok(
    (await mp.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )) <= 0,
    'mobile backup no overflow',
  )
  await mp.screenshot({ path: art('m-backup.png'), fullPage: true })
  ok(errors.length === 0, 'console errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => {
  console.error('FAIL', e.message.split('\n').slice(0, 4).join(' | '))
  process.exit(1)
})
