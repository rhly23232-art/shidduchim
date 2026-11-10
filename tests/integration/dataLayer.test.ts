/**
 * Integration tests of the data layer through the public facades (`dataApi`, `authApi`),
 * exactly as the screens use it — here on the local backend (no Supabase configured).
 * The same contract is exercised against Supabase by scripts/verify-rls.ts and the e2e suite.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { buildBackup, readBackup, restoreBackup } from '@/features/history/backup'
import { listTrash, restoreCandidate, revertEdit } from '@/features/history/ops'
import { authApi, dataApi, rawDataApi } from '@/lib/api'
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/api/demoApi'
import { isConflict } from '@/lib/api/errors'
import { JournalError } from '@/lib/api/journaled'
import { payloadOf } from '@/lib/candidatePayload'
import type { SaveCandidatePayload } from '@/lib/types'

vi.mock('@/lib/utils', async (orig) => ({
  ...(await orig<object>()),
  sleep: () => Promise.resolve(),
}))

const newCandidate = (first: string): SaveCandidatePayload => ({
  candidate: {
    gender: 'male',
    first_name: first,
    last_name: 'בדיקה',
    birth_date: '2001-01-01',
    hebrew_birth_date: null,
    city: 'ירושלים',
    region: null,
    country_of_origin: null,
    eda: null,
    community: null,
    chassidut: null,
    height_cm: 175,
    appearance: null,
    institution: 'ישיבת בדיקה',
    institution_type: null,
    education_history: [],
    occupation: null,
    degree: null,
    future_plans: null,
    character_description: null,
    desired_home_style: null,
    special_requirements: null,
    general_notes: null,
    status: 'active',
  },
  family: {
    father_name: 'ר׳ אב',
    father_occupation: null,
    mother_name: null,
    mother_occupation: null,
    mother_maiden_name: null,
    lineage: null,
    siblings_count: null,
    birth_order: null,
  },
  in_laws: [{ relation: 'גיס', full_name: 'משה בדיקה', details: null }],
})

beforeAll(async () => {
  await authApi.signIn(DEMO_EMAIL, DEMO_PASSWORD)
})

describe('candidates CRUD', () => {
  it('lists the account’s candidates', async () => {
    const { rows, overLimit } = await dataApi.listCandidates(5000)
    expect(overLimit).toBe(false)
    expect(rows.length).toBeGreaterThanOrEqual(20)
  })

  it('creates and reads back a full card (family + in-laws)', async () => {
    const id = await dataApi.saveCandidate(newCandidate('יצירה'))
    const c = await dataApi.getCandidate(id)
    expect(c?.first_name).toBe('יצירה')
    expect(c?.family?.father_name).toBe('ר׳ אב')
    expect(c?.in_laws.map((l) => l.full_name)).toEqual(['משה בדיקה'])
    expect(c?.age).toBeGreaterThan(20)
  })

  it('refuses a stale save (optimistic concurrency) and accepts a fresh one', async () => {
    const id = await dataApi.saveCandidate(newCandidate('מקביליות'))
    const opened = (await dataApi.getCandidate(id))!
    // someone else saves first
    await new Promise((r) => setTimeout(r, 5))
    await dataApi.saveCandidate({
      ...payloadOf(opened, id, opened.updated_at),
      candidate: { ...opened, city: 'חיפה' },
    })
    // our save, from the old version, must be refused
    const stale = dataApi.saveCandidate(
      payloadOf({ ...opened, city: 'צפת' }, id, opened.updated_at),
    )
    await expect(stale).rejects.toSatisfy(isConflict)
    expect((await dataApi.getCandidate(id))?.city).toBe('חיפה')
    // without a version (explicit overwrite) it is saved
    await dataApi.saveCandidate(payloadOf({ ...opened, city: 'צפת' }, id))
    expect((await dataApi.getCandidate(id))?.city).toBe('צפת')
  })
})

describe('history & recycle bin', () => {
  it('records field changes and reverts to before a change', async () => {
    const id = await dataApi.saveCandidate(newCandidate('היסטוריה'))
    const v1 = (await dataApi.getCandidate(id))!
    await dataApi.saveCandidate(
      payloadOf({ ...v1, city: 'בני ברק', height_cm: 181 }, id, v1.updated_at),
    )
    const [edit] = await dataApi.journal.list({ candidateId: id, kinds: ['edit'] })
    expect(edit!.data.changes).toEqual([
      { field: 'city', before: 'ירושלים', after: 'בני ברק' },
      { field: 'height_cm', before: '175', after: '181' },
    ])
    await revertEdit(edit!, (await dataApi.getCandidate(id))!)
    const back = (await dataApi.getCandidate(id))!
    expect([back.city, back.height_cm]).toEqual(['ירושלים', 175])
  })

  it('moves a deleted card with its resume to the recycle bin and restores everything', async () => {
    const id = await dataApi.saveCandidate(newCandidate('מחיקה'))
    const c = (await dataApi.getCandidate(id))!
    const pdf = new File(['%PDF-1.4 test'], 'רזומה.pdf', { type: 'application/pdf' })
    await dataApi.uploadResume(
      { id, owner_id: c.owner_id, resume: null },
      pdf,
      'application/pdf',
      () => {},
    )
    const idea = await dataApi.saveIdea({
      title: 'רעיון מקושר',
      body: null,
      male_id: id,
      female_id: null,
      pinned: false,
      done: false,
    })

    await dataApi.deleteCandidate(id)
    expect(await dataApi.getCandidate(id)).toBeNull()
    const entry = (await listTrash()).find((e) => e.candidate_id === id)!
    expect(entry.data.file?.name).toBe('רזומה.pdf')
    expect(entry.data.ideaLinks).toEqual([{ ideaId: idea.id, field: 'male_id' }])

    const newId = await restoreCandidate(entry)
    const restored = (await dataApi.getCandidate(newId))!
    expect(restored.first_name).toBe('מחיקה')
    expect(restored.in_laws).toHaveLength(1)
    expect(restored.resume?.file_name).toBe('רזומה.pdf')
    expect(await (await dataApi.getResumeBlob(restored.resume!)).text()).toBe('%PDF-1.4 test')
    expect((await dataApi.listIdeas()).find((i) => i.id === idea.id)?.male_id).toBe(newId)
    expect((await listTrash()).some((e) => e.id === entry.id)).toBe(false)
  })

  it('cancels a delete when the resume copy cannot be kept (no silent data loss)', async () => {
    const id = await dataApi.saveCandidate(newCandidate('הגנה'))
    const c = (await dataApi.getCandidate(id))!
    await dataApi.uploadResume(
      { id, owner_id: c.owner_id, resume: null },
      new File(['%PDF-1.4'], 'r.pdf', { type: 'application/pdf' }),
      'application/pdf',
      () => {},
    )
    const spy = vi.spyOn(rawDataApi.journal, 'putFile').mockRejectedValue(new Error('storage down'))
    await expect(dataApi.deleteCandidate(id)).rejects.toBeInstanceOf(JournalError)
    spy.mockRestore()
    expect((await dataApi.getCandidate(id))?.resume?.file_name).toBe('r.pdf')
  })
})

describe('backup', () => {
  it('builds a full backup and restores only what is missing', async () => {
    const before = (await dataApi.listCandidates(5000)).rows
    const progress: number[] = []
    const zipBlob = await buildBackup((done) => progress.push(done))
    expect(progress.at(-1)).toBe(before.length)
    const parsed = await readBackup(zipBlob)
    expect(parsed.backup.candidates).toHaveLength(before.length)

    const victim = before.find((r) => r.first_name === 'יצירה')!
    await dataApi.deleteCandidate(victim.id)
    const now = (await dataApi.listCandidates(5000)).rows
    const res = await restoreBackup(parsed, now, () => {})
    expect(res).toMatchObject({ candidates: 1, failed: [] })
    const after = (await dataApi.listCandidates(5000)).rows
    expect(after).toHaveLength(before.length)
    expect(after.filter((r) => r.first_name === 'יצירה')).toHaveLength(1)
  })

  it('rejects files that are not backups', async () => {
    await expect(readBackup(new Blob(['nope']))).rejects.toThrow()
  })
})

describe('erasure (right to be forgotten)', () => {
  it('deletes all data of the account, including recycle-bin files', async () => {
    const id = await dataApi.saveCandidate(newCandidate('למחיקה'))
    const c = (await dataApi.getCandidate(id))!
    await dataApi.uploadResume(
      { id, owner_id: c.owner_id, resume: null },
      new File(['%PDF-1.4'], 'r.pdf', { type: 'application/pdf' }),
      'application/pdf',
      () => {},
    )
    await dataApi.deleteCandidate(id) // its resume goes to the recycle bin
    await dataApi.deleteAllMyData()
    expect((await dataApi.listCandidates(5000)).rows).toHaveLength(0)
    expect(await dataApi.listIdeas()).toHaveLength(0)
    expect(await dataApi.journal.list()).toHaveLength(0)
  })

  it('deletes an account only with its password; afterwards it cannot sign in', async () => {
    await authApi.signUp('erase@example.com', 'secret-123', 'חשבון למחיקה')
    await authApi.signIn('erase@example.com', 'secret-123')
    await dataApi.saveCandidate(newCandidate('שייך'))
    await expect(authApi.deleteAccount('wrong-pass')).rejects.toThrow('הסיסמה שגויה')
    expect(await authApi.getUser()).not.toBeNull()
    await authApi.deleteAccount('secret-123')
    expect(await authApi.getUser()).toBeNull()
    await expect(authApi.signIn('erase@example.com', 'secret-123')).rejects.toThrow()
  })
})
