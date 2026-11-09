import { edaMatches } from '@/lib/eda'
import type { CandidateFilters, FacetRow, SortState } from '@/lib/api'
import { AGE_MAX, AGE_MIN } from '@/lib/age'
import type { CandidateRow, Gender } from '@/lib/types'
import { hebrewCollator, normalizeSearch } from '@/lib/utils'

export const ageFilterActive = (f: Pick<CandidateFilters, 'ageMin' | 'ageMax'>) =>
  f.ageMin > AGE_MIN || f.ageMax < AGE_MAX

/** Precomputed, normalized search text per row (cached by object identity). */
const haystackCache = new WeakMap<CandidateRow, string>()
function haystack(r: CandidateRow): string {
  let h = haystackCache.get(r)
  if (h === undefined) {
    h = normalizeSearch(
      [r.first_name, r.last_name, r.general_notes, r.special_requirements]
        .filter(Boolean)
        .join(' '),
    )
    haystackCache.set(r, h)
  }
  return h
}

export function filterCandidates(
  rows: CandidateRow[],
  gender: Gender,
  f: CandidateFilters,
): CandidateRow[] {
  const terms = normalizeSearch(f.q).split(' ').filter(Boolean)
  const ageOn = ageFilterActive(f)
  const loc = f.cities.length > 0 || f.regions.length > 0
  const cities = new Set(f.cities)
  const regions = new Set(f.regions)
  const inst = new Set(f.institutions)
  return rows.filter((r) => {
    if (r.gender !== gender) return false
    if (ageOn) {
      if (r.age === null || r.age < f.ageMin) return false
      // ageMax at the slider's top end means "and above"
      if (f.ageMax < AGE_MAX && r.age > f.ageMax) return false
    }
    if (loc && !cities.has(r.city ?? '') && !regions.has(r.region ?? '')) return false
    if (inst.size && !inst.has(r.institution ?? '')) return false
    if (!edaMatches(r, f.eda, f.edaText)) return false
    if (terms.length) {
      const h = haystack(r)
      for (const t of terms) if (!h.includes(t)) return false
    }
    return true
  })
}

const nullsLast = (a: unknown, b: unknown) => (a == null ? 1 : 0) - (b == null ? 1 : 0)

export function sortCandidates(rows: CandidateRow[], sort: SortState): CandidateRow[] {
  const dir = sort.dir === 'asc' ? 1 : -1
  const text = (pick: (r: CandidateRow) => string | null) => (a: CandidateRow, b: CandidateRow) => {
    const va = pick(a)
    const vb = pick(b)
    if (va == null || vb == null) return nullsLast(va, vb)
    return dir * hebrewCollator.compare(va, vb)
  }
  const cmp: Record<SortState['key'], (a: CandidateRow, b: CandidateRow) => number> = {
    name: text((r) => `${r.first_name} ${r.last_name}`),
    city: text((r) => r.city),
    institution: text((r) => r.institution),
    occupation: text((r) => r.occupation),
    age: (a, b) =>
      a.age == null || b.age == null ? nullsLast(a.age, b.age) : dir * (a.age - b.age),
    updated: (a, b) => dir * a.updated_at.localeCompare(b.updated_at),
  }
  const c = cmp[sort.key]
  return [...rows].sort((a, b) => c(a, b) || hebrewCollator.compare(a.first_name, b.first_name))
}

export interface FacetOptions {
  cities: string[]
  regions: string[]
  institutions: string[]
}

export function buildFacets(rows: FacetRow[]): FacetOptions {
  const uniq = (pick: (r: FacetRow) => string | null) =>
    [...new Set(rows.map(pick).filter((x): x is string => !!x && x.trim() !== ''))].sort(
      hebrewCollator.compare,
    )
  return {
    cities: uniq((r) => r.city),
    regions: uniq((r) => r.region),
    institutions: uniq((r) => r.institution),
  }
}
