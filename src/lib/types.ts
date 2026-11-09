export type Gender = 'male' | 'female'

export const CANDIDATE_STATUSES = ['active', 'in_process', 'engaged', 'paused'] as const
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]

export interface EducationEntry {
  name: string
  type: string
  years: string
}

/** Editable candidate fields (everything the matchmaker types in). */
export interface CandidateInput {
  gender: Gender
  first_name: string
  last_name: string
  birth_date: string | null
  hebrew_birth_date: string | null
  city: string | null
  region: string | null
  country_of_origin: string | null
  community: string | null
  chassidut: string | null
  height_cm: number | null
  appearance: string | null
  institution: string | null
  institution_type: string | null
  education_history: EducationEntry[]
  occupation: string | null
  degree: string | null
  future_plans: string | null
  character_description: string | null
  desired_home_style: string | null
  special_requirements: string | null
  general_notes: string | null
  status: CandidateStatus
}

export interface FamilyDetailsInput {
  father_name: string | null
  father_occupation: string | null
  mother_name: string | null
  mother_occupation: string | null
  mother_maiden_name: string | null
  lineage: string | null
  siblings_count: number | null
  birth_order: number | null
}

export interface InLawInput {
  relation: string
  full_name: string
  details: string | null
}

export interface ResumeMeta {
  id: string
  candidate_id: string
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_at: string
}

/** A row in the list (candidates_view): candidate + computed age + resume summary. */
export interface CandidateRow extends CandidateInput {
  id: string
  owner_id: string
  age: number | null
  created_at: string
  updated_at: string
  resume: ResumeMeta | null
}

export interface InLaw extends InLawInput {
  id: string
}

export interface CandidateFull extends CandidateRow {
  family: FamilyDetailsInput | null
  in_laws: InLaw[]
}

export interface SaveCandidatePayload {
  id?: string
  candidate: CandidateInput
  family: FamilyDetailsInput
  in_laws: InLawInput[]
}
