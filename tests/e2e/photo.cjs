// End-to-end suite — candidate photo: the button opens the file picker, every image type
// is accepted (stored as JPEG), view / replace / delete, non-images refused.
const { login, base, axeSrc, fixture } = require('./helpers.cjs')
const { chromium } = require('playwright')
let fails = 0
const ok = (c, s) => {
  console.log(c ? '✓' : '✗', s)
  if (!c) fails++
}
const FORMATS = ['iphone.heic', 'photo.tiff', 'photo.webp', 'photo.gif', 'photo.bmp', 'photo.avif', 'transparent.png', 'large.jpg']
;(async () => {
  const b = await chromium.launch()
  const page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && /Warning:/.test(m.text()) && errors.push(m.text().slice(0, 160)))
  await login(page)
  await page.goto(base + '/candidates?tab=all')
  await page.waitForSelector('tbody tr td:first-child >> text=/\\S/')
  await page.waitForTimeout(500)
  const toastText = (t) => page.locator('[data-sonner-toast]', { hasText: t }).last()

  // ---- every format, one row each: click opens the file picker immediately
  const rows = page.locator('tbody tr')
  for (let i = 0; i < FORMATS.length; i++) {
    const row = rows.nth(i)
    const name = (await row.locator('td:first-child span.font-medium').innerText()).trim()
    const existing = row.getByRole('button', { name: /פעולות תמונה עבור/ })
    if (await existing.count()) {
      await existing.click()
      await page.getByRole('menuitem', { name: 'מחיקת תמונה' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
      await row.getByRole('button', { name: /העלאת תמונה/ }).waitFor()
    }
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      row.getByRole('button', { name: /העלאת תמונה/ }).click(),
    ])
    if (i === 0) ok(!!chooser, 'clicking "תמונה" opens the computer’s file picker right away')
    await chooser.setFiles(fixture('photos/' + FORMATS[i]))
    const thumb = row.getByRole('button', { name: `פעולות תמונה עבור ${name}` })
    await thumb.waitFor({ timeout: 20000 })
    const img = thumb.locator('img')
    await img.waitFor({ timeout: 10000 })
    const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0)
    ok(loaded, `${FORMATS[i]} → shown as a photo in the table (${name})`)
  }
  await page.waitForTimeout(500)

  // ---- the stored file is a JPEG of at most 1600px
  const first = rows.first()
  const firstName = (await first.locator('td:first-child span.font-medium').innerText()).trim()
  const large = rows.nth(FORMATS.indexOf('large.jpg'))
  await large.getByRole('button', { name: /פעולות תמונה עבור/ }).click()
  await page.getByRole('menuitem', { name: 'הצגת התמונה' }).click()
  const viewer = page.locator('[role=dialog][data-state=open]').last()
  const big = viewer.locator('img')
  await big.waitFor()
  await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, await big.elementHandle())
  const dims = await big.evaluate((el) => [el.naturalWidth, el.naturalHeight])
  ok(dims[0] === 1600 && dims[1] === 1067, 'large photo (3000×2000) stored at 1600×1067: ' + dims.join('×'))
  await page.addScriptTag({ content: axeSrc })
  const v = await page.evaluate(async () => (await window.axe.run('[role=dialog]', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map((x) => x.id))
  ok(v.length === 0, 'axe: photo viewer ' + v.join(','))
  await page.keyboard.press('Escape')

  // ---- not an image → refused with a clear message, nothing stored
  const noPhotoRow = rows.nth(FORMATS.length)
  const [ch2] = await Promise.all([
    page.waitForEvent('filechooser'),
    noPhotoRow.getByRole('button', { name: /העלאת תמונה/ }).click(),
  ])
  await ch2.setFiles(fixture('photos/not-image.pdf'))
  await toastText('שמירת התמונה נכשלה').waitFor({ timeout: 8000 })
  ok((await toastText('שמירת התמונה נכשלה').innerText()).includes('הקובץ אינו תמונה'), 'PDF is refused: "הקובץ אינו תמונה…"')
  ok(await noPhotoRow.getByRole('button', { name: /העלאת תמונה/ }).isVisible(), 'row still has no photo')

  // ---- candidate card: same photo, replace, delete
  await first.getByRole('button', { name: new RegExp('לפרטים המלאים של ' + firstName) }).click()
  const card = page.locator('[role=dialog][data-state=open]').last()
  await card.getByRole('heading', { name: 'תמונה' }).waitFor()
  ok(await card.getByText('iphone.jpg').isVisible(), 'candidate card shows the photo uploaded from the table (HEIC → iphone.jpg)')
  const [ch3] = await Promise.all([page.waitForEvent('filechooser'), card.getByRole('button', { name: 'החלפת תמונה' }).click()])
  await ch3.setFiles(fixture('photos/photo.webp'))
  await card.getByText('photo.jpg').waitFor({ timeout: 15000 })
  ok(true, 'replace from the card → new photo shown')
  await card.getByRole('button', { name: 'מחיקת תמונה' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'מחיקה' }).click()
  await card.getByText('גררו תמונה לכאן או לחצו לבחירה').waitFor({ timeout: 8000 })
  ok(true, 'delete from the card → empty photo area')
  const [ch4] = await Promise.all([page.waitForEvent('filechooser'), card.getByRole('button', { name: /העלאת תמונה/ }).click()])
  ok(!!ch4, 'card upload area opens the file picker')
  await ch4.setFiles(fixture('photos/transparent.png'))
  await card.getByText('transparent.jpg').waitFor({ timeout: 15000 })
  await page.keyboard.press('Escape')

  // ---- next to the resume in an idea card
  await page.goto(base + '/ideas')
  await page.getByRole('list', { name: /רזומות המועמדים/ }).first().waitFor({ timeout: 10000 })
  ok((await page.getByRole('list', { name: /רזומות המועמדים/ }).first().getByRole('button', { name: /תמונה/ }).count()) > 0, 'idea cards show the photo button next to the resume')

  ok(errors.length === 0, 'errors: ' + (errors.join(' | ') || 'none'))
  console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
  await b.close()
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1) })
