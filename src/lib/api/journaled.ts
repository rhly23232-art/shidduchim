import { payloadOf } from '../candidatePayload'
import { logError } from '../log'
import type { CandidateFull, SaveCandidatePayload } from '../types'
import type { DataApi, FieldChange } from './types'

/** Field → Hebrew label for the change history (only fields a person edits). */
export const FIELD_LABELS: Record<string, string> = {
  gender: 'בחור / בחורה',
  first_name: 'שם פרטי',
  last_name: 'שם משפחה',
  birth_date: 'תאריך לידה',
  city: 'עיר',
  region: 'אזור',
  eda: 'עדה',
  community: 'עדה – פירוט',
  chassidut: 'חסידות',
  height_cm: 'גובה',
  appearance: 'מראה',
  institution: 'ישיבה / סמינר',
  education_history: 'מסלול לימודים',
  occupation: 'עיסוק',
  degree: 'תואר / מקצוע',
  future_plans: 'תוכניות לעתיד',
  character_description: 'תיאור אופי',
  desired_home_style: 'סגנון בית',
  special_requirements: 'דרישות מיוחדות',
  general_notes: 'הערות',
  status: 'סטטוס',
  'family.father_name': 'שם האב',
  'family.father_occupation': 'עיסוק האב',
  'family.mother_name': 'שם האם',
  'family.mother_occupation': 'עיסוק האם',
  'family.mother_maiden_name': 'משפחת האם',
  'family.lineage': 'ייחוס',
  'family.siblings_count': 'מספר אחים',
  'family.birth_order': 'מקום במשפחה',
  in_laws: 'מחותנים',
}

const show = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null
  if (Array.isArray(v)) {
    if (!v.length) return null
    return v
      .map((x) =>
        typeof x === 'object' && x
          ? Object.values(x as Record<string, unknown>)
              .filter((y) => y !== null && y !== '')
              .join(' · ')
          : String(x),
      )
      .join(' | ')
  }
  return String(v)
}

/** Differences between two save payloads, in the order of FIELD_LABELS. */
export function diffPayloads(a: SaveCandidatePayload, b: SaveCandidatePayload): FieldChange[] {
  const flat = (p: SaveCandidatePayload): Record<string, unknown> => ({
    ...p.candidate,
    ...Object.fromEntries(Object.entries(p.family).map(([k, v]) => [`family.${k}`, v])),
    in_laws: p.in_laws.map((l) => ({
      relation: l.relation,
      full_name: l.full_name,
      details: l.details ?? null,
    })),
  })
  const fa = flat(a)
  const fb = flat(b)
  const out: FieldChange[] = []
  for (const field of Object.keys(FIELD_LABELS)) {
    const before = show(fa[field])
    const after = show(fb[field])
    if (before !== after) out.push({ field, before, after })
  }
  return out
}

/** A safety step around a destructive action failed — the action was not performed. */
export class JournalError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'JournalError'
  }
}

const nameOf = (c: { first_name: string; last_name: string }) =>
  `${c.first_name} ${c.last_name}`.trim()

/**
 * Wraps a backend so every candidate save/delete and idea delete is written to its journal
 * (change history + recycle bin). Journal failures never block the real action.
 */
export function journaled(base: DataApi): DataApi {
  const safe = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (e) {
      logError('journal.write', e)
    }
  }
  return new Proxy(base, {
    get(target, key, receiver) {
      if (key === 'saveCandidate') {
        return async (payload: SaveCandidatePayload) => {
          let before: CandidateFull | null = null
          if (payload.id) before = await target.getCandidate(payload.id).catch(() => null)
          const id = await target.saveCandidate(payload)
          await safe(async () => {
            if (before) {
              const changes = diffPayloads(payloadOf(before), payload)
              if (changes.length)
                await target.journal.add({
                  kind: 'edit',
                  candidate_id: id,
                  title: nameOf(payload.candidate),
                  data: { snapshot: before, changes },
                })
            } else if (!payload.id) {
              await target.journal.add({
                kind: 'create',
                candidate_id: id,
                title: nameOf(payload.candidate),
                data: {},
              })
            }
          })
          return id
        }
      }
      if (key === 'deleteCandidate') {
        return async (id: string) => {
          const snapshot = await target.getCandidate(id).catch(() => null)
          const entryId = crypto.randomUUID()
          let file: { path: string; name: string; mime: string; size: number } | undefined
          let ideaLinks: { ideaId: string; field: 'male_id' | 'female_id' }[] = []
          if (snapshot) {
            // Never lose a resume silently: if its copy cannot be kept, the delete is cancelled.
            await (async () => {
              if (snapshot.resume) {
                const blob = await target.getResumeBlob(snapshot.resume)
                const path = await target.journal.putFile(
                  entryId,
                  blob,
                  snapshot.resume.file_name,
                  snapshot.resume.mime_type,
                )
                file = {
                  path,
                  name: snapshot.resume.file_name,
                  mime: snapshot.resume.mime_type,
                  size: snapshot.resume.size_bytes,
                }
              }
            })().catch((e) => {
              throw new JournalError(
                'לא ניתן היה לשמור עותק של הרזומה בסל המחזור, ולכן המחיקה בוטלה. נסו שוב.',
                e,
              )
            })
            await safe(async () => {
              const ideas = await target.listIdeas()
              ideaLinks = ideas.flatMap((i) => [
                ...(i.male_id === id ? [{ ideaId: i.id, field: 'male_id' as const }] : []),
                ...(i.female_id === id ? [{ ideaId: i.id, field: 'female_id' as const }] : []),
              ])
            })
          }
          await target.deleteCandidate(id)
          if (snapshot)
            await safe(() =>
              target.journal.add({
                id: entryId,
                kind: 'delete',
                candidate_id: id,
                title: nameOf(snapshot),
                data: { snapshot, file, ideaLinks },
              }),
            )
        }
      }
      if (key === 'deleteIdea') {
        return async (id: string) => {
          const idea = (await target.listIdeas().catch(() => [])).find((i) => i.id === id)
          await target.deleteIdea(id)
          if (idea)
            await safe(() =>
              target.journal.add({
                kind: 'idea_delete',
                candidate_id: null,
                title: idea.title,
                data: { idea },
              }),
            )
        }
      }
      return Reflect.get(target, key, receiver)
    },
  })
}
