#!/usr/bin/env node
// Runs the end-to-end suites one after another and fails if any check fails.
//   node tests/e2e/run.cjs [suite ...]      (default: all)
// The app must already be running at E2E_BASE_URL (see docs/TESTING.md).
const { spawnSync } = require('child_process')
const path = require('path')

const ALL = ['core', 'documents', 'import', 'history', 'concurrency', 'support', 'account']
const suites = process.argv.slice(2).length ? process.argv.slice(2) : ALL
let failed = 0
const t0 = Date.now()
for (const s of suites) {
  const started = Date.now()
  const r = spawnSync(process.execPath, [path.join(__dirname, `${s}.cjs`)], {
    encoding: 'utf8',
    env: process.env,
    timeout: 10 * 60_000,
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const passed = (out.match(/^✓/gm) ?? []).length
  const fails = (out.match(/^✗/gm) ?? []).length
  const ok = r.status === 0 && fails === 0 && /ALL PASSED/.test(out)
  if (!ok) {
    failed++
    console.log(
      out
        .split('\n')
        .filter((l) => !l.startsWith('✓'))
        .join('\n'),
    )
  }
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${s.padEnd(12)} ${passed} checks${fails ? `, ${fails} failed` : ''}  ${((Date.now() - started) / 1000).toFixed(1)}s`,
  )
}
console.log(
  `\n${failed ? `${failed} suite(s) failed` : 'All suites passed'} in ${((Date.now() - t0) / 1000).toFixed(0)}s (${process.env.E2E_BACKEND || 'demo'} @ ${process.env.E2E_BASE_URL || 'http://127.0.0.1:5175'})`,
)
process.exit(failed ? 1 : 0)
