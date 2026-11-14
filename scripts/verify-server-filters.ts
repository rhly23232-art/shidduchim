// Parity check: the server-side עדה filter (used above 5,000 candidates) must return exactly
// the cards the client-side rule (edaOf) puts in each group. Needs a running Supabase with data:
//   npx supabase start && npx supabase db reset && node scripts/verify-server-filters.ts
import { createClient } from '@supabase/supabase-js'
import { effectiveAge } from '../src/lib/age.ts'
import { EDA_KEYS, edaOf, edaServerFilter } from '../src/lib/eda.ts'

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})
await sb.auth.signInWithPassword({ email: 'demo@shidduchim.local', password: 'shidduch123' })

type Row = {
  id: string
  eda: (typeof EDA_KEYS)[number] | null
  community: string | null
  chassidut: string | null
}
async function all(filter?: string): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    let q = sb
      .from('candidates_view')
      .select('id, eda, community, chassidut')
      .order('id')
      .range(from, from + 999)
    if (filter) q = q.or(filter)
    const { data, error } = await q
    if (error) throw error
    out.push(...(data as Row[]))
    if (data.length < 1000) break
  }
  return out
}

let fails = 0
const everyone = await all()
console.log(`${everyone.length} candidates`)
for (const key of EDA_KEYS) {
  const expected = new Set(everyone.filter((r) => edaOf(r) === key).map((r) => r.id))
  const got = new Set((await all(edaServerFilter(key))).map((r) => r.id))
  const missing = [...expected].filter((id) => !got.has(id)).length
  const extra = [...got].filter((id) => !expected.has(id)).length
  const ok = missing === 0 && extra === 0
  if (!ok) fails++
  console.log(
    `${ok ? '✓' : '✗'} ${key}: client ${expected.size} · server ${got.size}${ok ? '' : ` (missing ${missing}, extra ${extra})`}`,
  )
}
// ---- age: the view's `age` (filters + sort above 5,000) must equal effectiveAge() in the app,
// including typed ages recorded in the past (they grow by one each year).
const ymd = (yearsAgo: number, days = 0) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - yearsAgo)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
const temp: string[] = []
for (const [years, recorded] of [
  [22, ymd(0)],
  [22, ymd(3, -1)], // 3 years and a day ago → 25
  [30, ymd(1, 1)], // a day short of a year → still 30
] as const) {
  const { data, error } = await sb.rpc('save_candidate', {
    payload: {
      candidate: {
        gender: 'male',
        first_name: 'בדיקת',
        last_name: 'גיל',
        status: 'active',
        age_years: years,
        age_recorded_on: recorded,
      },
    },
  })
  if (error) throw error
  temp.push(data as string)
}
try {
  const rows: {
    id: string
    birth_date: string | null
    age_years: number | null
    age_recorded_on: string | null
    age: number | null
  }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('candidates_view')
      .select('id, birth_date, age_years, age_recorded_on, age')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data as typeof rows))
    if (data.length < 1000) break
  }
  const bad = rows.filter((r) => r.age !== effectiveAge(r))
  const typed = rows
    .filter((r) => temp.includes(r.id))
    .map((r) => r.age)
    .sort()
  const ok = bad.length === 0 && JSON.stringify(typed) === JSON.stringify([22, 25, 30])
  if (!ok) fails++
  console.log(
    `${ok ? '✓' : '✗'} age: ${rows.length} rows, server = client${bad.length ? ` (${bad.length} differ)` : ''}; typed ages → ${typed.join(', ')}`,
  )
} finally {
  await sb.from('candidates').delete().in('id', temp)
}

console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
