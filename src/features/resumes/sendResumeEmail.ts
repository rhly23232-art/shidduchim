import { dataApi } from '@/lib/api'
import { he } from '@/lib/strings.he'
import type { CandidateRow } from '@/lib/types'
import { fullName } from '@/lib/utils'

/** Default email body with the candidate's basic details. */
export function buildEmailBody(c: CandidateRow, senderName: string | null): string {
  const inst = c.gender === 'male' ? he.filters.institutionMale : he.filters.institutionFemale
  const lines: [string, string | number | null][] = [
    [he.detail.fields.fullName, fullName(c)],
    [he.detail.fields.age, c.age],
    [he.detail.fields.city, c.city],
    [inst, [c.institution, c.institution_type].filter(Boolean).join(' · ') || null],
    [he.detail.fields.occupation, c.occupation],
    [he.detail.fields.community, [c.community, c.chassidut].filter(Boolean).join(' · ') || null],
    [he.detail.fields.height, c.height_cm ? `${c.height_cm} ${he.common.cm}` : null],
  ]
  const details = lines
    .filter(([, v]) => v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return [
    he.email.bodyGreeting,
    '',
    he.email.bodyIntro,
    '',
    details,
    '',
    he.email.bodyClosing,
    senderName ?? '',
  ]
    .join('\n')
    .trim()
}

export function emailSubject(c: CandidateRow): string {
  return he.email.subjectTemplate(fullName(c))
}

/** Server path: real attachment via the `send-resume-email` edge function (Resend). */
export async function sendViaServer(input: {
  candidateId: string
  to: string
  subject: string
  body: string
}) {
  await dataApi.sendResumeEmail(input)
}

/**
 * Fallback: mailto: cannot attach files, so a 7-day signed download link is appended.
 * Returns the mailto URL (opened by the caller).
 */
export async function buildMailto(c: CandidateRow, to: string, subject: string, body: string) {
  let fullBody = body
  if (c.resume && dataApi.supportsShareLinks) {
    const link = await dataApi.createShareLink(c.resume)
    if (link) fullBody = `${body}\n\n${he.email.linkLine(link)}`
  }
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`
  return `mailto:${encodeURIComponent(to.trim())}?${q}`
}
