/**
 * Persistent backend for when the app runs inside claude.ai (published Artifact):
 *  - candidates + ideas → the Artifact database (`db`), in the viewer's PRIVATE subtree
 *    `data/users/<id>/profile/{candidates,ideas}` — nobody else (not even other editors) can read it;
 *  - resume files → the Artifact asset store (`assets`); only the private candidate document
 *    holds the asset id.
 * Identity comes from the signed-in claude.ai account (`user`), so there is no separate login.
 */
import { ageFromBirthDate } from '../age'
import { he } from '../strings.he'
import type { CandidateFull, CandidateRow, Idea, InLaw, ResumeMeta } from '../types'
import { hebrewCollator, normalizeSearch } from '../utils'
import { sampleResumeBlob, seedIdeas, seedRows, type StoredCandidate } from './demoApi'
import type { AppUser, AuthApi, DataApi, FacetRow } from './types'

// ---------- minimal typings of the host capabilities we use ----------------------------
interface Snap {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
}
interface QuerySnap {
  docs: Snap[]
}
interface DocRef {
  id: string
  get(): Promise<Snap>
  set(data: Record<string, unknown>): Promise<void>
  update(data: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  collection(path: string): CollRef
}
interface Query {
  where(field: string, op: string, value: unknown): Query
  orderBy(field: string, dir?: 'asc' | 'desc'): Query
  limit(n: number): Query
  get(): Promise<QuerySnap>
}
interface CollRef extends Query {
  doc(id?: string): DocRef
}
export interface HostDb {
  doc(path: string): DocRef
  collection(path: string): CollRef
}
export interface HostUser {
  me(): Promise<{ id: string | null; name: string; email: string | null }>
}
export interface HostAssets {
  upload(
    blob: Blob,
    options?: { type?: string },
  ): Promise<{ id: string; url: string; sizeBytes: number }>
  delete(ref: string): Promise<{ deleted: boolean }>
}

const DIRECT_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])
const now = () => new Date().toISOString()
const uid = () => crypto.randomUUID()

function dbErrorText(e: unknown): string {
  const code =
    typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
  switch (code) {
    case 'quota_exceeded':
      return he.hostDb.quota
    case 'invalid_argument':
      return he.hostDb.noWrite
    case 'revoked':
    case 'not_granted':
      return he.hostDb.revoked
    case 'unsupported_type':
      return he.resume.invalidType
    case 'too_large':
      return he.resume.tooLarge
    default:
      return e instanceof Error ? e.message : he.hostDb.unavailable
  }
}
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw new Error(dbErrorText(e))
  }
}

