import { useSyncExternalStore } from 'react'
import { dataApi, rawDataApi } from '@/lib/api'
import { payloadOf } from '@/lib/candidatePayload'
import { readText, unzip } from '@/lib/files/unzip'
import { zip, type ZipEntry } from '@/lib/files/zip'
import type { CandidateFull, CandidateRow, Idea, IdeaInput } from '@/lib/types'
import { fullName, normalizeSearch } from '@/lib/utils'

export const BACKUP_FORMAT = 'shidduchim-backup'
const LAST_KEY = 'shidduchim-last-backup'

interface BackupCandidate extends CandidateFull {
  /** path of the resume inside the zip */
  resume_file?: string
}
export interface Backup {
  format: typeof BACKUP_FORMAT
  version: 1
  created_at: string
  candidates: BackupCandidate[]
  ideas: Idea[]
}

export function lastBackupAt(): Date | null {
  try {
    const v = localStorage.getItem(LAST_KEY)
    return v ? new Date(v) : null
  } catch {
    return null
  }
}
const listeners = new Set<() => void>()
function markBackup() {
  try {
    localStorage.setItem(LAST_KEY, new Date().toISOString())
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn())
}

/** Re-renders when a backup is made (sidebar reminder, backup page). */
export function useLastBackup(): Date | null {
  const iso = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => lastBackupAt()?.toISOString() ?? null,
  )
  return iso ? new Date(iso) : null
}

const extOf = (name: string) =>
  (name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Full backup: every candidate (with family and in-laws), every idea and every resume file. */
export async function buildBackup(
  onProgress: (done: number, total: number) => void,
): Promise<Blob> {
  const { rows } = await dataApi.listCandidates(Number.MAX_SAFE_INTEGER)
  const ideas = await dataApi.listIdeas()
  const files: ZipEntry[] = []
  const candidates: BackupCandidate[] = []
  for (let i = 0; i < rows.length; i++) {
    const full = await dataApi.getCandidate(rows[i]!.id)
    if (full) {
      const c: BackupCandidate = { ...full }
      if (full.resume) {
        try {
          const blob = await dataApi.getResumeBlob(full.resume)
          const path = `resumes/${full.id}.${extOf(full.resume.file_name)}`
          files.push({ name: path, data: new Uint8Array(await blob.arrayBuffer()) })
          c.resume_file = path
        } catch {
          /* resume unreadable: keep the card */
        }
      }
      candidates.push(c)
    }
    onProgress(i + 1, rows.length)
  }
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: 1,
    created_at: new Date().toISOString(),
    candidates,
    ideas,
  }
  const blob = zip(
    [{ name: 'backup.json', data: JSON.stringify(backup, null, 1) }, ...files],
    'application/zip',
  )
  markBackup()
  return blob
}

export interface ParsedBackup {
  backup: Backup
  files: Awaited<ReturnType<typeof unzip>>
}

export async function readBackup(file: Blob): Promise<ParsedBackup> {
  const files = await unzip(file)
  const json = await readText(files, 'backup.json')
  if (!json) throw new Error('not a backup')
  const backup = JSON.parse(json) as Backup
  if (backup.format !== BACKUP_FORMAT || !Array.isArray(backup.candidates))
    throw new Error('not a backup')
  return { backup, files }
}

const identity = (c: { first_name: string; last_name: string; birth_date: string | null }) =>
  `${normalizeSearch(fullName(c))}|${c.birth_date ?? ''}`

/** Which backup candidates are already in the account (same name + birth date, or same id). */
export function existingIn(backup: Backup, rows: CandidateRow[]) {
  const ids = new Set(rows.map((r) => r.id))
  const keys = new Set(rows.map(identity))
  return new Set(
    backup.candidates.filter((c) => ids.has(c.id) || keys.has(identity(c))).map((c) => c.id),
  )
}

export interface RestoreResult {
  candidates: number
  ideas: number
  failed: string[]
}

/** Adds what is missing: candidates (with resumes) not in the account, then their ideas. */
export async function restoreBackup(
  parsed: ParsedBackup,
  rows: CandidateRow[],
  onProgress: (done: number, total: number) => void,
): Promise<RestoreResult> {
  const { backup, files } = parsed
  const skip = existingIn(backup, rows)
  const todo = backup.candidates.filter((c) => !skip.has(c.id))
  const idMap = new Map<string, string>()
  for (const r of rows) idMap.set(r.id, r.id)
  // existing duplicates map onto the account's card so ideas can still link to them
  for (const c of backup.candidates)
    if (skip.has(c.id)) {
      const match = rows.find((r) => r.id === c.id || identity(r) === identity(c))
      if (match) idMap.set(c.id, match.id)
    }
  const result: RestoreResult = { candidates: 0, ideas: 0, failed: [] }
  const total = todo.length + backup.ideas.length
  let done = 0
  for (const c of todo) {
    try {
      const id = await rawDataApi.saveCandidate(payloadOf(c))
      idMap.set(c.id, id)
      if (c.resume && c.resume_file && files.has(c.resume_file)) {
        const bytes = await files.get(c.resume_file)!()
        const full = await rawDataApi.getCandidate(id)
        if (full)
          await rawDataApi.uploadResume(
            { id, owner_id: full.owner_id, resume: null },
            new File([bytes as BlobPart], c.resume.file_name, { type: c.resume.mime_type }),
            c.resume.mime_type,
            () => undefined,
          )
      }
      result.candidates++
    } catch {
      result.failed.push(fullName(c))
    }
    onProgress(++done, total)
  }
  const existingIdeas = await rawDataApi.listIdeas()
  const ideaKey = (i: Pick<Idea, 'title' | 'body'>) => `${i.title}|${i.body ?? ''}`
  const haveIdeas = new Set(existingIdeas.map(ideaKey))
  for (const idea of backup.ideas) {
    if (!haveIdeas.has(ideaKey(idea))) {
      const input: IdeaInput = {
        title: idea.title,
        body: idea.body,
        pinned: idea.pinned,
        done: idea.done,
        male_id: idea.male_id ? (idMap.get(idea.male_id) ?? null) : null,
        female_id: idea.female_id ? (idMap.get(idea.female_id) ?? null) : null,
      }
      try {
        await rawDataApi.saveIdea(input)
        result.ideas++
      } catch {
        result.failed.push(idea.title)
      }
    }
    onProgress(++done, total)
  }
  return result
}
