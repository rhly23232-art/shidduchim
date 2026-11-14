import { describe, expect, it } from 'vitest'
import {
  guessMapping,
  mergeIntoExisting,
  parseGregorian,
  parseRows,
} from '@/features/import/mapping'
import type { CandidateRow } from '@/lib/types'

const headers = ['שם', 'מין', 'תאריך לידה', 'תאריך עברי', 'גובה', 'עדה', 'טלפון', 'גיל', 'שם האב']
const opts = { headers, mapping: guessMapping(headers), genderMode: 'column' as const }

describe('guessMapping', () => {
  it('maps Hebrew headers', () => {
    expect(opts.mapping).toEqual([
      'full_name',
      'gender',
      'birth_date',
      'hebrew_birth_date',
      'height',
      'eda',
      'notes_extra',
      'age',
      'father_name',
    ])
  })
  it('never maps two columns to the same field', () => {
    expect(guessMapping(['שם מלא', 'שם'])).toEqual(['full_name', 'notes_extra'])
  })
})

describe('parseGregorian', () => {
  it.each([
    ['14/02/2003', '2003-02-14'],
    ['14.2.03', '2003-02-14'],
    ['2003-02-14', '2003-02-14'],
    [37666, '2003-02-14'],
    ['31/02/2003', null],
    ['01/01/2999', null],
    ['שלום', null],
  ])('%j → %j', (input, out) => expect(parseGregorian(input)).toBe(out))
})

describe('parseRows', () => {
  const existing = [
    { id: 'e1', first_name: 'יוסף', last_name: 'כהן', birth_date: '2003-02-14' } as CandidateRow,
  ]
  const rows = parseRows(
    [
      ['אהרן ברגר', 'בחור', '03/05/2001', null, 1.8, 'חסידות בעלזא', '050-1', null, 'ר׳ משה'],
      ['רבקה וולף', 'בחורה', null, 'ט״ו באב תשס״ב', '165', 'ליטאי', null, null, null],
      ['יוסף כהן', 'בחור', '14/02/2003', null, null, null, null, null, null],
      ['אהרן ברגר', 'בחור', '03/05/2001', null, null, null, null, null, null],
      ['ללא מין', null, null, null, null, null, null, null, null],
      ['מנחם', 'ז', null, null, '400', 'מרוקאי', null, '24', null],
      [null, null, null, null, null, null, null, null, null],
    ],
    2,
    opts,
    existing,
  )
  it('skips empty rows and keeps file line numbers', () => {
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5, 6, 7])
  })
  it('converts height in meters, chassidut and extra columns', () => {
    const c = rows[0]!.payload!
    expect(c.candidate.height_cm).toBe(180)
    expect(c.candidate.eda).toBe('chasidut')
    expect(c.candidate.chassidut).toBe('חסידות בעלזא')
    expect(c.candidate.general_notes).toContain('טלפון: 050-1')
    expect(c.family.father_name).toBe('ר׳ משה')
    expect(c.candidate.hebrew_birth_date).toBe('י׳ באייר תשס״א')
  })
  it('converts a Hebrew birth date to Gregorian', () => {
    expect(rows[1]!.payload!.candidate.birth_date).toBe('2002-07-24')
    expect(rows[1]!.payload!.candidate.gender).toBe('female')
    expect(rows[1]!.payload!.candidate.eda).toBe('litai')
  })
  it('detects duplicates against the account and inside the file', () => {
    expect(rows[2]!.duplicateOf?.id).toBe('e1')
    expect(rows[3]!.duplicateInFile).toBe(2)
  })
  it('reports rows it cannot import', () => {
    expect(rows[4]!.payload).toBeNull()
    expect(rows[4]!.errors[0]).toMatch(/לא צוין/)
  })
  it('keeps an age as age (no invented birth date); flags invalid height', () => {
    const r = rows[5]!
    expect(r.payload!.candidate.birth_date).toBeNull()
    expect(r.payload!.candidate.age_years).toBe(24)
    expect(r.payload!.candidate.age_recorded_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(r.payload!.candidate.height_cm).toBeNull()
    expect(r.warnings.join()).toMatch(/גובה/)
    expect(r.warnings.join()).toMatch(/חסר שם משפחה/)
    expect(r.payload!.candidate.eda).toBe('mizrah')
  })
})

describe('mergeIntoExisting', () => {
  it('fills from the file without erasing existing values', () => {
    const existing = {
      id: 'e1',
      candidate: {
        first_name: 'יוסף',
        last_name: 'כהן',
        city: 'ירושלים',
        institution: 'מיר',
        general_notes: 'ישן',
      },
      family: { father_name: 'ר׳ דוד', mother_name: null },
      in_laws: [],
    }
    const incoming = {
      candidate: {
        first_name: 'יוסף',
        last_name: 'כהן',
        city: 'צפת',
        institution: null,
        general_notes: 'חדש',
      },
      family: { father_name: null, mother_name: 'רחל' },
      in_laws: [],
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = mergeIntoExisting(existing as any, incoming as any)
    expect(m.id).toBe('e1')
    expect(m.candidate.city).toBe('צפת')
    expect(m.candidate.institution).toBe('מיר')
    expect(m.candidate.general_notes).toBe('ישן\nחדש')
    expect(m.family.father_name).toBe('ר׳ דוד')
    expect(m.family.mother_name).toBe('רחל')
  })
})
