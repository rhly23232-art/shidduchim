/**
 * Local demo backend (no server): IndexedDB storage, per-account isolation mirroring RLS.
 * Active only when Supabase env vars are not configured.
 */
import { createStore, del as idbDel, get as idbGet, set as idbSet, type UseStore } from 'idb-keyval'
import { SEED_CANDIDATES } from '@/data/seedData'
import { ageFromBirthDate } from '../age'
import { gregorianToHebrew } from '../hebrewDate'
import { he } from '../strings.he'
import type { CandidateFull, CandidateRow, InLaw, ResumeMeta, SaveCandidatePayload } from '../types'
import { hebrewCollator, normalizeSearch, sleep } from '../utils'
import type { AppUser, AuthApi, DataApi, FacetRow } from './types'

export const DEMO_EMAIL = 'demo@shidduchim.local'
export const DEMO_PASSWORD = 'shidduch123'

interface DemoUser extends AppUser {
  salt: string
  hash: string
}
type StoredCandidate = Omit<CandidateFull, 'age'>

/**
 * IndexedDB when available; transparent in-memory fallback when the browser blocks it
 * (private windows, sandboxed iframes) so the demo always works.
 */
const memory = new Map<string, unknown>()
let idbStore: UseStore | null = null
try {
  idbStore = typeof indexedDB === 'undefined' ? null : createStore('shidduchim-demo', 'kv')
} catch {
  idbStore = null
}
async function get<T>(key: string): Promise<T | undefined> {
  if (idbStore) {
    try {
      return await idbGet<T>(key, idbStore)
    } catch {
      idbStore = null
    }
  }
  return memory.get(key) as T | undefined
}
async function set(key: string, value: unknown): Promise<void> {
  memory.set(key, value)
  if (idbStore) {
    try {
      await idbSet(key, value, idbStore)
    } catch {
      idbStore = null
    }
  }
}
async function del(key: string): Promise<void> {
  memory.delete(key)
  if (idbStore) {
    try {
      await idbDel(key, idbStore)
    } catch {
      idbStore = null
    }
  }
}
const SESSION_KEY = 'shidduchim-demo-session'
const LATENCY = 120

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getUsers(): Promise<DemoUser[]> {
  return (await get<DemoUser[]>('users')) ?? []
}

async function getData(userId: string): Promise<StoredCandidate[]> {
  return (await get<StoredCandidate[]>(`data:${userId}`)) ?? []
}
async function setData(userId: string, rows: StoredCandidate[]) {
  await set(`data:${userId}`, rows)
}

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}
function writeSession(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable — session lives in memory only */
  }
  memorySession = id
}
let memorySession: string | null = readSession()

const listeners = new Set<(u: AppUser | null) => void>()
async function currentUser(): Promise<DemoUser | null> {
  const id = memorySession
  if (!id) return null
  return (await getUsers()).find((u) => u.id === id) ?? null
}
const publicUser = (u: DemoUser): AppUser => ({ id: u.id, email: u.email, fullName: u.fullName })
async function emit() {
  const u = await currentUser()
  listeners.forEach((cb) => cb(u ? publicUser(u) : null))
}

async function requireUserId(): Promise<string> {
  const u = await currentUser()
  if (!u) throw new Error(he.auth.sessionExpired)
  return u.id
}

function seedRows(ownerId: string): StoredCandidate[] {
  const base = Date.now()
  return SEED_CANDIDATES.map((s, i) => {
    const ts = new Date(base - i * 3_600_000).toISOString()
    return {
      ...s.candidate,
      hebrew_birth_date: gregorianToHebrew(s.candidate.birth_date),
      id: uid(),
      owner_id: ownerId,
      created_at: ts,
      updated_at: ts,
      resume: null,
      family: s.family,
      in_laws: s.in_laws.map((l) => ({ ...l, id: uid() })),
    }
  })
}

