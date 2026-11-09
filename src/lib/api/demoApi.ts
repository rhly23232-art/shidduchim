/**
 * Local demo backend (no server): IndexedDB storage, per-account isolation mirroring RLS.
 * Active only when Supabase env vars are not configured.
 */
import { createStore, del as idbDel, get as idbGet, set as idbSet, type UseStore } from 'idb-keyval'
import { SEED_CANDIDATES, SEED_IDEAS } from '@/data/seedData'
import { ageFromBirthDate } from '../age'
import { gregorianToHebrew } from '../hebrewDate'
import { he } from '../strings.he'
import type {
  CandidateFull,
  CandidateRow,
  Idea,
  InLaw,
  ResumeMeta,
  SaveCandidatePayload,
} from '../types'
import { hebrewCollator, normalizeSearch, sleep } from '../utils'
import type { AppUser, AuthApi, DataApi, FacetRow } from './types'

export const DEMO_EMAIL = 'demo@shidduchim.local'
export const DEMO_PASSWORD = 'shidduch123'

interface DemoUser extends AppUser {
  salt: string
  hash: string
}
export type StoredCandidate = Omit<CandidateFull, 'age'>

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

export function seedRows(ownerId: string): StoredCandidate[] {
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
      is_sample: true,
      family: s.family,
      in_laws: s.in_laws.map((l) => ({ ...l, id: uid() })),
    }
  })
}

// ---------------- ideas storage ----------------
interface Workspace {
  version: number
  ideas: Idea[]
}
const WS_VERSION = 2
async function setWs(userId: string, ws: Workspace) {
  await set(`ws:${userId}`, ws)
}

/** Sample ideas for the demo account, linked to its candidates by name. */
export function seedIdeas(rows: StoredCandidate[]): Idea[] {
  const byIndex = (i: number) => {
    const c = SEED_CANDIDATES[i]!.candidate
    return (
      rows.find((r) => r.first_name === c.first_name && r.last_name === c.last_name)?.id ?? null
    )
  }
  const day = 86_400_000
  return SEED_IDEAS.map((d, i) => {
    const at = new Date(Date.now() - (i + 1) * day).toISOString()
    return {
      id: uid(),
      title: d.title,
      body: d.body,
      male_id: d.male === null ? null : byIndex(d.male),
      female_id: d.female === null ? null : byIndex(d.female),
      pinned: d.pinned,
      done: false,
      created_at: at,
      updated_at: at,
    }
  })
}

async function getWs(userId: string): Promise<Workspace> {
  const stored = await get<Workspace & { ideas?: Idea[] }>(`ws:${userId}`)
  if (stored?.version === WS_VERSION) return stored
  // First use, or upgrading the earlier workspace format: keep existing ideas only.
  const user = (await getUsers()).find((u) => u.id === userId)
  const isDemo = user?.email === DEMO_EMAIL
  if (isDemo) await seedSampleResumes(userId)
  const ideas = stored?.ideas ?? (isDemo ? seedIdeas(await getData(userId)) : [])
  const fresh: Workspace = { version: WS_VERSION, ideas }
  await setWs(userId, fresh)
  return fresh
}

/** A friendly generated "resume" image so the demo's view/download/email work out of the box. */
export async function sampleResumeBlob(c: StoredCandidate): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1240
    canvas.height = 1754
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fbf9f5'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#16233f'
    ctx.fillRect(0, 0, canvas.width, 230)
    ctx.fillStyle = '#b8975e'
    ctx.fillRect(0, 230, canvas.width, 8)
    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 72px "Frank Ruhl Libre", Georgia, serif'
    ctx.fillText(`${c.first_name} ${c.last_name}`, 1140, 135)
    ctx.font = '34px Heebo, Arial, sans-serif'
    ctx.fillStyle = '#e9e1cf'
    ctx.fillText('קורות חיים · לדוגמה בלבד', 1140, 195)
    const rows: [string, string | null | undefined][] = [
      ['תאריך לידה', gregorianToHebrew(c.birth_date)],
      ['עיר מגורים', c.city],
      ['עדה / חוג', [c.community, c.chassidut].filter(Boolean).join(' · ')],
      [c.gender === 'male' ? 'ישיבה' : 'סמינר', c.institution],
      ['עיסוק', c.occupation],
      ['גובה', c.height_cm ? `${c.height_cm} ס״מ` : null],
      ['שם האב', c.family?.father_name],
      ['עיסוק האב', c.family?.father_occupation],
      ['שם האם', c.family?.mother_name],
      [
        'מיקום במשפחה',
        c.family?.birth_order
          ? `${c.family.birth_order} מתוך ${(c.family.siblings_count ?? 0) + 1}`
          : null,
      ],
      ['אופי', c.character_description],
      ['סגנון הבית', c.desired_home_style],
    ]
    let y = 340
    for (const [k, v] of rows) {
      if (!v) continue
      ctx.fillStyle = '#5b6474'
      ctx.font = '30px Heebo, Arial, sans-serif'
      ctx.fillText(k, 1140, y)
      ctx.fillStyle = '#1b2333'
      ctx.font = '40px Heebo, Arial, sans-serif'
      ctx.fillText(v.length > 48 ? `${v.slice(0, 47)}…` : v, 1140, y + 52)
      ctx.strokeStyle = '#e6e0d4'
      ctx.beginPath()
      ctx.moveTo(100, y + 80)
      ctx.lineTo(1140, y + 80)
      ctx.stroke()
      y += 118
    }
    return await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  } catch {
    return null
  }
}

