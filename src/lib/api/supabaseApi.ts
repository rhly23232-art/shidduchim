import type { User } from '@supabase/supabase-js'
import type { Database, Json } from '../database.types'
import { env } from '../env'
import { requireSupabase } from '../supabase'
import type {
  Idea,
  CandidateFull,
  CandidateRow,
  CandidateStatus,
  EducationEntry,
  Gender,
  ResumeMeta,
} from '../types'
import { he } from '../strings.he'
import type {
  AppUser,
  AuthApi,
  CandidateFilters,
  DataApi,
  FacetRow,
  SortState,
  UploadTarget,
} from './types'

type ViewRow = Database['public']['Views']['candidates_view']['Row']

const BUCKET = 'resumes'

// ---------- mapping ----------------------------------------------------------------
function toEducation(json: Json | null): EducationEntry[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const o = item as Record<string, Json | undefined>
    return [
      {
        name: typeof o.name === 'string' ? o.name : '',
        type: typeof o.type === 'string' ? o.type : '',
        years: typeof o.years === 'string' ? o.years : '',
      },
    ]
  })
}

function mapRow(r: ViewRow): CandidateRow {
  return {
    id: r.id!,
    owner_id: r.owner_id!,
    gender: r.gender!,
    first_name: r.first_name ?? '',
    last_name: r.last_name ?? '',
    birth_date: r.birth_date,
    hebrew_birth_date: r.hebrew_birth_date,
    city: r.city,
    region: r.region,
    country_of_origin: r.country_of_origin,
    community: r.community,
    chassidut: r.chassidut,
    height_cm: r.height_cm,
    appearance: r.appearance,
    institution: r.institution,
    institution_type: r.institution_type,
    education_history: toEducation(r.education_history),
    occupation: r.occupation,
    degree: r.degree,
    future_plans: r.future_plans,
    character_description: r.character_description,
    desired_home_style: r.desired_home_style,
    special_requirements: r.special_requirements,
    general_notes: r.general_notes,
    status: (r.status ?? 'active') as CandidateStatus,
    created_at: r.created_at ?? '',
    updated_at: r.updated_at ?? '',
    age: r.age,
    resume: r.resume_id
      ? {
          id: r.resume_id,
          candidate_id: r.id!,
          storage_path: r.resume_storage_path!,
          file_name: r.resume_file_name!,
          mime_type: r.resume_mime_type!,
          size_bytes: r.resume_size_bytes!,
          uploaded_at: r.resume_uploaded_at!,
        }
      : null,
  }
}

function mapUser(u: User): AppUser {
  const meta = u.user_metadata as { full_name?: unknown } | undefined
  return {
    id: u.id,
    email: u.email ?? '',
    fullName: typeof meta?.full_name === 'string' ? meta.full_name : null,
  }
}

/** Translate Supabase auth errors into Hebrew. */
function authError(err: { message: string; code?: string }): Error {
  const code = err.code ?? ''
  if (code === 'invalid_credentials' || /invalid login/i.test(err.message))
    return new Error(he.auth.invalidCredentials)
  if (code === 'user_already_exists' || /already registered/i.test(err.message))
    return new Error(he.auth.emailTaken)
  return new Error(err.message)
}

/** Storage keys must be ASCII-safe; the original (Hebrew) name is kept in the DB. */
function storageFileName(original: string): string {
  const ext = original.split('.').pop()?.toLowerCase() ?? 'bin'
  const stem = original
    .slice(0, original.length - ext.length - 1)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${Date.now()}-${stem || 'resume'}.${ext}`
}

function isoDateYearsAgo(years: number, extraDays = 0): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  d.setDate(d.getDate() + extraDays)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Escape a user term for a PostgREST `or=(...)` ilike filter. */
function orTerm(term: string): string {
  return `"*${term.replace(/[\\"]/g, '').replace(/[%*]/g, '')}*"`
}

// ---------- auth ------------------------------------------------------------------
export const supabaseAuth: AuthApi = {
  async getUser() {
    const sb = requireSupabase()
    const { data } = await sb.auth.getSession()
    return data.session?.user ? mapUser(data.session.user) : null
  },
  onAuthChange(cb) {
    const sb = requireSupabase()
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      cb(session?.user ? mapUser(session.user) : null)
    })
    return () => data.subscription.unsubscribe()
  },
  async signIn(email, password) {
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password })
    if (error) throw authError(error)
    return mapUser(data.user)
  },
  async signUp(email, password, fullName) {
    const { data, error } = await requireSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    })
    if (error) throw authError(error)
    // Supabase returns a user with no identities when the email already exists (anti-enumeration).
    if (data.user && data.user.identities?.length === 0) throw new Error(he.auth.emailTaken)
    return { signedIn: !!data.session }
  },
  async signOut() {
    await requireSupabase().auth.signOut()
  },
}

