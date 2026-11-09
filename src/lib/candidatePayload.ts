import type {
  CandidateFull,
  CandidateInput,
  FamilyDetailsInput,
  SaveCandidatePayload,
} from './types'

export const EMPTY_FAMILY: FamilyDetailsInput = {
  father_name: null,
  father_occupation: null,
  mother_name: null,
  mother_occupation: null,
  mother_maiden_name: null,
  lineage: null,
  siblings_count: null,
  birth_order: null,
}

const INPUT_KEYS: (keyof CandidateInput)[] = [
  'gender',
  'first_name',
  'last_name',
  'birth_date',
  'hebrew_birth_date',
  'city',
  'region',
  'country_of_origin',
  'eda',
  'community',
  'chassidut',
  'height_cm',
  'appearance',
  'institution',
  'institution_type',
  'education_history',
  'occupation',
  'degree',
  'future_plans',
  'character_description',
  'desired_home_style',
  'special_requirements',
  'general_notes',
  'status',
]

/** The editable part of a stored candidate (drops id/owner/age/resume…). */
export function candidateInputOf(c: CandidateFull | CandidateInput): CandidateInput {
  const out = {} as Record<string, unknown>
  for (const k of INPUT_KEYS) out[k] = (c as unknown as Record<string, unknown>)[k] ?? null
  out.education_history = (c.education_history ?? []).map((e) => ({ ...e }))
  return out as unknown as CandidateInput
}

/** Full save payload that recreates a stored candidate exactly (used by update/restore). */
export function payloadOf(c: CandidateFull, id?: string): SaveCandidatePayload {
  return {
    id,
    candidate: candidateInputOf(c),
    family: { ...EMPTY_FAMILY, ...(c.family ?? {}) },
    in_laws: c.in_laws.map(({ relation, full_name, details }) => ({
      relation,
      full_name,
      details,
    })),
  }
}