/** Attach generated sample resumes to the first few demo candidates (once). */
async function seedSampleResumes(userId: string) {
  const rows = await getData(userId)
  if (rows.some((r) => r.resume)) return // already has resumes (seeded before or uploaded)
  const targets = rows.slice(0, 6)
  let changed = false
  for (const c of targets) {
    const blob = await sampleResumeBlob(c)
    if (!blob) continue
    const meta: ResumeMeta = {
      id: uid(),
      candidate_id: c.id,
      storage_path: `${userId}/${c.id}/resume.png`,
      file_name: `קורות חיים - ${c.first_name} ${c.last_name}.png`,
      mime_type: 'image/png',
      size_bytes: blob.size,
      uploaded_at: now(),
    }
    await set(`file:${meta.id}`, blob)
    c.resume = meta
    changed = true
  }
  if (changed) await setData(userId, rows)
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
    await seedSampleResumes(user.id)
  })()
  return demoReady
}

const withAge = (c: StoredCandidate): CandidateFull => ({
  ...c,
  age: ageFromBirthDate(c.birth_date),
})
const toRow = (c: StoredCandidate): CandidateRow => {
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
    const userId = await requireUserId()
    await getWs(userId) // first visit: sample ideas and resumes for the demo account
    const rows = await getData(userId)
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
    const ws = await getWs(userId)
    ws.ideas = ws.ideas.map((d) => ({
      ...d,
      male_id: d.male_id === id ? null : d.male_id,
      female_id: d.female_id === id ? null : d.female_id,
    }))
    await setWs(userId, ws)
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

  async getResumeBlob(resume) {
    await requireUserId()
    const blob = await get<Blob>(`file:${resume.id}`)
    if (!blob) throw new Error(he.resume.downloadFailed)
    return blob
  },

  // ---------------- matchmaker workspace ----------------

  async loadSampleData() {
    const userId = await requireUserId()
    const rows = await getData(userId)
    if (rows.some((r) => r.is_sample)) return 0
    const samples = seedRows(userId)
    await setData(userId, [...samples, ...rows])
    const ws = await getWs(userId)
    ws.ideas = [...seedIdeas(samples), ...ws.ideas]
    await setWs(userId, ws)
    return samples.length
  },

  async clearSampleData() {
    const userId = await requireUserId()
    const rows = await getData(userId)
    const samples = rows.filter((r) => r.is_sample)
    for (const r of samples) if (r.resume) await del(`file:${r.resume.id}`)
    await setData(
      userId,
      rows.filter((r) => !r.is_sample),
    )
    const gone = new Set(samples.map((r) => r.id))
    const ws = await getWs(userId)
    ws.ideas = ws.ideas.filter(
      (i) => !(i.male_id && gone.has(i.male_id)) && !(i.female_id && gone.has(i.female_id)),
    )
    await setWs(userId, ws)
    return samples.length
  },

  async listIdeas() {
    const ws = await getWs(await requireUserId())
    return [...ws.ideas].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at),
    )
  },

  async saveIdea(input, id) {
    const userId = await requireUserId()
    const ws = await getWs(userId)
    if (id) {
      const idx = ws.ideas.findIndex((x) => x.id === id)
      if (idx === -1) throw new Error(he.detail.notFound)
      ws.ideas[idx] = { ...ws.ideas[idx]!, ...input, updated_at: now() }
      await setWs(userId, ws)
      return ws.ideas[idx]!
    }
    const idea: Idea = { ...input, id: uid(), created_at: now(), updated_at: now() }
    ws.ideas.unshift(idea)
    await setWs(userId, ws)
    return idea
  },

  async deleteIdea(id) {
    const userId = await requireUserId()
    const ws = await getWs(userId)
    ws.ideas = ws.ideas.filter((x) => x.id !== id)
    await setWs(userId, ws)
  },
}
