/** Full years between an ISO date (yyyy-mm-dd) and today; null when missing/invalid. */
export function ageFromBirthDate(
  birthDate: string | null | undefined,
  today = new Date(),
): number | null {
  if (!birthDate) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  if (!y || !m || !d) return null
  let age = today.getFullYear() - y
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

/** Full years since a yyyy-mm-dd date (0 when today or in the future); null when invalid. */
export function yearsSince(date: string | null | undefined, today = new Date()): number | null {
  return ageFromBirthDate(date, today)
}

/**
 * The age shown everywhere: from the birth date when there is one, otherwise the typed age
 * plus the full years since it was typed. Mirrors `age` in candidates_view (SQL).
 */
export function effectiveAge(
  c: { birth_date: string | null; age_years?: number | null; age_recorded_on?: string | null },
  today = new Date(),
): number | null {
  if (c.birth_date) return ageFromBirthDate(c.birth_date, today)
  if (c.age_years == null || !c.age_recorded_on) return null
  return c.age_years + (yearsSince(c.age_recorded_on, today) ?? 0)
}

/** Today as yyyy-mm-dd in local time. */
export function todayIso(today = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`
}

export const AGE_MIN = 18
export const AGE_MAX = 45
