import { HDate } from '@hebcal/core'
import { todayIso } from '@/lib/age'
import { EMPTY_FAMILY } from '@/lib/candidatePayload'
import type { EdaKey } from '@/lib/eda'
import { excelSerialToIso, type SheetCell } from '@/lib/files/readSheet'
import { gregorianToHebrew } from '@/lib/hebrewDate'
import type {
  CandidateInput,
  CandidateRow,
  CandidateStatus,
  FamilyDetailsInput,
  Gender,
  SaveCandidatePayload,
} from '@/lib/types'
import { fullName, normalizeSearch } from '@/lib/utils'

/** Where a spreadsheet column goes. */
export const TARGETS = {
  ignore: 'לא לייבא',
  notes_extra: 'להוסיף להערות',
  full_name: 'שם מלא',
  first_name: 'שם פרטי',
  last_name: 'שם משפחה',
  gender: 'בחור / בחורה',
  birth_date: 'תאריך לידה לועזי',
  hebrew_birth_date: 'תאריך לידה עברי',
  age: 'גיל',
  city: 'עיר מגורים',
  region: 'אזור',
  eda: 'עדה / חסידות',
  institution: 'ישיבה / סמינר',
  occupation: 'עיסוק',
  height: 'גובה',
  appearance: 'מראה',
  status: 'סטטוס',
  father_name: 'שם האב',
  father_occupation: 'עיסוק האב',
  mother_name: 'שם האם',
  mother_occupation: 'עיסוק האם',
  mother_maiden_name: 'משפחת האם (מבית)',
  siblings_count: 'מספר אחים',
  character: 'תיאור אופי',
  home_style: 'סגנון בית',
  requirements: 'דרישות מיוחדות',
  general_notes: 'הערות',
} as const
export type Target = keyof typeof TARGETS

/** Header words → target (first match wins; order matters: specific before generic). */
const SYNONYMS: [RegExp, Target][] = [
  [/^שם$|שם\s*מלא|^שם\s*(ה)?מועמד(\/ת)?$|^שם\s*ו?שם\s*משפחה|^full\s*name|^name$/i, 'full_name'],
  [/שם\s*פרטי|^first/i, 'first_name'],
  [/שם\s*משפחה|^last|surname|family\s*name/i, 'last_name'],
  [/מבית|נעורים|משפחת\s*(ה)?אם/, 'mother_maiden_name'],
  [/עיסוק\s*(ה)?אב|מקצוע\s*(ה)?אב/, 'father_occupation'],
  [/עיסוק\s*(ה)?אם|מקצוע\s*(ה)?אם/, 'mother_occupation'],
  [/^(שם\s*)?(ה)?אב$|שם\s*(ה)?אבא|^אבא$|father/i, 'father_name'],
  [/^(שם\s*)?(ה)?אם$|שם\s*(ה)?אמא|^אמא$|mother/i, 'mother_name'],
  [/^מין$|בחור\s*\/\s*בחורה|^סוג$|gender|^בן\s*\/\s*בת$/i, 'gender'],
  [/עברי/, 'hebrew_birth_date'],
  [/תאריך\s*לידה|לועזי|birth|^dob$/i, 'birth_date'],
  [/^גיל$|^age$/i, 'age'],
  [/אזור|region/i, 'region'],
  [/עיר|מגורים|^city$/i, 'city'],
  [/עדה|חסידות|מוצא|community/i, 'eda'],
  [/ישיבה|סמינר|מוסד|כולל|yeshiva|seminary/i, 'institution'],
  [/עיסוק|מקצוע|עבודה|occupation/i, 'occupation'],
  [/גובה|height/i, 'height'],
  [/מראה|appearance/i, 'appearance'],
  [/סטטוס|מצב|status/i, 'status'],
  [/אחים|siblings/i, 'siblings_count'],
  [/אופי|character/i, 'character'],
  [/סגנון\s*(ה)?בית|בית\s*מבוקש/, 'home_style'],
  [/דרישות|מחפש|requirements/i, 'requirements'],
  [/הערות|notes|הערה/i, 'general_notes'],
]

