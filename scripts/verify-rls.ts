/**
 * Verifies Row Level Security with two matchmaker accounts against a running Supabase.
 * Usage: node --env-file=.env.local scripts/verify-rls.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')

let failures = 0
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}
const client = () => createClient(url, key, { auth: { persistSession: false } })

const a = client()
const { error: aErr } = await a.auth.signInWithPassword({
  email: 'demo@shidduchim.local',
  password: 'shidduch123',
})
if (aErr) throw aErr
const aId = (await a.auth.getUser()).data.user!.id

const b = client()
const emailB = `rls-${Date.now()}@shidduchim.local`
const { error: bErr } = await b.auth.signUp({ email: emailB, password: 'Test-12345' })
if (bErr) throw bErr

const aRows = await a.from('candidates_view').select('id, owner_id')
check('A sees own candidates', (aRows.data?.length ?? 0) >= 20, `${aRows.data?.length} rows`)
check(
  'A sees only own rows',
  (aRows.data ?? []).every((r) => r.owner_id === aId),
)
const targetId = aRows.data![0]!.id!

const bRows = await b.from('candidates_view').select('id')
check('B sees none of A’s candidates', bRows.data?.length === 0, `${bRows.data?.length} rows`)
const bFam = await b.from('family_details').select('candidate_id')
check('B sees no family_details', bFam.data?.length === 0)
const bInLaws = await b.from('in_laws').select('id')
check('B sees no in_laws', bInLaws.data?.length === 0)

const upd = await b.from('candidates').update({ first_name: 'פרוץ' }).eq('id', targetId).select()
check('B cannot update A’s candidate', (upd.data?.length ?? 0) === 0)
const del = await b.from('candidates').delete().eq('id', targetId).select()
check('B cannot delete A’s candidate', (del.data?.length ?? 0) === 0)
const ins = await b
  .from('candidates')
  .insert({ owner_id: aId, gender: 'male', first_name: 'x', last_name: 'y' })
check('B cannot insert rows owned by A', !!ins.error)
const famIns = await b
  .from('in_laws')
  .insert({ candidate_id: targetId, relation: 'גיס', full_name: 'x' })
check('B cannot attach in-laws to A’s candidate', !!famIns.error)
const rpc = await b.rpc('save_candidate', {
  payload: { id: targetId, candidate: { gender: 'male', first_name: 'x', last_name: 'y' } },
})
check('B cannot overwrite via save_candidate RPC', !!rpc.error, rpc.error?.message)

// B creates own candidate via RPC
const own = await b.rpc('save_candidate', {
  payload: {
    candidate: { gender: 'female', first_name: 'בדיקה', last_name: 'RLS', education_history: [] },
    family: { siblings_count: 3 },
    in_laws: [{ relation: 'גיס', full_name: 'בדיקה', details: '' }],
  },
})
check(
  'B can create own candidate via RPC',
  !own.error && typeof own.data === 'string',
  own.error?.message,
)
const bAfter = await b.from('candidates_view').select('id, age')
check('B now sees exactly 1 candidate', bAfter.data?.length === 1)

// Storage isolation
const bUid = (await b.auth.getUser()).data.user!.id
const pdf = new Blob(['%PDF-1.4\n%test\n'], { type: 'application/pdf' })
const aPath = `${aId}/${targetId}/rls-test.pdf`
const upA = await a.storage
  .from('resumes')
  .upload(aPath, pdf, { upsert: true, contentType: 'application/pdf' })
check('A can upload into own folder', !upA.error, upA.error?.message)
const dlB = await b.storage.from('resumes').download(aPath)
check('B cannot download A’s file', !!dlB.error)
const signB = await b.storage.from('resumes').createSignedUrl(aPath, 60)
check('B cannot sign A’s file', !!signB.error)
const upB = await b.storage.from('resumes').upload(`${aId}/${targetId}/evil.pdf`, pdf)
check('B cannot upload into A’s folder', !!upB.error)
const upB2 = await b.storage.from('resumes').upload(`${bUid}/${targetId}/evil.pdf`, pdf)
check('B cannot upload under A’s candidate in own folder', !!upB2.error)
const badType = await a.storage
  .from('resumes')
  .upload(`${aId}/${targetId}/x.txt`, new Blob(['hi'], { type: 'text/plain' }), {
    contentType: 'text/plain',
  })
check('Bucket rejects disallowed MIME type', !!badType.error, badType.error?.message)
const big = new Blob([new Uint8Array(10 * 1024 * 1024 + 10)], { type: 'application/pdf' })
const tooBig = await a.storage
  .from('resumes')
  .upload(`${aId}/${targetId}/big.pdf`, big, { contentType: 'application/pdf' })
check('Bucket rejects file > 10MB', !!tooBig.error, tooBig.error?.message)
await a.storage.from('resumes').remove([aPath])

// Ideas isolation
const aIdeas = await a.from('ideas').select('id')
check('A sees own ideas', (aIdeas.data?.length ?? 0) >= 3, `${aIdeas.data?.length} rows`)
const bIdeas = await b.from('ideas').select('id')
check('B sees none of A’s ideas', bIdeas.data?.length === 0)
const bIdeaUpd = await b.from('ideas').update({ title: 'x' }).eq('id', aIdeas.data![0]!.id).select()
check('B cannot change A’s idea', (bIdeaUpd.data?.length ?? 0) === 0)
const bIdeaLink = await b.from('ideas').insert({ title: 'x', male_id: targetId })
check('B cannot link an idea to A’s candidate', !!bIdeaLink.error)

// History / recycle bin isolation (table `journal`, bucket `journal`)
// `journal` is newer than the generated types: use an untyped handle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is newer than the generated types
const ja = a as unknown as { from(t: string): any; storage: typeof a.storage }
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is newer than the generated types
const jb = b as unknown as { from(t: string): any; storage: typeof b.storage }
const jIns = await ja
  .from('journal')
  .insert({ kind: 'edit', candidate_id: targetId, title: 'בדיקה', data: { changes: [] } })
  .select()
  .single()
check('A can write own history entry', !jIns.error, jIns.error?.message)
const jSeeB = await jb.from('journal').select('id')
check('B sees none of A’s history', (jSeeB.data?.length ?? 0) === 0)
const jDelB = await jb.from('journal').delete().eq('id', jIns.data?.id).select()
check('B cannot delete A’s history entry', (jDelB.data?.length ?? 0) === 0)
const jForge = await jb
  .from('journal')
  .insert({ owner_id: aId, kind: 'edit', title: 'x', data: {} })
check('B cannot write history as A', !!jForge.error)
const jUpd = await ja.from('journal').update({ title: 'x' }).eq('id', jIns.data?.id).select()
check('History entries are append-only (no update)', !!jUpd.error || (jUpd.data?.length ?? 0) === 0)
const jPath = `${aId}/${jIns.data?.id}/resume.pdf`
const jUp = await ja.storage.from('journal').upload(jPath, pdf, { contentType: 'application/pdf' })
check('A can keep a deleted file in own journal folder', !jUp.error, jUp.error?.message)
const jDl = await jb.storage.from('journal').download(jPath)
check('B cannot read A’s kept file', !!jDl.error)
const jUpB = await jb.storage
  .from('journal')
  .upload(`${aId}/x/evil.pdf`, pdf, { contentType: 'application/pdf' })
check('B cannot write into A’s journal folder', !!jUpB.error)
await ja.storage.from('journal').remove([jPath])
await ja.from('journal').delete().eq('id', jIns.data?.id)

// Email log (rate limit / idempotency) — users cannot tamper with their own counters
const idemKey = crypto.randomUUID()
const eIns = await ja
  .from('email_log')
  .insert({ idempotency_key: idemKey, kind: 'document', recipient_domain: 'example.com' })
  .select()
  .single()
check('A can log an outgoing email (pending)', !eIns.error, eIns.error?.message)
const eSent = await ja.from('email_log').insert({
  idempotency_key: crypto.randomUUID(),
  kind: 'document',
  recipient_domain: 'x.com',
  status: 'sent',
})
check('A cannot insert a log row already marked sent', !!eSent.error)
const eOld = await ja.from('email_log').insert({
  idempotency_key: crypto.randomUUID(),
  kind: 'document',
  recipient_domain: 'x.com',
  created_at: '2020-01-01T00:00:00Z',
})
check('A cannot back-date a log row', !!eOld.error)
const eMove = await ja
  .from('email_log')
  .update({ created_at: '2020-01-01T00:00:00Z' })
  .eq('id', eIns.data?.id)
  .select()
check(
  'A cannot move a log row out of the rate-limit window',
  !!eMove.error || (eMove.data?.length ?? 0) === 0,
)
const eDel = await ja.from('email_log').delete().eq('id', eIns.data?.id).select()
check('A cannot delete log rows', !!eDel.error || (eDel.data?.length ?? 0) === 0)
const eDup = await ja
  .from('email_log')
  .insert({ idempotency_key: idemKey, kind: 'document', recipient_domain: 'example.com' })
check('Same idempotency key cannot be logged twice', eDup.error?.code === '23505', eDup.error?.code)
const eSeeB = await jb.from('email_log').select('id')
check('B sees none of A’s email log', (eSeeB.data?.length ?? 0) === 0)

// Optimistic concurrency in save_candidate
const { data: cur } = await a.from('candidates').select('*').eq('id', targetId).single()
const basePayload = {
  id: targetId,
  candidate: { ...cur, city: 'בדיקת מקביליות' },
  family: {},
  in_laws: [],
}
const fresh = await a.rpc('save_candidate', {
  payload: { ...basePayload, expected_updated_at: cur!.updated_at },
})
check('save with the current version succeeds', !fresh.error, fresh.error?.message)
const stale = await a.rpc('save_candidate', {
  payload: { ...basePayload, expected_updated_at: cur!.updated_at },
})
check(
  'save with a stale version is refused (P0409)',
  stale.error?.code === 'P0409',
  stale.error?.code,
)
const legacy = await a.rpc('save_candidate', { payload: basePayload })
check(
  'save without a version keeps working (backward compatible)',
  !legacy.error,
  legacy.error?.message,
)

// Account deletion: only the caller's own account; everything owned goes with it
const anon = client()
const anonDel = await anon.rpc('delete_my_account' as never)
check('anonymous caller cannot run delete_my_account', !!anonDel.error)
const cUser = client()
const emailC = `erase-${Date.now()}@shidduchim.local`
const { error: cErr } = await cUser.auth.signUp({ email: emailC, password: 'Test-12345' })
check('temporary account C created', !cErr, cErr?.message)
const cId = (await cUser.auth.getUser()).data.user!.id
const cSave = await cUser.rpc('save_candidate', {
  payload: {
    candidate: { gender: 'male', first_name: 'מחיקה', last_name: 'בדיקה', status: 'active', education_history: [] },
    family: {},
    in_laws: [],
  },
})
check('C owns a candidate', !cSave.error, cSave.error?.message)
const cIdea = await cUser.from('ideas').insert({ title: 'רעיון של C' })
check('C owns an idea', !cIdea.error, cIdea.error?.message)
const cDel = await cUser.rpc('delete_my_account' as never)
check('C can delete own account', !cDel.error, cDel.error?.message)
const cLogin = await client().auth.signInWithPassword({ email: emailC, password: 'Test-12345' })
check('deleted account cannot sign in', !!cLogin.error)
const aStill = await a.from('candidates').select('id').eq('owner_id', aId)
check('other accounts are untouched', (aStill.data?.length ?? 0) >= 20, `${aStill.data?.length} rows`)
void cId

// cleanup B's data
await b.from('candidates').delete().eq('owner_id', bUid)

console.log(failures === 0 ? '\nAll RLS checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
