import { HDate } from '@hebcal/core'

/**
 * Converts a Gregorian ISO date (yyyy-mm-dd) to a Hebrew date string,
 * e.g. "2001-03-07" → "י״ב באדר תשס״א". Returns null for empty/invalid input.
 */
export function gregorianToHebrew(iso: string | null | undefined): string | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime()) || date.getDate() !== d) return null
  const parts = new HDate(date).renderGematriya(true).split(' ')
  // parts: [day, ...month words, year]
  if (parts.length < 3) return parts.join(' ')
  const day = parts[0]
  const year = parts[parts.length - 1]
  const month = parts.slice(1, -1).join(' ')
  return `${day} ב${month} ${year}`
}

/** Formats an ISO date as dd.mm.yyyy for display. */
export function formatGregorian(iso: string | null | undefined): string | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return null
  return `${d}.${m}.${y}`
}
