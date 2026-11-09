import { z } from 'zod'
import { ageFromBirthDate } from './age'
import { edaDetail, edaOf, hasEda, type EdaKey } from './eda'
import { gregorianToHebrew } from './hebrewDate'
import { he } from './strings.he'
import {
  CANDIDATE_STATUSES,
  type CandidateFull,
  type Gender,
  type SaveCandidatePayload,
} from './types'
import { emptyToNull } from './utils'

const v = he.validation

// ---------- primitives ----------------------------------------------------------
const requiredText = (max: number) => z.string().trim().min(1, v.required).max(max, v.tooLong(max))
const optionalText = (max: number) => z.string().trim().max(max, v.tooLong(max))

const intString = (min: number, max: number, rangeMsg: string) =>
  z
    .string()
    .trim()
    .refine((s) => s === '' || /^\d+$/.test(s), v.integer)
    .refine((s) => s === '' || (Number(s) >= min && Number(s) <= max), rangeMsg)

const birthDate = z
  .string()
  .trim()
  .refine(
    (s) => s === '' || (/^\d{4}-\d{2}-\d{2}$/.test(s) && gregorianToHebrew(s) !== null),
    v.invalidDate,
  )
  .refine((s) => s === '' || new Date(s) <= new Date(), v.futureDate)
  .refine((s) => {
    if (s === '') return true
    const age = ageFromBirthDate(s)
    return age !== null && age >= 16 && age <= 70
  }, v.ageRange)

// ---------- auth ----------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().trim().min(1, v.required).email(v.email),
  password: z.string().min(1, v.required),
})
export type LoginValues = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  fullName: requiredText(60),
  email: z.string().trim().min(1, v.required).email(v.email),
  password: z.string().min(8, v.passwordMin),
})
export type SignupValues = z.infer<typeof signupSchema>

// ---------- candidate form ------------------------------------------------------
export const educationEntrySchema = z.object({
  name: requiredText(100),
  type: optionalText(60),
  years: optionalText(40),
})

export const inLawSchema = z.object({
  relation: requiredText(30),
  full_name: requiredText(100),
  details: optionalText(300),
})

export const candidateFormSchema = z
  .object({
    gender: z.enum(['male', 'female']),
    full_name: requiredText(120).refine(
      (v) => v.trim().split(/\s+/).length >= 2,
      v.fullNameTwoWords,
    ),
    birth_date: birthDate,
    city: optionalText(60),
    region: optionalText(60),
    country_of_origin: optionalText(60),
    eda: z.enum(['', 'litai', 'mizrah', 'chasidut', 'other']),
    eda_detail: optionalText(60),
    height_cm: intString(120, 230, v.heightRange),
    appearance: optionalText(200),
    status: z.enum(CANDIDATE_STATUSES),
    institution: optionalText(100),
    institution_type: optionalText(60),
    education_history: z.array(educationEntrySchema).max(15),
    occupation: optionalText(150),
    degree: optionalText(150),
    future_plans: optionalText(1000),
    family: z.object({
      father_name: optionalText(80),
      father_occupation: optionalText(120),
      mother_name: optionalText(80),
      mother_occupation: optionalText(120),
      mother_maiden_name: optionalText(60),
      lineage: optionalText(500),
      siblings_count: intString(0, 30, v.siblingsRange),
      birth_order: intString(1, 31, v.birthOrderRange),
    }),
    in_laws: z.array(inLawSchema).max(30),
    character_description: optionalText(2000),
    desired_home_style: optionalText(1000),
    special_requirements: optionalText(1000),
    general_notes: optionalText(2000),
  })
  .superRefine((val, ctx) => {
    const s = val.family.siblings_count
    const o = val.family.birth_order
    if (s !== '' && o !== '' && Number(o) > Number(s) + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: v.birthOrderVsSiblings,
        path: ['family', 'birth_order'],
      })
    }
  })

export type CandidateFormValues = z.infer<typeof candidateFormSchema>

export function emptyFormValues(gender: Gender): CandidateFormValues {
  return {
    gender,
    full_name: '',
    birth_date: '',
    city: '',
    region: '',
    country_of_origin: '',
    eda: '',
    eda_detail: '',
    height_cm: '',
    appearance: '',
    status: 'active',
    institution: '',
    institution_type: '',
    education_history: [],
    occupation: '',
    degree: '',
    future_plans: '',
    family: {
      father_name: '',
      father_occupation: '',
      mother_name: '',
      mother_occupation: '',
      mother_maiden_name: '',
      lineage: '',
      siblings_count: '',
      birth_order: '',
    },
    in_laws: [],
    character_description: '',
    desired_home_style: '',
    special_requirements: '',
    general_notes: '',
  }
}

const s = (x: string | null | undefined) => x ?? ''
const n = (x: number | null | undefined) => (x === null || x === undefined ? '' : String(x))

export function candidateToFormValues(c: CandidateFull): CandidateFormValues {
  return {
    gender: c.gender,
    full_name: `${c.first_name} ${c.last_name}`.trim(),
    birth_date: s(c.birth_date),
    city: s(c.city),
    region: s(c.region),
    country_of_origin: s(c.country_of_origin),
    eda: hasEda(c) ? edaOf(c) : '',
    eda_detail: hasEda(c) ? edaDetail(c) : '',
    height_cm: n(c.height_cm),
    appearance: s(c.appearance),
    status: c.status,
    institution: s(c.institution),
    institution_type: s(c.institution_type),
    education_history: c.education_history.map((e) => ({
      name: s(e.name),
      type: s(e.type),
      years: s(e.years),
    })),
    occupation: s(c.occupation),
    degree: s(c.degree),
    future_plans: s(c.future_plans),
    family: {
      father_name: s(c.family?.father_name),
      father_occupation: s(c.family?.father_occupation),
      mother_name: s(c.family?.mother_name),
      mother_occupation: s(c.family?.mother_occupation),
      mother_maiden_name: s(c.family?.mother_maiden_name),
      lineage: s(c.family?.lineage),
      siblings_count: n(c.family?.siblings_count),
      birth_order: n(c.family?.birth_order),
    },
    in_laws: c.in_laws.map((l) => ({
      relation: l.relation,
      full_name: l.full_name,
      details: s(l.details),
    })),
    character_description: s(c.character_description),
    desired_home_style: s(c.desired_home_style),
    special_requirements: s(c.special_requirements),
    general_notes: s(c.general_notes),
  }
}

