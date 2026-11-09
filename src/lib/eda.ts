import type { CandidateRow } from './types'
import { normalizeSearch } from './utils'

/** The four עדה groups used by the filter. */
export const EDA_KEYS = ['litai', 'mizrah', 'chasidut', 'other'] as const
export type EdaKey = (typeof EDA_KEYS)[number]

const MIZRAH =
  /ספרד|מזרח|תימנ|מרוק|עיראק|בבל|פרס|תוניס|לוב|כורד|בוכר|אלג|הודי|גרוזי|קווקז|טורק|תורכ|סורי|חלב|מצרי|לבנונ|תימן|ג׳רב|גרב/

/**
 * Derives the group from the free-text עדה and חסידות fields:
 * a named חסידות → חסידות; ליטאי → ליטא; any eastern origin → עדות מזרח; everything else → אחר.
 */
export function edaOf(r: Pick<CandidateRow, 'community' | 'chassidut'>): EdaKey {
  const ch = r.chassidut ?? ''
  const cm = r.community ?? ''
  if (/חסיד/.test(ch) || /חסיד/.test(cm)) return 'chasidut'
  if (MIZRAH.test(cm) || MIZRAH.test(ch)) return 'mizrah'
  if (/ליטא/.test(ch) || /ליטא/.test(cm)) return 'litai'
  return 'other'
}

/** Group match plus the optional typed detail (מוצא / שם החסידות / טקסט חופשי). */
export function edaMatches(
  r: Pick<CandidateRow, 'community' | 'chassidut'>,
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