export function guessTarget(header: string): Target {
  const h = header.trim()
  if (!h) return 'ignore'
  for (const [re, t] of SYNONYMS) if (re.test(h)) return t
  return 'notes_extra'
}

/** Guesses for every column; a target is used at most once (later columns fall back to notes). */
export function guessMapping(headers: string[]): Target[] {
  const used = new Set<Target>()
  return headers.map((h) => {
    const t = guessTarget(h)
    if (t === 'ignore' || t === 'notes_extra' || t === 'general_notes') return t
    if (used.has(t)) return 'notes_extra'
    used.add(t)
    return t
  })
}

export type GenderMode = 'column' | Gender

export interface ImportOptions {
  headers: string[]
  mapping: Target[]
  genderMode: GenderMode
}

export interface ParsedRow {
  /** 1-based row number in the file (for messages) */
  line: number
  payload: SaveCandidatePayload | null
  name: string
  errors: string[]
  warnings: string[]
  /** existing candidate with the same identity, if any */
  duplicateOf: CandidateRow | null
  /** another row earlier in the same file */
  duplicateInFile: number | null
}

const str = (v: SheetCell): string => (v === null || v === undefined ? '' : String(v).trim())
const nul = (s: string) => (s ? s : null)

function parseGender(v: string): Gender | null {
  const s = v.trim().toLowerCase()
  if (!s) return null
  if (/בחורה|בת|נקבה|female|^f$|^נ$|^girl/.test(s)) return 'female'
  if (/בחור|בן|זכר|male|^m$|^ז$|^boy/.test(s)) return 'male'
  return null
}

