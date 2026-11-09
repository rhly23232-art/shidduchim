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
check('A sees only own rows', (aRows.data ?? []).every((r) => r.owner_id === aId))
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
const ins = await b.from('candidates').insert({ owner_id: aId, gender: 'male', first_name: 'x', last_name: 'y' })
check('B cannot insert rows owned by A', !!ins.error)
const famIns = await b.from('in_laws').insert({ candidate_id: targetId, relation: 'גיס', full_name: 'x' })
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
check('B can create own candidate via RPC', !own.error && typeof own.data === 'string', own.error?.message)
const bAfter = await b.from('candidates_view').select('id, age')
check('B now sees exactly 1 candidate', bAfter.data?.length === 1)

// Storage isolation
const bUid = (await b.auth.getUser()).data.user!.id
const pdf = new Blob(['%PDF-1.4\n%test\n'], { type: 'application/pdf' })
const aPath = `${aId}/${targetId}/rls-test.pdf`
const upA = await a.storage.from('resumes').upload(aPath, pdf, { upsert: true, contentType: 'application/pdf' })
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
  .upload(`${aId}/${targetId}/x.txt`, new Blob(['hi'], { type: 'text/plain' }), { contentType: 'text/plain' })
check('Bucket rejects disallowed MIME type', !!badType.error, badType.error?.message)
const big = new Blob([new Uint8Array(10 * 1024 * 1024 + 10)], { type: 'application/pdf' })
const tooBig = await a.storage.from('resumes').upload(`${aId}/${targetId}/big.pdf`, big, { contentType: 'application/pdf' })
check('Bucket rejects file > 10MB', !!tooBig.error, tooBig.error?.message)
await a.storage.from('resumes').remove([aPath])

// Matchmaker workspace isolation
const aProps = await a.from('proposals').select('id, male_id, female_id')
check('A sees own proposals', (aProps.data?.length ?? 0) >= 7, `${aProps.data?.length} rows`)
const bProps = await b.from('proposals').select('id')
check('B sees none of A’s proposals', bProps.data?.length === 0)
const bEvents = await b.from('proposal_events').select('id')
check('B sees no proposal history', bEvents.data?.length === 0)
const bIdeas = await b.from('ideas').select('id')
check('B sees no ideas', bIdeas.data?.length === 0)
const bTasks = await b.from('tasks').select('id')
check('B sees no tasks', bTasks.data?.length === 0)
const pA = aProps.data![0]!
const bUpd = await b.from('proposals').update({ stage: 'closed' }).eq('id', pA.id).select()
check('B cannot change A’s proposal', (bUpd.data?.length ?? 0) === 0)
const bIns = await b.from('proposals').insert({ male_id: pA.male_id, female_id: pA.female_id })
check('B cannot create a proposal with A’s candidates', !!bIns.error)
const bNote = await b.from('proposal_events').insert({ proposal_id: pA.id, kind: 'note', text: 'x' })
check('B cannot write into A’s proposal history', !!bNote.error)
const bTask = await b.from('tasks').insert({ title: 'x', candidate_id: pA.male_id })
check('B cannot link a task to A’s candidate', !!bTask.error)
// pairing rule (two בחורים) is rejected even for the owner
const males = (await a.from('candidates').select('id').eq('gender', 'male').limit(2)).data!
const bad = await a.from('proposals').insert({ male_id: males[0]!.id, female_id: males[1]!.id })
check('Proposal must pair בחור with בחורה', !!bad.error, bad.error?.message)
// history trigger
const before = (await a.from('proposal_events').select('id', { count: 'exact', head: true }).eq('proposal_id', pA.id)).count ?? 0
const cur = (await a.from('proposals').select('stage').eq('id', pA.id).single()).data!.stage
await a.from('proposals').update({ stage: cur === 'checking' ? 'meeting' : 'checking' }).eq('id', pA.id)
const after = (await a.from('proposal_events').select('id', { count: 'exact', head: true }).eq('proposal_id', pA.id)).count ?? 0
check('Stage change is logged to history automatically', after === before + 1)
await a.from('proposals').update({ stage: cur }).eq('id', pA.id)

// cleanup B's data
await b.from('candidates').delete().eq('owner_id', bUid)

console.log(failures === 0 ? '\nAll RLS checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
