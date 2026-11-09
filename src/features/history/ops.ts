import { dataApi, rawDataApi } from '@/lib/api'
import type { JournalEntry } from '@/lib/api/types'
import { payloadOf } from '@/lib/candidatePayload'
import type { CandidateFull, Idea, IdeaInput } from '@/lib/types'

/** Deleted items stay in the recycle bin this long. */
export const TRASH_DAYS = 30
const DAY = 86_400_000

export const daysLeft = (e: JournalEntry) =>
  Math.max(0, Math.ceil(TRASH_DAYS - (Date.now() - new Date(e.at).getTime()) / DAY))

/** Recycle bin content; entries older than 30 days are purged on the way. */
export async function listTrash(): Promise<JournalEntry[]> {
  const all = await dataApi.journal.list({ kinds: ['delete', 'idea_delete'] })
  const fresh: JournalEntry[] = []
  for (const e of all) {
    if (daysLeft(e) > 0) fresh.push(e)
    else await purge(e).catch(() => undefined)
  }
  return fresh
}

export async function purge(e: JournalEntry) {
  if (e.data.file) await dataApi.journal.dropFile(e.data.file.path).catch(() => undefined)
  await dataApi.journal.remove(e.id)
}

const ideaInput = ({ id: _i, created_at: _c, updated_at: _u, ...rest }: Idea): IdeaInput => rest

/**
 * Brings a deleted candidate back: card, family, in-laws, the resume file and the links
 * from ideas. Returns the new id.
 */
export async function restoreCandidate(e: JournalEntry): Promise<string> {
  const snap = e.data.snapshot
  if (!snap) throw new Error('missing snapshot')
  const id = await rawDataApi.saveCandidate(payloadOf(snap))
  if (e.data.file) {
    const blob = await dataApi.journal.getFile(e.data.file.path, e.data.file.mime)
    const full = await rawDataApi.getCandidate(id)
    if (full)
      await rawDataApi.uploadResume(
        { id, owner_id: full.owner_id, resume: null },
        new File([blob], e.data.file.name, { type: e.data.file.mime }),
        e.data.file.mime,
        () => undefined,
      )
  }
  if (e.data.ideaLinks?.length) {
    const ideas = await rawDataApi.listIdeas()
    for (const link of e.data.ideaLinks) {
      const idea = ideas.find((i) => i.id === link.ideaId)
      if (idea && !idea[link.field])
        await rawDataApi.saveIdea({ ...ideaInput(idea), [link.field]: id }, idea.id)
    }
  }
  await dataApi.journal.add({ kind: 'restore', candidate_id: id, title: e.title, data: {} })
  await purge(e)
  return id
}

export async function restoreIdea(e: JournalEntry) {
  const idea = e.data.idea
  if (!idea) throw new Error('missing idea')
  // links to candidates that no longer exist are dropped
  const rows = (await rawDataApi.listCandidates(Number.MAX_SAFE_INTEGER)).rows
  const exists = (id: string | null) => (id && rows.some((r) => r.id === id) ? id : null)
  await rawDataApi.saveIdea({
    ...ideaInput(idea),
    male_id: exists(idea.male_id),
    female_id: exists(idea.female_id),
  })
  await purge(e)
}

/** Puts a candidate back to how it was before the given edit (recorded as a new edit). */
export async function revertEdit(e: JournalEntry, current: CandidateFull) {
  const snap = e.data.snapshot
  if (!snap) throw new Error('missing snapshot')
  await dataApi.saveCandidate(payloadOf(snap, current.id))
}
