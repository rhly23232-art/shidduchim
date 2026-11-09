import { useMemo } from 'react'
import { dataApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { he } from '@/lib/strings.he'
import type { CandidateRow } from '@/lib/types'
import { fullName } from '@/lib/utils'
import { ComposeEmailDialog, type EmailAttachment } from './ComposeEmailDialog'
import { buildEmailBody, buildMailto, emailSubject, sendViaServer } from './sendResumeEmail'
import { useResumeActions } from './uploadResume'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: CandidateRow
  defaultTo?: string
}

/** Sends a candidate's details with their stored resume attached. */
export function EmailDialog({ open, onOpenChange, candidate, defaultTo = '' }: Props) {
  const { user } = useAuth()
  const { download } = useResumeActions()
  const resume = candidate.resume

  const attachment = useMemo<EmailAttachment | null>(
    () =>
      resume
        ? {
            name: resume.file_name,
            size: resume.size_bytes,
            load: async () => ({
              blob: await dataApi.getResumeBlob(resume),
              filename: resume.file_name,
              mime: resume.mime_type,
            }),
            download: () => void download(resume),
          }
        : null,
    [resume, download],
  )

  return (
    <ComposeEmailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={he.email.title}
      description={fullName(candidate)}
      defaults={{
        to: defaultTo,
        subject: emailSubject(candidate),
        body: buildEmailBody(candidate, user?.fullName ?? null),
      }}
      defaultsKey={candidate.id}
      attachment={attachment}
      sendViaServer={
        dataApi.supportsServerEmail
          ? (v, key) => sendViaServer({ candidateId: candidate.id, ...v, idempotencyKey: key })
          : undefined
      }
      buildMailto={(v) => buildMailto(candidate, v.to, v.subject, v.body)}
    />
  )
}
