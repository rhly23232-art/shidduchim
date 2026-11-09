import { he } from './strings.he'
import type { CandidateRow, Proposal } from './types'

export interface MatchResult {
  candidate: CandidateRow
  /** 0–100 */
  score: number
  reasons: string[]
  concerns: string[]
  proposalId: string | null
}

const MAX_POINTS = 30 + 20 + 20 + 12 + 6

/** Normalizes "חסידות בעלזא" / "בעלזא" style values for comparison. */
const norm = (s: string | null) =>
  (s ?? '')
    .replace(/^חסידות\s+/, '')
    .replace(/["׳״']/g, '')
    .trim()

/**
 * Transparent, rule-based compatibility score. It only ranks; the matchmaker decides.
 * Factors: age gap (בחור typically 0–4 years older), עדה, חוג, location, height, availability.
 */
export function scorePair(
  male: CandidateRow,
  female: CandidateRow,
): { score: number; reasons: string[]; concerns: string[] } {
  let pts = 0
  const reasons: string[] = []
  const concerns: string[] = []

  if (male.age !== null && female.age !== null) {
    const d = male.age - female.age
    if (d >= 0 && d <= 4) {
      pts += 30
      reasons.push(he.match.ageGap(d))
    } else if (d >= 5 && d <= 6) {
      pts += 18
      reasons.push(he.match.ageGap(d))
    } else if (d < 0 && d >= -2) {
      pts += 10
      concerns.push(he.match.femaleOlder)
    } else {
      concerns.push(he.match.ageConcern)
    }
  } else pts += 12

  if (male.community && female.community) {
    if (norm(male.community) === norm(female.community)) {
      pts += 20
      reasons.push(he.match.sameCommunity)
    } else concerns.push(he.match.differentCommunity)
  } else pts += 8

  if (male.chassidut && female.chassidut) {
    if (norm(male.chassidut) === norm(female.chassidut)) {
      pts += 20
      reasons.push(he.match.sameChassidut)
    }
  } else pts += 6

  if (male.city && male.city === female.city) {
    pts += 12
    reasons.push(he.match.sameCity)
  } else if (male.region && male.region === female.region) {
    pts += 8
    reasons.push(he.match.sameRegion)
  }

  if (male.height_cm && female.height_cm) {
    if (male.height_cm >= female.height_cm) {
      pts += 6
      reasons.push(he.match.heightOk)
    } else concerns.push(he.match.heightConcern)
  } else pts += 3

  for (const c of [male, female]) {
    if (c.status === 'in_process') {
      pts -= 15
      concerns.push(he.match.notActive(he.status.in_process))
    }
  }

  return {
    score: Math.max(0, Math.min(100, Math.round((pts / MAX_POINTS) * 100))),
    reasons: [...new Set(reasons)],
    concerns: [...new Set(concerns)],
  }
}

/** Ranked suggestions for one candidate among the opposite gender. */
export function findMatches(
  base: CandidateRow,
  pool: CandidateRow[],
  proposals: Proposal[],
  limit = 12,
): MatchResult[] {
  const pairKey = (m: string, f: string) => `${m}:${f}`
  const existing = new Map(proposals.map((p) => [pairKey(p.male_id, p.female_id), p.id]))
  return pool
    .filter((c) => c.gender !== base.gender && c.status !== 'engaged' && c.status !== 'paused')
    .map((other) => {
      const [m, f] = base.gender === 'male' ? [base, other] : [other, base]
      const r = scorePair(m, f)
      return { candidate: other, ...r, proposalId: existing.get(pairKey(m.id, f.id)) ?? null }
    })
    .sort((a, b) => Number(!!a.proposalId) - Number(!!b.proposalId) || b.score - a.score)
    .slice(0, limit)
}