let demoReady: Promise<void> | null = null
/** Creates the demo account (with seed data) once per browser. */
function ensureDemoAccount(): Promise<void> {
  demoReady ??= (async () => {
    const users = await getUsers()
    if (users.some((u) => u.email === DEMO_EMAIL)) return
    const salt = uid()
    const user: DemoUser = {
      id: uid(),
      email: DEMO_EMAIL,
      fullName: 'שדכן הדגמה',
      salt,
      hash: await hashPassword(DEMO_PASSWORD, salt),
    }
    await set('users', [...users, user])
    await setData(user.id, seedRows(user.id))
  })()
  return demoReady
}

const withAge = (c: StoredCandidate): CandidateFull => ({
  ...c,
  age: ageFromBirthDate(c.birth_date),
})
const toRow = (c: StoredCandidate): CandidateRow => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { family, in_laws, ...rest } = withAge(c)
  return rest
}

// ---------- auth ------------------------------------------------------------------
export const demoAuth: AuthApi = {
  async getUser() {
    await ensureDemoAccount()
    const u = await currentUser()
    return u ? publicUser(u) : null
  },
  onAuthChange(cb) {
    listeners.add(cb)
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY) {
        memorySession = e.newValue
        void emit()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(cb)
      window.removeEventListener('storage', onStorage)
    }
  },
  async signIn(email, password) {
    await ensureDemoAccount()
    await sleep(LATENCY * 2)
    const u = (await getUsers()).find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!u || (await hashPassword(password, u.salt)) !== u.hash) {
      throw new Error(he.auth.invalidCredentials)
    }
    writeSession(u.id)
    await emit()
    return publicUser(u)
  },
  async signUp(email, password, fullName) {
    await ensureDemoAccount()
    await sleep(LATENCY * 2)
    const users = await getUsers()
    const normalized = email.trim().toLowerCase()
    if (users.some((x) => x.email.toLowerCase() === normalized)) throw new Error(he.auth.emailTaken)
    const salt = uid()
    const user: DemoUser = {
      id: uid(),
      email: normalized,
      fullName: fullName.trim(),
      salt,
      hash: await hashPassword(password, salt),
    }
    await set('users', [...users, user])
    await setData(user.id, [])
    writeSession(user.id)
    await emit()
    return { signedIn: true }
  },
  async signOut() {
    writeSession(null)
    await emit()
  },
}

