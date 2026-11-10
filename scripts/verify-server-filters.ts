// Parity check: the server-side עדה filter (used above 5,000 candidates) must return exactly
// the cards the client-side rule (edaOf) puts in each group. Needs a running Supabase with data:
//   npx supabase start && npx supabase db reset && node scripts/verify-server-filters.ts
import { createClient } from '@supabase/supabase-js'
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
console.log(fails ? `FAILED ${fails}` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
