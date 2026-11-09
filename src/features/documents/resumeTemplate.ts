import { buildDocx, type DocBlock } from '@/lib/files/docx'
import { edaDetail, edaOf, hasEda } from '@/lib/eda'
import { formatGregorian } from '@/lib/hebrewDate'
import { he } from '@/lib/strings.he'
import type { CandidateFull } from '@/lib/types'
import { fullName } from '@/lib/utils'
import { edaLabel } from '@/features/candidates/EdaFilter'

/** One field of the resume form. `area` = free multi-line text. */
export interface ResumeField {
  id: string
  label: string
  area?: boolean
  /** writing lines in the printed blank form */
  lines?: number
  placeholder?: string
  ltr?: boolean
}
export interface ResumeSection {
  id: string
  title: string
  fields: ResumeField[]
}

/**
 * The blank resume — one definition for the in-app form, the Word file and the blank template.
 * Gender-neutral so it fits בחורים and בחורות alike.
 */
export const RESUME_SECTIONS: ResumeSection[] = [
  {
    id: 'personal',
    title: 'פרטים אישיים',
    fields: [
      { id: 'name', label: 'שם מלא' },
      { id: 'hebrewDate', label: 'תאריך לידה עברי' },
      { id: 'gregDate', label: 'תאריך לידה לועזי' },
      { id: 'city', label: 'עיר מגורים' },
      { id: 'address', label: 'כתובת' },
      { id: 'eda', label: 'עדה / חסידות' },
      { id: 'height', label: 'גובה' },
      { id: 'appearance', label: 'מראה וסגנון לבוש' },
    ],
  },
  {
    id: 'education',
    title: 'לימודים ועיסוק',
    fields: [
      {
        id: 'institutions',
        label: 'מוסדות לימוד',
        area: true,
        lines: 3,
        placeholder: 'תלמוד תורה / בית ספר, ישיבה קטנה / סמינר, ישיבה גדולה…',
      },
      { id: 'current', label: 'מקום לימודים / עבודה נוכחי' },
      { id: 'occupation', label: 'עיסוק / מקצוע' },
    ],
  },
  {
    id: 'family',
    title: 'משפחה',
    fields: [
      { id: 'father', label: 'שם האב ועיסוקו' },
      { id: 'mother', label: 'שם האם ועיסוקה' },
      { id: 'motherMaiden', label: 'משפחת האם (מבית)' },
      { id: 'siblings', label: 'מספר אחים ואחיות / מקום במשפחה' },
      {
        id: 'married',
        label: 'אחים נשואים ומחותנים',
        area: true,
        lines: 4,
        placeholder: 'שם, עיר, משפחת המחותנים…',
      },
    ],
  },
  {
    id: 'traits',
    title: 'מאפיינים ושאיפות',
    fields: [
      { id: 'character', label: 'תיאור אופי', area: true, lines: 3 },
      { id: 'home', label: 'סגנון הבית המבוקש', area: true, lines: 3 },
      { id: 'looking', label: 'מה מחפשים', area: true, lines: 3 },
    ],
  },
  {
    id: 'contact',
    title: 'ממליצים ויצירת קשר',
    fields: [
      { id: 'references', label: 'ממליצים (שם וטלפון)', area: true, lines: 3 },
      { id: 'phone', label: 'טלפון ליצירת קשר', ltr: true },
      { id: 'notes', label: 'הערות נוספות', area: true, lines: 3 },
    ],
  },
]

export type ResumeValues = Record<string, string>

export const hasAnyValue = (v: ResumeValues) => Object.values(v).some((x) => x.trim())

/** Word document of the resume. With no values it is the blank form to fill by hand. */
export function buildResumeDocx(values: ResumeValues = {}): Blob {
  const blank = !hasAnyValue(values)
  const name = values.name?.trim()
  const blocks: DocBlock[] = [
    {
      kind: 'title',
      text:
        blank || !name ? he.documents.resume.docTitle : `${he.documents.resume.docTitle} – ${name}`,
    },
    { kind: 'subtitle', text: blank ? he.documents.resume.docSubtitleBlank : he.app.name },
  ]
  for (const s of RESUME_SECTIONS) {
    const fields = blank ? s.fields : s.fields.filter((f) => values[f.id]?.trim())
    if (!fields.length) continue
    blocks.push({ kind: 'heading', text: s.title })
    for (const f of fields) {
      blocks.push(
        f.area
          ? { kind: 'area', label: f.label, value: values[f.id], lines: f.lines }
          : { kind: 'field', label: f.label, value: values[f.id] },
      )
    }
  }
  return buildDocx(blocks)
}

/** Pre-fills the form from a candidate card (only fields the card has). */
export function valuesFromCandidate(c: CandidateFull): ResumeValues {
  const fam = c.family
  const join = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(', ')
  const v: ResumeValues = {
    name: fullName(c),
    hebrewDate: c.hebrew_birth_date ?? '',
    gregDate: formatGregorian(c.birth_date) ?? '',
    city: join(c.city, c.region),
    eda: hasEda(c) ? (edaLabel(edaOf(c), edaDetail(c)) ?? '') : '',
    height: c.height_cm ? `${c.height_cm} ${he.common.cm}` : '',
    appearance: c.appearance ?? '',
    institutions: c.education_history
      .map((e) => [e.name, e.type, e.years].filter(Boolean).join(' · '))
      .join('\n'),
    current: c.institution ?? '',
    occupation: join(c.occupation, c.degree),
    father: join(fam?.father_name, fam?.father_occupation),
    mother: join(fam?.mother_name, fam?.mother_occupation),
    motherMaiden: fam?.mother_maiden_name ?? '',
    siblings:
      fam?.siblings_count != null
        ? fam.birth_order != null
          ? he.detail.birthOrderOf(fam.birth_order, fam.siblings_count)
          : String(fam.siblings_count)
        : '',
    married: c.in_laws
      .map((l) => [l.relation, l.full_name, l.details].filter(Boolean).join(' – '))
      .join('\n'),
    character: c.character_description ?? '',
    home: c.desired_home_style ?? '',
    looking: c.special_requirements ?? '',
    notes: c.general_notes ?? '',
  }
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x))
}