// ---------- data ------------------------------------------------------------------
export const supabaseData: DataApi = {
  supportsServerEmail: true,
  supportsShareLinks: true,

  async countCandidates() {
    const sb = requireSupabase()
    const [m, f] = await Promise.all([
      sb.from('candidates').select('id', { count: 'exact', head: true }).eq('gender', 'male'),
      sb.from('candidates').select('id', { count: 'exact', head: true }).eq('gender', 'female'),
    ])
    if (m.error) throw m.error
    if (f.error) throw f.error
    return { male: m.count ?? 0, female: f.count ?? 0 }
  },

  async listCandidates(maxRows) {
    const sb = requireSupabase()
    const PAGE = 1000
    const rows: CandidateRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error, count } = await sb
        .from('candidates_view')
        .select('*', { count: from === 0 ? 'exact' : undefined })
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (from === 0 && (count ?? 0) > maxRows) return { rows: [], overLimit: true }
      rows.push(...data.map(mapRow))
      if (data.length < PAGE) break
    }
    return { rows, overLimit: false }
  },

  async queryCandidates(gender: Gender, f: CandidateFilters, sort: SortState, limit: number) {
    const sb = requireSupabase()
    let q = sb.from('candidates_view').select('*', { count: 'exact' }).eq('gender', gender)
    if (f.ageMin > 18) q = q.lte('birth_date', isoDateYearsAgo(f.ageMin))
    if (f.ageMax < 45) q = q.gt('birth_date', isoDateYearsAgo(f.ageMax + 1))
    const loc = [
      ...f.cities.map((c) => `city.eq.${JSON.stringify(c)}`),
      ...f.regions.map((r) => `region.eq.${JSON.stringify(r)}`),
    ]
    if (loc.length) q = q.or(loc.join(','))
    if (f.institutions.length) q = q.in('institution', f.institutions)
    if (f.eda === 'chasidut') q = q.or('chassidut.ilike.*חסיד*,community.ilike.*חסיד*')
    else if (f.eda === 'litai') q = q.or('chassidut.ilike.*ליטא*,community.ilike.*ליטא*')
    else if (f.eda === 'mizrah')
      q = q.or(
        [
          'ספרד',
          'מזרח',
          'תימנ',
          'מרוק',
          'עיראק',
          'פרס',
          'תוניס',
          'לוב',
          'כורד',
          'בוכר',
          'הודי',
          'גרוזי',
          'סורי',
        ]
          .map((w) => `community.ilike.*${w}*`)
          .join(','),
      )
    if (f.eda && f.edaText.trim()) {
      const t = orTerm(f.edaText.trim())
      q = q.or(`community.ilike.${t},chassidut.ilike.${t}`)
    }
    for (const term of f.q.split(/\s+/).filter(Boolean)) {
      const t = orTerm(term)
      q = q.or(
        `first_name.ilike.${t},last_name.ilike.${t},general_notes.ilike.${t},special_requirements.ilike.${t}`,
      )
    }
    const asc = sort.dir === 'asc'
    switch (sort.key) {
      case 'name':
        q = q.order('first_name', { ascending: asc }).order('last_name', { ascending: asc })
        break
      case 'age': // older age = earlier birth date
        q = q.order('birth_date', { ascending: !asc, nullsFirst: false })
        break
      case 'city':
        q = q.order('city', { ascending: asc, nullsFirst: false })
        break
      case 'institution':
        q = q.order('institution', { ascending: asc, nullsFirst: false })
        break
      case 'occupation':
        q = q.order('occupation', { ascending: asc, nullsFirst: false })
        break
      case 'updated':
        q = q.order('updated_at', { ascending: asc })
        break
    }
    const { data, error, count } = await q.order('id').limit(limit)
    if (error) throw error
    return { rows: data.map(mapRow), total: count ?? data.length }
  },

  async listFacets(gender) {
    const sb = requireSupabase()
    const out: FacetRow[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('candidates')
        .select('city, region, institution, community')
        .eq('gender', gender)
        .range(from, from + PAGE - 1)
      if (error) throw error
      out.push(...data)
      if (data.length < PAGE) break
    }
    return out
  },

  async getCandidate(id) {
    const sb = requireSupabase()
    const [row, fam, laws] = await Promise.all([
      sb.from('candidates_view').select('*').eq('id', id).maybeSingle(),
      sb.from('family_details').select('*').eq('candidate_id', id).maybeSingle(),
      sb.from('in_laws').select('*').eq('candidate_id', id).order('sort_order'),
    ])
    if (row.error) throw row.error
    if (fam.error) throw fam.error
    if (laws.error) throw laws.error
    if (!row.data) return null
    const full: CandidateFull = {
      ...mapRow(row.data),
      family: fam.data
        ? {
            father_name: fam.data.father_name,
            father_occupation: fam.data.father_occupation,
            mother_name: fam.data.mother_name,
            mother_occupation: fam.data.mother_occupation,
            mother_maiden_name: fam.data.mother_maiden_name,
            lineage: fam.data.lineage,
            siblings_count: fam.data.siblings_count,
            birth_order: fam.data.birth_order,
          }
        : null,
      in_laws: laws.data.map((l) => ({
        id: l.id,
        relation: l.relation,
        full_name: l.full_name,
        details: l.details,
      })),
    }
    return full
  },

  async saveCandidate(payload) {
    const { data, error } = await requireSupabase().rpc('save_candidate', {
      payload: payload as unknown as Json,
    })
    if (error) throw error
    return data
  },

  async deleteCandidate(id) {
    const sb = requireSupabase()
    const { data: resume } = await sb
      .from('resumes')
      .select('storage_path')
      .eq('candidate_id', id)
      .maybeSingle()
    const { error } = await sb.from('candidates').delete().eq('id', id)
    if (error) throw error
    if (resume?.storage_path) await sb.storage.from(BUCKET).remove([resume.storage_path])
  },

  async uploadResume(target: UploadTarget, file: File, mime: string, onProgress) {
    const sb = requireSupabase()
    const { data: sessionData } = await sb.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error(he.auth.sessionExpired)
    const path = `${target.owner_id}/${target.id}/${storageFileName(file.name)}`

    // XHR (not fetch) so we can report real upload progress.
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const encoded = path.split('/').map(encodeURIComponent).join('/')
      xhr.open('POST', `${env.supabaseUrl}/storage/v1/object/${BUCKET}/${encoded}`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('apikey', env.supabaseAnonKey!)
      xhr.setRequestHeader('Content-Type', mime)
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.setRequestHeader('cache-control', '3600')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve()
        let msg: string = he.resume.uploadFailed
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string; statusCode?: string }
          if (body.statusCode === '413' || /size/i.test(body.message ?? ''))
            msg = he.resume.tooLarge
          else if (/mime/i.test(body.message ?? '')) msg = he.resume.invalidType
        } catch {
          /* keep generic message */
        }
        reject(new Error(msg))
      }
      xhr.onerror = () => reject(new Error(he.resume.uploadFailed))
      xhr.send(file)
    })

    const { data, error } = await sb
      .from('resumes')
      .upsert(
        {
          candidate_id: target.id,
          storage_path: path,
          file_name: file.name,
          mime_type: mime,
          size_bytes: file.size,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'candidate_id' },
      )
      .select()
      .single()
    if (error) {
      await sb.storage.from(BUCKET).remove([path])
      throw error
    }
    // Remove the replaced file only after the new one is fully registered.
    if (target.resume && target.resume.storage_path !== path) {
      await sb.storage.from(BUCKET).remove([target.resume.storage_path])
    }
    onProgress(100)
    return data
  },

  async deleteResume(resume) {
    const sb = requireSupabase()
    const { error } = await sb.from('resumes').delete().eq('id', resume.id)
    if (error) throw error
    await sb.storage.from(BUCKET).remove([resume.storage_path])
  },

  async getResumeUrl(resume, { download, expiresIn }) {
    const { data, error } = await requireSupabase()
      .storage.from(BUCKET)
      .createSignedUrl(
        resume.storage_path,
        expiresIn,
        download ? { download: resume.file_name } : undefined,
      )
    if (error) throw error
    return data.signedUrl
  },

  async createShareLink(resume) {
    return this.getResumeUrl(resume, { download: true, expiresIn: 60 * 60 * 24 * 7 })
  },

  async sendResumeEmail(input) {
    const { data, error } = await requireSupabase().functions.invoke<{
      ok?: boolean
      error?: string
    }>('send-resume-email', { body: input })
    if (error) {
      // FunctionsHttpError carries the JSON response in `context`
      const ctx = (error as { context?: Response }).context
      let detail: string | undefined
      if (ctx && typeof ctx.json === 'function') {
        try {
          detail = ((await ctx.json()) as { error?: string }).error
        } catch {
          /* ignore */
        }
      }
      throw new Error(detail ?? he.email.serviceDown)
    }
    if (!data?.ok) throw new Error(data?.error ?? he.email.sendFailed)
  },

  async getResumeBlob(resume) {
    const { data, error } = await requireSupabase()
      .storage.from(BUCKET)
      .download(resume.storage_path)
    if (error) throw error
    return data
  },

  // ---------------- matchmaker workspace ----------------

  async listIdeas() {
    const { data, error } = await requireSupabase()
      .from('ideas')
      .select('*')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data as Idea[]
  },

  async saveIdea(input, id) {
    const sb = requireSupabase()
    const { data, error } = await (id
      ? sb.from('ideas').update(input).eq('id', id).select().single()
      : sb.from('ideas').insert(input).select().single())
    if (error) throw error
    return data as Idea
  },

  async deleteIdea(id) {
    const { error } = await requireSupabase().from('ideas').delete().eq('id', id)
    if (error) throw error
  },
}

export type { ResumeMeta }
