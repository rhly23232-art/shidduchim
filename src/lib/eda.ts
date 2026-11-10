import type { CandidateRow } from './types'

// Local copy (no imports) so build scripts can use this module directly.
const normalizeSearch = (text: string) =>
  text
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/["'`׳״\-–—.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/** The four עדה groups used by the filter. */
export const EDA_KEYS = ['litai', 'mizrah', 'chasidut', 'other'] as const
export type EdaKey = (typeof EDA_KEYS)[number]

/** Eastern origins (עדות מזרח) — one list for the client test and the server filter. */
const MIZRAH_WORDS = [
  'ספרד',
  'מזרח',
  'תימנ',
  'מרוק',
  'עיראק',
  'בבל',
  'פרס',
  'תוניס',
  'לוב',
  'כורד',
  'בוכר',
  'אלג',
  'הודי',
  'גרוזי',
  'קווקז',
  'טורק',
  'תורכ',
  'סורי',
  'חלב',
  'מצרי',
  'לבנונ',
  'תימן',
  'ג׳רב',
  'גרב',
]
const MIZRAH = new RegExp(MIZRAH_WORDS.join('|'))

/**
 * Derives the group from the free-text עדה and חסידות fields:
 * a named חסידות → חסידות; ליטאי → ליטא; any eastern origin → עדות מזרח; everything else → אחר.
 */
export function edaOf(
  r: Pick<CandidateRow, 'community' | 'chassidut'> & { eda?: EdaKey | null },
): EdaKey {
  if (r.eda) return r.eda
  const ch = r.chassidut ?? ''
  const cm = r.community ?? ''
  if (/חסיד/.test(ch) || /חסיד/.test(cm)) return 'chasidut'
  if (MIZRAH.test(cm) || MIZRAH.test(ch)) return 'mizrah'
  if (/ליטא/.test(ch) || /ליטא/.test(cm)) return 'litai'
  return 'other'
}

/** Group match plus the optional typed detail (מוצא / שם החסידות / טקסט חופשי). */
export function edaMatches(
  r: Pick<CandidateRow, 'community' | 'chassidut'> & { eda?: EdaKey | null },
  eda: EdaKey | null,
  text: string,
): boolean {
  if (!eda) return true
  if (edaOf(r) !== eda) return false
  const t = normalizeSearch(text)
  if (!t) return true
  const hay =
    eda === 'chasidut'
      ? normalizeSearch(`${r.chassidut ?? ''} ${r.community ?? ''}`)
      : eda === 'mizrah'
        ? normalizeSearch(`${r.community ?? ''} ${r.chassidut ?? ''}`)
        : normalizeSearch(`${r.community ?? ''} ${r.chassidut ?? ''}`)
  return hay.includes(t)
}

/** The typed detail shown next to the group: מוצא / שם החסידות / טקסט חופשי. */
export function edaDetail(
  r: Pick<CandidateRow, 'community' | 'chassidut'> & { eda?: EdaKey | null },
): string {
  const g = edaOf(r)
  if (g === 'chasidut') return (r.chassidut ?? '').replace(/^חסידות\s+/, '').trim()
  if (g === 'litai') return ''
  return (r.community ?? '').trim()
}

/** Whether a candidate has any עדה information at all. */
export const hasEda = (
  r: Pick<CandidateRow, 'community' | 'chassidut'> & { eda?: EdaKey | null },
) => !!(r.eda || r.community?.trim() || r.chassidut?.trim())

/**
 * Server-side twin of `edaOf` (lib/eda.ts): the stored `eda` column wins; cards saved before
 * it existed are classified from their free text, in the same order of precedence
 * (חסידות → עדות מזרח → ליטא → אחר).
 */
export function edaServerFilter(eda: EdaKey): string {
  const any = (col: 'community' | 'chassidut', words: string[]) =>
    words.map((w) => `${col}.ilike.*${w}*`)
  const none = (col: 'community' | 'chassidut', words: string[]) =>
    words.map((w) => `or(${col}.is.null,${col}.not.ilike.*${w}*)`)
  const chas = [...any('chassidut', ['חסיד']), ...any('community', ['חסיד'])]
  const notChas = [...none('chassidut', ['חסיד']), ...none('community', ['חסיד'])]
  const miz = [...any('community', MIZRAH_WORDS), ...any('chassidut', MIZRAH_WORDS)]
  const notMiz = [...none('community', MIZRAH_WORDS), ...none('chassidut', MIZRAH_WORDS)]
  const lit = [...any('chassidut', ['ליטא']), ...any('community', ['ליטא'])]
  const notLit = [...none('chassidut', ['ליטא']), ...none('community', ['ליטא'])]
  const legacy = (cond: string) => `and(eda.is.null,${cond})`
  switch (eda) {
    case 'chasidut':
      return `eda.eq.chasidut,${legacy(`or(${chas.join(',')})`)}`
    case 'mizrah':
      return `eda.eq.mizrah,${legacy(`and(${notChas.join(',')}),or(${miz.join(',')})`)}`
    case 'litai':
      return `eda.eq.litai,${legacy(`and(${[...notChas, ...notMiz].join(',')}),or(${lit.join(',')})`)}`
    case 'other':
      return `eda.eq.other,${legacy([...notChas, ...notMiz, ...notLit].join(','))}`
  }
}