/** dd/mm/yyyy, dd.mm.yy, yyyy-mm-dd, Excel serial → ISO. */
export function parseGregorian(v: SheetCell): string | null {
  if (v === null) return null
  if (typeof v === 'number') return excelSerialToIso(v)
  const s = v.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  let y: number, mo: number, d: number
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/))) {
    ;[d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (y < 100) y += y > 40 ? 1900 : 2000
  } else if (/^\d{5}$/.test(s)) return excelSerialToIso(Number(s))
  else return null
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  if (y < 1900 || date.getTime() > Date.now()) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseHebrew(s: string): string | null {
  try {
    const h = HDate.fromGematriyaString(s.replace(/\s+/g, ' ').trim())
    const g = h.greg()
    const iso = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`
    return g.getTime() > Date.now() || g.getFullYear() < 1900 ? null : iso
  } catch {
    return null
  }
}

function parseStatus(s: string): CandidateStatus {
  if (/בתהליך|בבירור|בהצעה|process/i.test(s)) return 'in_process'
  if (/מאורס|נשוי|נשואה|סגר|engaged/i.test(s)) return 'engaged'
  if (/מושה|הפסק|לא\s*פעיל|paused/i.test(s)) return 'paused'
  return 'active'
}

function parseEda(s: string): Pick<CandidateInput, 'eda' | 'community' | 'chassidut'> {
  if (!s) return { eda: null, community: null, chassidut: null }
  let eda: EdaKey = 'other'
  if (/חסיד|חב"ד|חב״ד|בעלז|גור|ויז|סאטמר|ברסלב|באבוב|צאנז|קרלין|סלונים/.test(s)) eda = 'chasidut'
  else if (/ליטא/.test(s)) eda = 'litai'
  else if (/ספרד|מזרח|תימנ|מרוק|עיראק|פרס|תוניס|לוב|כורד|בוכר|סורי|חלב|מצרי|גרוזי/.test(s))
    eda = 'mizrah'
  if (eda === 'chasidut') return { eda, community: null, chassidut: s }
  if (eda === 'litai') return { eda, community: 'ליטאי', chassidut: null }
  return { eda, community: s, chassidut: null }
}

const identity = (name: string, birth: string | null) => ({ n: normalizeSearch(name), birth })

/** Same person: same normalized full name, and birth dates equal when both are known. */
const samePerson = (
  a: { n: string; birth: string | null },
  b: { n: string; birth: string | null },
) => !!a.n && a.n === b.n && (!a.birth || !b.birth || a.birth === b.birth)

export function parseRows(
  dataRows: SheetCell[][],
  firstLine: number,
  opts: ImportOptions,
  existing: CandidateRow[],
): ParsedRow[] {
  const existingIds = existing.map((r) => ({ row: r, id: identity(fullName(r), r.birth_date) }))
  const seen: { line: number; id: { n: string; birth: string | null } }[] = []
  const out: ParsedRow[] = []

  dataRows.forEach((cells, i) => {
    const line = firstLine + i
    if (cells.every((c) => str(c) === '')) return
    const val: Partial<Record<Target, SheetCell>> = {}
    const extras: string[] = []
    const notes: string[] = []
    opts.mapping.forEach((t, ci) => {
      const v = cells[ci] ?? null
      if (t === 'ignore' || str(v) === '') return
      if (t === 'notes_extra') extras.push(`${opts.headers[ci] || `עמודה ${ci + 1}`}: ${str(v)}`)
      else if (t === 'general_notes') notes.push(str(v))
      else val[t] = v
    })

    const errors: string[] = []
    const warnings: string[] = []
    // name
    let first = str(val.first_name ?? null)
    let last = str(val.last_name ?? null)
    if (val.full_name !== undefined) {
      const parts = str(val.full_name).split(/\s+/).filter(Boolean)
      if (!first) first = parts[0] ?? ''
      if (!last) last = parts.slice(1).join(' ')
    }
    const name = `${first} ${last}`.trim()
    if (!first) errors.push('חסר שם')
    else if (!last) warnings.push('חסר שם משפחה')

    // gender
    let gender: Gender | null = opts.genderMode === 'column' ? null : opts.genderMode
    if (opts.genderMode === 'column') {
      gender = parseGender(str(val.gender ?? null))
      if (!gender)
        errors.push(
          val.gender === undefined
            ? 'לא צוין בחור / בחורה'
            : `לא זוהה מין: "${str(val.gender ?? null)}"`,
        )
    }

    // dates
    let birth: string | null = null
    let hebrewText: string | null = null
    if (val.birth_date !== undefined) {
      birth = parseGregorian(val.birth_date)
      if (!birth) warnings.push(`תאריך לידה לא זוהה: "${str(val.birth_date)}"`)
    }
    if (val.hebrew_birth_date !== undefined) {
      const h = str(val.hebrew_birth_date)
      const g = parseHebrew(h)
      if (!birth && g) birth = g
      if (!g) {
        hebrewText = h
        if (!birth) warnings.push(`תאריך עברי לא זוהה — נשמר כטקסט: "${h}"`)
      }
    }
    // No birth date: a plain age is kept as the candidate's age (it grows with time).
    let ageYears: number | null = null
    if (!birth && val.age !== undefined) {
      const a = Number(String(val.age).replace(/[^\d.]/g, ''))
      if (Number.isInteger(a) && a >= 16 && a <= 70) ageYears = a
      else warnings.push(`גיל לא תקין: "${str(val.age)}"`)
    }

    // height
    let height: number | null = null
    if (val.height !== undefined) {
      let h = Number(String(val.height).replace(/[^\d.]/g, ''))
      if (h > 0 && h < 3) h = Math.round(h * 100)
      if (h >= 120 && h <= 230) height = Math.round(h)
      else warnings.push(`גובה לא תקין: "${str(val.height)}"`)
    }
    let siblings: number | null = null
    if (val.siblings_count !== undefined) {
      const n = Number(String(val.siblings_count).replace(/[^\d]/g, ''))
      siblings = Number.isFinite(n) && n >= 0 && n < 40 ? n : null
    }

    const generalNotes = [...notes, ...extras].join('\n').slice(0, 4000)
    const candidate: CandidateInput = {
      gender: gender ?? 'male',
      first_name: first,
      last_name: last,
      birth_date: birth,
      hebrew_birth_date: birth ? gregorianToHebrew(birth) : hebrewText,
      age_years: ageYears,
      age_recorded_on: ageYears === null ? null : todayIso(),
      city: nul(str(val.city ?? null)),
      region: nul(str(val.region ?? null)),
      country_of_origin: null,
      ...parseEda(str(val.eda ?? null)),
      height_cm: height,
      appearance: nul(str(val.appearance ?? null)),
      institution: nul(str(val.institution ?? null)),
      institution_type: null,
      education_history: [],
      occupation: nul(str(val.occupation ?? null)),
      degree: null,
      future_plans: null,
      character_description: nul(str(val.character ?? null)),
      desired_home_style: nul(str(val.home_style ?? null)),
      special_requirements: nul(str(val.requirements ?? null)),
      general_notes: nul(generalNotes),
      status: parseStatus(str(val.status ?? null)),
    }
    const family: FamilyDetailsInput = {
      ...EMPTY_FAMILY,
      father_name: nul(str(val.father_name ?? null)),
      father_occupation: nul(str(val.father_occupation ?? null)),
      mother_name: nul(str(val.mother_name ?? null)),
      mother_occupation: nul(str(val.mother_occupation ?? null)),
      mother_maiden_name: nul(str(val.mother_maiden_name ?? null)),
      siblings_count: siblings,
    }

    const id = identity(name, birth)
    const dupExisting = errors.length
      ? null
      : (existingIds.find((e) => samePerson(e.id, id))?.row ?? null)
    const dupFile = errors.length ? null : (seen.find((s) => samePerson(s.id, id))?.line ?? null)
    if (!errors.length) seen.push({ line, id })

    out.push({
      line,
      name,
      errors,
      warnings,
      duplicateOf: dupExisting,
      duplicateInFile: dupFile,
      payload: errors.length ? null : { candidate, family, in_laws: [] },
    })
  })
  return out
}

/** Fills the existing card with the file's values (only fields the file has). */
export function mergeIntoExisting(
  existing: SaveCandidatePayload,
  incoming: SaveCandidatePayload,
): SaveCandidatePayload {
  const c = { ...existing.candidate }
  for (const [k, v] of Object.entries(incoming.candidate)) {
    if (k === 'gender' || k === 'status' || k === 'education_history') continue
    if (v !== null && v !== '') (c as Record<string, unknown>)[k] = v
  }
  // A birth date always wins over a typed age (age is then computed from it).
  if (c.birth_date) {
    c.age_years = null
    c.age_recorded_on = null
  }
  if (incoming.candidate.general_notes && existing.candidate.general_notes) {
    c.general_notes = existing.candidate.general_notes.includes(incoming.candidate.general_notes)
      ? existing.candidate.general_notes
      : `${existing.candidate.general_notes}\n${incoming.candidate.general_notes}`.slice(0, 4000)
  }
  const f = { ...existing.family }
  for (const [k, v] of Object.entries(incoming.family))
    if (v !== null && v !== '') (f as Record<string, unknown>)[k] = v
  return { ...existing, candidate: c, family: f }
}

/** Header row of the downloadable template. */
export const TEMPLATE_HEADERS = [
  'שם מלא',
  'בחור / בחורה',
  'תאריך לידה',
  'תאריך לידה עברי',
  'גיל',
  'עיר',
  'אזור',
  'עדה / חסידות',
  'ישיבה / סמינר',
  'עיסוק',
  'גובה',
  'שם האב',
  'שם האם',
  'משפחת האם (מבית)',
  'מספר אחים',
  'סטטוס',
  'הערות',
]
