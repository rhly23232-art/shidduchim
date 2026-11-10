import { describe, expect, it } from 'vitest'
import { ageFromBirthDate } from '@/lib/age'
import { diffPayloads } from '@/lib/api/journaled'
import { edaOf } from '@/lib/eda'
import { gregorianToHebrew } from '@/lib/hebrewDate'
import {
  candidateFormSchema,
  emailFormSchema,
  emptyFormValues,
  splitFullName,
} from '@/lib/validators'
import type { SaveCandidatePayload } from '@/lib/types'

describe('validation (zod 4)', () => {
  const valid = { ...emptyFormValues('male'), full_name: 'יוסף כהן' }
  it('accepts a minimal card', () => {
    expect(candidateFormSchema.safeParse(valid).success).toBe(true)
  })
  it('requires first and last name', () => {
    const r = candidateFormSchema.safeParse({ ...valid, full_name: 'יוסף' })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0]!.message).toMatch(/שם פרטי ושם משפחה/)
  })
  it('rejects an impossible height', () => {
    expect(candidateFormSchema.safeParse({ ...valid, height_cm: '400' }).success).toBe(false)
  })
  it('validates email form fields with Hebrew messages', () => {
    const r = emailFormSchema.safeParse({ to: 'not-email', subject: '', body: 'x' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.map((i) => i.path[0])).toEqual(['to', 'subject'])
  })
  it('splits a full name: first word is the first name', () => {
    expect(splitFullName('  חיים  בן  דוד ')).toEqual({ first_name: 'חיים', last_name: 'בן דוד' })
  })
})

describe('dates and ages', () => {
  it('converts Gregorian to Hebrew', () => {
    expect(gregorianToHebrew('2003-02-14')).toBe('י״ב באדר א׳ תשס״ג')
    expect(gregorianToHebrew('2003-02-30')).toBeNull()
    expect(gregorianToHebrew(null)).toBeNull()
  })
  it('computes age by birthday, not by year', () => {
    const today = new Date()
    const y = today.getFullYear()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const tomorrow = new Date(Date.UTC(y - 20, today.getMonth(), today.getDate() + 1))
    expect(ageFromBirthDate(iso(tomorrow))).toBe(19)
    expect(ageFromBirthDate(null)).toBeNull()
  })
})

describe('community (עדה) detection', () => {
  it.each([
    [{ community: 'ליטאי', chassidut: null }, 'litai'],
    [{ community: null, chassidut: 'חסידות בעלזא' }, 'chasidut'],
    [{ community: 'מרוקאי', chassidut: null }, 'mizrah'],
    [{ community: 'אשכנזי', chassidut: null }, 'other'],
    [{ community: 'מרוקאי', chassidut: null, eda: 'other' as const }, 'other'],
  ])('%j → %s', (row, key) => expect(edaOf(row)).toBe(key))
})

describe('change history diff', () => {
  const base = {
    candidate: {
      first_name: 'א',
      last_name: 'ב',
      city: 'ירושלים',
      height_cm: 170,
      education_history: [],
    },
    family: { father_name: null },
    in_laws: [],
  } as unknown as SaveCandidatePayload
  it('lists only fields that changed, with readable values', () => {
    const next = {
      ...base,
      candidate: { ...base.candidate, city: 'צפת', height_cm: 171 },
      family: { father_name: 'ר׳ משה' },
      in_laws: [{ relation: 'גיס', full_name: 'משה', details: null }],
    } as unknown as SaveCandidatePayload
    expect(diffPayloads(base, next)).toEqual([
      { field: 'city', before: 'ירושלים', after: 'צפת' },
      { field: 'height_cm', before: '170', after: '171' },
      { field: 'family.father_name', before: null, after: 'ר׳ משה' },
      { field: 'in_laws', before: null, after: 'גיס · משה' },
    ])
  })
  it('treats empty string and null as the same', () => {
    const next = {
      ...base,
      candidate: { ...base.candidate, city: 'ירושלים', appearance: '' },
    } as unknown as SaveCandidatePayload
    expect(diffPayloads(base, next)).toEqual([])
  })
})
