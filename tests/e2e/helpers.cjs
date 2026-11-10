// Shared helpers for the end-to-end suites.
//   E2E_BASE_URL  app under test (default http://127.0.0.1:5175)
//   E2E_BACKEND   demo | supabase (supabase: signs in as the seeded demo account)
const fs = require('fs')
const path = require('path')

const base = (process.env.E2E_BASE_URL || 'http://127.0.0.1:5175').replace(/\/$/, '')
const backend = process.env.E2E_BACKEND || 'demo'
const artifacts = path.join(__dirname, '.artifacts')
fs.mkdirSync(artifacts, { recursive: true })

/** Signs in: the demo button locally, the seeded account on Supabase. */
async function login(page, { skipGoto = false } = {}) {
  if (!skipGoto) await page.goto(base + '/login')
  if (backend === 'supabase') {
    await page.fill('input[type=email]', 'demo@shidduchim.local')
    await page.fill('input[type=password]', 'shidduch123')
    await page.click('button[type=submit]')
  } else {
    await page.getByRole('button', { name: 'כניסה לחשבון ההדגמה' }).click()
  }
  await page.waitForSelector('text=פנקס הרעיונות')
}

module.exports = {
  base,
  backend,
  login,
  art: (name) => path.join(artifacts, name),
  fixture: (name) => path.join(__dirname, 'fixtures', name),
  axeSrc: fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'),
}