/** Storage path encodes the asset id and how the bytes were stored. */
const assetPath = (assetId: string, enc: 'raw' | 'b64') => `asset:${assetId}:${enc}`
function parseAssetPath(p: string): { id: string; enc: 'raw' | 'b64' } | null {
  const m = /^asset:([^:]+):(raw|b64)$/.exec(p)
  return m ? { id: m[1]!, enc: m[2] as 'raw' | 'b64' } : null
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
function fromBase64(text: string): Uint8Array {
  const bin = atob(text.trim())
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Firestore-style bodies cannot hold `undefined`; JSON round-trip strips it. */
const clean = <T>(v: T) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>

export function createHostBackend(
  db: HostDb,
  user: { id: string; name: string; email: string | null },
  assets: HostAssets | null,
) {
  const base = db.doc(`data/users/${user.id}/profile`)
  const candidates = base.collection('candidates')
  const ideas = base.collection('ideas')

  const appUser: AppUser = { id: user.id, email: user.email ?? '', fullName: user.name || null }

  const auth: AuthApi = {
    async getUser() {
      return appUser
    },
    onAuthChange() {
      return () => undefined
    },
    async signIn() {
      return appUser
    },
    async signUp() {
      return { signedIn: true }
    },
    async signOut() {
      /* identity is the claude.ai account — nothing to sign out of here */
    },
  }

  const withAge = (c: StoredCandidate): CandidateFull => ({
    ...c,
    age: ageFromBirthDate(c.birth_date),
  })
  const toRow = (c: StoredCandidate): CandidateRow => {
    const { family: _f, in_laws: _l, ...rest } = withAge(c)
    return rest
  }

  /** Reads the whole private collection in pages of 1000 (ordered by id). */
  async function readAll<T>(coll: CollRef): Promise<T[]> {
    const out: T[] = []
    let last: string | null = null
    for (;;) {
      let q: Query = coll.orderBy('id')
      if (last) q = q.where('id', '>', last)
      const snap = await q.limit(1000).get()
      for (const d of snap.docs) out.push(d.data() as T)
      if (snap.docs.length < 1000) break
      last = snap.docs[snap.docs.length - 1]!.id
    }
    return out
  }

  const allCandidates = () => guard(() => readAll<StoredCandidate>(candidates))

  async function storeFile(blob: Blob, mime: string): Promise<{ path: string }> {
    if (!assets) throw new Error(he.hostDb.noFiles)
    if (DIRECT_TYPES.has(mime)) {
      const r = await guard(() => assets.upload(blob, { type: mime }))
      return { path: assetPath(r.id, 'raw') }
    }
    // Word files are not an accepted asset type: keep them as base64 text (same bytes).
    const text = toBase64(await blob.arrayBuffer())
    const r = await guard(() =>
      assets.upload(new Blob([text], { type: 'text/plain' }), { type: 'text/plain' }),
    )
    return { path: assetPath(r.id, 'b64') }
  }

  async function dropFile(path: string) {
    const a = parseAssetPath(path)
    if (a && assets) await assets.delete(a.id).catch(() => undefined)
  }

  async function readFile(resume: ResumeMeta): Promise<Blob> {
    const a = parseAssetPath(resume.storage_path)
    if (!a) throw new Error(he.resume.downloadFailed)
    const res = await fetch(`/_blob/${a.id}`)
    if (!res.ok) throw new Error(he.resume.downloadFailed)
    if (a.enc === 'raw') return new Blob([await res.blob()], { type: resume.mime_type })
    return new Blob([fromBase64(await res.text())], { type: resume.mime_type })
  }

  const data: DataApi = {
    supportsServerEmail: false,
    supportsShareLinks: false,

    async countCandidates() {
      const rows = await allCandidates()
      const male = rows.filter((r) => r.gender === 'male').length
      return { male, female: rows.length - male }
    },

    async listCandidates(maxRows) {
      const rows = await allCandidates()
      if (rows.length > maxRows) return { rows: [], overLimit: true }
      return { rows: rows.map(toRow), overLimit: false }
    },

    async queryCandidates(gender, f, sort, limit) {
      const rows = (await allCandidates()).map(toRow).filter((r) => r.gender === gender)
      const terms = normalizeSearch(f.q).split(' ').filter(Boolean)
      const out = rows.filter((r) => {
        const hay = normalizeSearch(`${r.first_name} ${r.last_name} ${r.general_notes ?? ''}`)
        return terms.every((t) => hay.includes(t))
      })
      const dir = sort.dir === 'asc' ? 1 : -1
      out.sort((a, b) => dir * hebrewCollator.compare(a.first_name, b.first_name))
      return { rows: out.slice(0, limit), total: out.length }
    },

    async listFacets(gender): Promise<FacetRow[]> {
      return (await allCandidates())
        .filter((r) => r.gender === gender)
        .map(({ city, region, institution, community }) => ({
          city,
          region,
          institution,
          community,
        }))
    },

    async getCandidate(id) {
      const snap = await guard(() => candidates.doc(id).get())
      return snap.exists ? withAge(snap.data() as StoredCandidate) : null
    },

    async saveCandidate(payload) {
      const inLaws: InLaw[] = payload.in_laws
        .filter((l) => l.full_name.trim() !== '')
        .map((l) => ({ ...l, id: uid() }))
      if (payload.id) {
        const ref = candidates.doc(payload.id)
        const snap = await guard(() => ref.get())
        if (!snap.exists) throw new Error(he.detail.notFound)
        const prev = snap.data() as StoredCandidate
        await guard(() =>
          ref.set(
            clean({
              ...prev,
              ...payload.candidate,
              family: payload.family,
              in_laws: inLaws,
              updated_at: now(),
            }),
          ),
        )
        return payload.id
      }
      const id = uid()
      const row: StoredCandidate = {
        ...payload.candidate,
        id,
        owner_id: user.id,
        created_at: now(),
        updated_at: now(),
        resume: null,
        family: payload.family,
        in_laws: inLaws,
      }
      await guard(() => candidates.doc(id).set(clean(row)))
      return id
    },

    async deleteCandidate(id) {
      const ref = candidates.doc(id)
      const snap = await guard(() => ref.get())
      if (!snap.exists) throw new Error(he.detail.notFound)
      const c = snap.data() as StoredCandidate
      await guard(() => ref.delete())
      if (c.resume) await dropFile(c.resume.storage_path)
      // unlink ideas that pointed at this candidate
      for (const field of ['male_id', 'female_id'] as const) {
        const linked = await guard(() => ideas.where(field, '==', id).get())
        for (const d of linked.docs)
          await guard(() => ideas.doc(d.id).update({ [field]: null, updated_at: now() }))
      }
    },

    async uploadResume(target, file, mime, onProgress) {
      onProgress(15)
      const ref = candidates.doc(target.id)
      const snap = await guard(() => ref.get())
      if (!snap.exists) throw new Error(he.detail.notFound)
      onProgress(35)
      const { path } = await storeFile(file, mime)
      onProgress(85)
      const meta: ResumeMeta = {
        id: uid(),
        candidate_id: target.id,
        storage_path: path,
        file_name: file.name,
        mime_type: mime,
        size_bytes: file.size,
        uploaded_at: now(),
      }
      const prev = (snap.data() as StoredCandidate).resume
      await guard(() => ref.update({ resume: clean(meta), updated_at: now() }))
      if (prev) await dropFile(prev.storage_path)
      onProgress(100)
      return meta
    },

    async deleteResume(resume) {
      await guard(() =>
        candidates.doc(resume.candidate_id).update({ resume: null, updated_at: now() }),
      )
      await dropFile(resume.storage_path)
    },

    async getResumeUrl(resume, { expiresIn }) {
      const url = URL.createObjectURL(await readFile(resume))
      setTimeout(() => URL.revokeObjectURL(url), expiresIn * 1000)
      return url
    },

    async getResumeBlob(resume) {
      return readFile(resume)
    },

    async createShareLink() {
      return null
    },

    async sendResumeEmail() {
      throw new Error(he.email.serverUnavailableDemo)
    },

    async loadSampleData() {
      const existing = await allCandidates()
      if (existing.some((r) => r.is_sample)) return 0
      const rows = seedRows(user.id)
      // Six sample candidates get a generated sample resume so view/download/email can be tried.
      for (const [i, row] of rows.entries()) {
        if (i < 6 && assets) {
          const blob = await sampleResumeBlob(row)
          if (blob) {
            const { path } = await storeFile(blob, 'image/png')
            row.resume = {
              id: uid(),
              candidate_id: row.id,
              storage_path: path,
              file_name: `קורות חיים - ${row.first_name} ${row.last_name} (דוגמה).png`,
              mime_type: 'image/png',
              size_bytes: blob.size,
              uploaded_at: now(),
            }
          }
        }
        await guard(() => candidates.doc(row.id).set(clean(row)))
      }
      for (const idea of seedIdeas(rows))
        await guard(() => ideas.doc(idea.id).set(clean({ ...idea, is_sample: true })))
      return rows.length
    },

    async clearSampleData() {
      const rows = (await allCandidates()).filter((r) => r.is_sample)
      for (const r of rows) {
        await guard(() => candidates.doc(r.id).delete())
        if (r.resume) await dropFile(r.resume.storage_path)
      }
      const sampleIdeas = await guard(() => ideas.where('is_sample', '==', true).get())
      for (const d of sampleIdeas.docs) await guard(() => ideas.doc(d.id).delete())
      return rows.length
    },

    async listIdeas() {
      const list = await guard(() => readAll<Idea>(ideas))
      return list.sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at),
      )
    },

    async saveIdea(input, id) {
      if (id) {
        const ref = ideas.doc(id)
        await guard(() => ref.update(clean({ ...input, updated_at: now() })))
        const snap = await guard(() => ref.get())
        return snap.data() as unknown as Idea
      }
      const idea: Idea = { ...input, id: uid(), created_at: now(), updated_at: now() }
      await guard(() => ideas.doc(idea.id).set(clean(idea)))
      return idea
    },

    async deleteIdea(id) {
      await guard(() => ideas.doc(id).delete())
    },
  }

  return { auth, data }
}
