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

export const AGE_MIN = 18
export const AGE_MAX = 45