// ---------- data ------------------------------------------------------------------
export const demoData: DataApi = {
  supportsServerEmail: false,
  supportsShareLinks: false,

  async countCandidates() {
    const rows = await getData(await requireUserId())
    return {
      male: rows.filter((r) => r.gender === 'male').length,
      female: rows.filter((r) => r.gender === 'female').length,
    }
  },

  async listCandidates(maxRows) {
    const rows = await getData(await requireUserId())
    await sleep(LATENCY)
    if (rows.length > maxRows) return { rows: [], overLimit: true }
    return { rows: rows.map(toRow), overLimit: false }
  },

  // Demo data never exceeds the client-side limit, but keep parity with the server contract.
  async queryCandidates(gender, f, sort, limit) {
    const all = (await getData(await requireUserId())).map(toRow)
    const rows = all.filter((r) => r.gender === gender)
    const terms = normalizeSearch(f.q).split(' ').filter(Boolean)
    const filtered = rows.filter((r) => {
      if (
        (f.ageMin > 18 || f.ageMax < 45) &&
        (r.age === null || r.age < f.ageMin || r.age > f.ageMax)
      )
        return false
      if (
        (f.cities.length || f.regions.length) &&
        !f.cities.includes(r.city ?? '') &&
        !f.regions.includes(r.region ?? '')
      )
        return false
      if (f.institutions.length && !f.institutions.includes(r.institution ?? '')) return false
      if (f.communities.length && !f.communities.includes(r.community ?? '')) return false
      const hay = normalizeSearch(`${r.first_name} ${r.last_name} ${r.general_notes ?? ''}`)
      return terms.every((t) => hay.includes(t))
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    filtered.sort((a, b) => dir * hebrewCollator.compare(a.first_name, b.first_name))
    return { rows: filtered.slice(0, limit), total: filtered.length }
  },

  async listFacets(gender): Promise<FacetRow[]> {
    const rows = await getData(await requireUserId())
    return rows
      .filter((r) => r.gender === gender)
      .map(({ city, region, institution, community }) => ({ city, region, institution, community }))
  },

  async getCandidate(id) {
    const rows = await getData(await requireUserId())
    await sleep(LATENCY)
    const c = rows.find((r) => r.id === id)
    return c ? withAge(c) : null
  },

  async saveCandidate(payload: SaveCandidatePayload) {
    const userId = await requireUserId()
    const rows = await getData(userId)
    await sleep(LATENCY * 2)
    const inLaws: InLaw[] = payload.in_laws
      .filter((l) => l.full_name.trim() !== '')
      .map((l) => ({ ...l, id: uid() }))
    if (payload.id) {
      const idx = rows.findIndex((r) => r.id === payload.id)
      if (idx === -1) throw new Error(he.detail.notFound)
      const prev = rows[idx]!
      rows[idx] = {
        ...prev,
        ...payload.candidate,
        family: payload.family,
        in_laws: inLaws,
        updated_at: now(),
      }
      await setData(userId, rows)
      return payload.id
    }
    const id = uid()
    const ts = now()
    rows.unshift({
      ...payload.candidate,
      id,
      owner_id: userId,
      created_at: ts,
      updated_at: ts,
      resume: null,
      family: payload.family,
      in_laws: inLaws,
    })
    await setData(userId, rows)
    return id
  },

  async deleteCandidate(id) {
    const userId = await requireUserId()
    const rows = await getData(userId)
    const c = rows.find((r) => r.id === id)
    if (!c) throw new Error(he.detail.notFound)
    if (c.resume) await del(`file:${c.resume.id}`)
    await setData(
      userId,
      rows.filter((r) => r.id !== id),
    )
  },

  async uploadResume(target, file, mime, onProgress) {
    const userId = await requireUserId()
    const rows = await getData(userId)
    const c = rows.find((r) => r.id === target.id)
    if (!c) throw new Error(he.detail.notFound)
    // Reading into IndexedDB is near-instant; animate progress so feedback is visible.
    for (const pct of [12, 35, 61, 84]) {
      onProgress(pct)
      await sleep(90)
    }
    const meta: ResumeMeta = {
      id: uid(),
      candidate_id: c.id,
      storage_path: `${userId}/${c.id}/${file.name}`,
      file_name: file.name,
      mime_type: mime,
      size_bytes: file.size,
      uploaded_at: now(),
    }
    await set(`file:${meta.id}`, new Blob([await file.arrayBuffer()], { type: mime }))
    if (c.resume) await del(`file:${c.resume.id}`)
    c.resume = meta
    c.updated_at = now()
    await setData(userId, rows)
    onProgress(100)
    return meta
  },

  async deleteResume(resume) {
    const userId = await requireUserId()
    const rows = await getData(userId)
    const c = rows.find((r) => r.id === resume.candidate_id)
    if (!c) throw new Error(he.detail.notFound)
    await del(`file:${resume.id}`)
    c.resume = null
    await setData(userId, rows)
  },

  async getResumeUrl(resume, { expiresIn }) {
    await requireUserId()
    const blob = await get<Blob>(`file:${resume.id}`)
    if (!blob) throw new Error(he.resume.downloadFailed)
    const url = URL.createObjectURL(blob)
    setTimeout(() => URL.revokeObjectURL(url), expiresIn * 1000)
    return url
  },

  async createShareLink() {
    return null
  },

  async sendResumeEmail() {
    throw new Error(he.email.serverUnavailableDemo)
  },
}