/** Stores the chosen עדה group with its typed detail in the matching column. */
export function edaToFields(
  eda: CandidateFormValues['eda'],
  detail: string,
): { eda: EdaKey | null; community: string | null; chassidut: string | null } {
  const d = emptyToNull(detail)
  switch (eda) {
    case 'litai':
      return { eda, community: 'ליטאי', chassidut: null }
    case 'chasidut':
      return { eda, community: null, chassidut: d }
    case 'mizrah':
    case 'other':
      return { eda, community: d, chassidut: null }
    default:
      return { eda: null, community: null, chassidut: null }
  }
}

/** "שם פרטי שם משפחה": the first word is the first name, the rest is the family name. */
export function splitFullName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/)
  return { first_name: parts[0] ?? '', last_name: parts.slice(1).join(' ') }
}

const num = (x: string) => (x.trim() === '' ? null : Number(x))

export function formValuesToPayload(
  values: CandidateFormValues,
  id?: string,
): SaveCandidatePayload {
  const birth = emptyToNull(values.birth_date)
  return {
    id,
    candidate: {
      gender: values.gender,
      ...splitFullName(values.full_name),
      birth_date: birth,
      hebrew_birth_date: gregorianToHebrew(birth),
      city: emptyToNull(values.city),
      region: emptyToNull(values.region),
      country_of_origin: emptyToNull(values.country_of_origin),
      ...edaToFields(values.eda, values.eda_detail),
      height_cm: num(values.height_cm),
      appearance: emptyToNull(values.appearance),
      institution: emptyToNull(values.institution),
      institution_type: emptyToNull(values.institution_type),
      education_history: values.education_history.map((e) => ({
        name: e.name.trim(),
        type: e.type.trim(),
        years: e.years.trim(),
      })),
      occupation: emptyToNull(values.occupation),
      degree: emptyToNull(values.degree),
      future_plans: emptyToNull(values.future_plans),
      character_description: emptyToNull(values.character_description),
      desired_home_style: emptyToNull(values.desired_home_style),
      special_requirements: emptyToNull(values.special_requirements),
      general_notes: emptyToNull(values.general_notes),
      status: values.status,
    },
    family: {
      father_name: emptyToNull(values.family.father_name),
      father_occupation: emptyToNull(values.family.father_occupation),
      mother_name: emptyToNull(values.family.mother_name),
      mother_occupation: emptyToNull(values.family.mother_occupation),
      mother_maiden_name: emptyToNull(values.family.mother_maiden_name),
      lineage: emptyToNull(values.family.lineage),
      siblings_count: num(values.family.siblings_count),
      birth_order: num(values.family.birth_order),
    },
    in_laws: values.in_laws.map((l) => ({
      relation: l.relation.trim(),
      full_name: l.full_name.trim(),
      details: emptyToNull(l.details),
    })),
  }
}

// ---------- email ---------------------------------------------------------------
export const emailFormSchema = z.object({
  to: z.string().trim().min(1, v.required).email(v.email),
  subject: z.string().trim().min(1, v.subjectRequired).max(200, v.tooLong(200)),
  body: z.string().trim().min(1, v.required).max(5000, v.tooLong(5000)),
})
export type EmailFormValues = z.infer<typeof emailFormSchema>

// ---------- resume files --------------------------------------------------------
export const RESUME_MAX_BYTES = 10 * 1024 * 1024
export const RESUME_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}
export const RESUME_ACCEPT =
  '.pdf,.docx,.png,.jpg,.jpeg,' + [...new Set(Object.values(RESUME_MIME_BY_EXT))].join(',')

export type FileCheck = { ok: true; mime: string } | { ok: false; error: string }

/**
 * Client-side resume validation: by extension AND by declared MIME (when present),
 * plus a magic-bytes sniff so a renamed file cannot slip through.
 */
export async function validateResumeFile(file: File): Promise<FileCheck> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = RESUME_MIME_BY_EXT[ext]
  if (!mime) return { ok: false, error: he.resume.invalidType }
  if (file.type && file.type !== mime && !(mime === 'image/jpeg' && file.type === 'image/jpg')) {
    return { ok: false, error: he.resume.invalidType }
  }
  if (file.size === 0) return { ok: false, error: he.resume.emptyFile }
  if (file.size > RESUME_MAX_BYTES) return { ok: false, error: he.resume.tooLarge }
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b)
  const magicOk =
    (mime === 'application/pdf' && starts(0x25, 0x50, 0x44, 0x46)) || // %PDF
    (mime === 'image/png' && starts(0x89, 0x50, 0x4e, 0x47)) ||
    (mime === 'image/jpeg' && starts(0xff, 0xd8, 0xff)) ||
    (mime.includes('wordprocessingml') && starts(0x50, 0x4b, 0x03, 0x04)) // zip container
  if (!magicOk) return { ok: false, error: he.resume.invalidType }
  return { ok: true, mime }
}
