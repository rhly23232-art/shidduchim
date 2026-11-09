import type { EdaKey } from '../eda'
import type {
  Idea,
  IdeaInput,
  CandidateFull,
  CandidateRow,
  Gender,
  ResumeMeta,
  SaveCandidatePayload,
} from '../types'

export interface AppUser {
  id: string
  email: string
  fullName: string | null
}

export interface SignUpResult {
  /** false when the backend requires email confirmation before login. */
  signedIn: boolean
}

export interface AuthApi {
  getUser(): Promise<AppUser | null>
  onAuthChange(cb: (user: AppUser | null) => void): () => void
  signIn(email: string, password: string): Promise<AppUser>
  signUp(email: string, password: string, fullName: string): Promise<SignUpResult>
  signOut(): Promise<void>
  /** Database mode: whether any matchmaker account exists yet (first visit → sign-up). */
  hasAccounts?(): Promise<boolean>
}

export interface CandidateCounts {
  male: number
  female: number
}

export type SortKey = 'name' | 'age' | 'city' | 'institution' | 'occupation' | 'updated'
export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

export interface CandidateFilters {
  q: string
  ageMin: number
  ageMax: number
  cities: string[]
  regions: string[]
  institutions: string[]
  /** עדה group filter + optional typed detail (מוצא / חסידות / חופשי). */
  eda: EdaKey | null
  edaText: string
}

/** Minimal columns used to build filter options. */
export interface FacetRow {
  city: string | null
  region: string | null
  institution: string | null
  community: string | null
}

export interface ServerQueryResult {
  rows: CandidateRow[]
  total: number
}

export interface SendEmailInput {
  candidateId: string
  to: string
  subject: string
  body: string
}

export interface UploadTarget {
  id: string
  owner_id: string
  resume: ResumeMeta | null
}

export interface DataApi {
  readonly supportsServerEmail: boolean
  readonly supportsShareLinks: boolean
  countCandidates(): Promise<CandidateCounts>
  /**
   * Loads every candidate when the account holds at most `maxRows`; otherwise returns
   * `overLimit: true` (and no rows) so the UI switches to server-side filtering.
   */
  listCandidates(maxRows: number): Promise<{ rows: CandidateRow[]; overLimit: boolean }>
  queryCandidates(
    gender: Gender,
    filters: CandidateFilters,
    sort: SortState,
    limit: number,
  ): Promise<ServerQueryResult>
  listFacets(gender: Gender): Promise<FacetRow[]>
  getCandidate(id: string): Promise<CandidateFull | null>
  saveCandidate(payload: SaveCandidatePayload): Promise<string>
  deleteCandidate(id: string): Promise<void>
  uploadResume(
    target: UploadTarget,
    file: File,
    mime: string,
    onProgress: (pct: number) => void,
  ): Promise<ResumeMeta>
  deleteResume(resume: ResumeMeta): Promise<void>
  getResumeUrl(resume: ResumeMeta, opts: { download: boolean; expiresIn: number }): Promise<string>
  /** Long-lived (7 days) signed link for mailto fallback; null when unsupported. */
  createShareLink(resume: ResumeMeta): Promise<string | null>
  sendResumeEmail(input: SendEmailInput): Promise<void>
  /** Reads the stored resume bytes (in-app viewer, Gmail attachment, downloads). */
  getResumeBlob(resume: ResumeMeta): Promise<Blob>
  /** Adds the 20 sample candidates (+ ideas, sample resumes). Resolves how many were added. */
  loadSampleData?(): Promise<number>
  /** Removes every sample candidate. Resolves how many were removed. */
  clearSampleData?(): Promise<number>

  // ---- ideas ----
  listIdeas(): Promise<Idea[]>
  saveIdea(input: IdeaInput, id?: string): Promise<Idea>
  deleteIdea(id: string): Promise<void>
}
