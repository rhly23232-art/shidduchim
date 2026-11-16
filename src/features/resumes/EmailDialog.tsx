import { useMemo } from 'react'
import { usePhotoActions } from '@/features/photos/photoActions'
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

/** Sends a candidate's details with their stored resume and photo attached. */
export function EmailDialog({ open, onOpenChange, candidate, defaultTo = '' }: Props) {
  const { user } = useAuth()
  const { download } = useResumeActions()
  const photoActions = usePhotoActions()
  const resume = candidate.resume
  const photo = candidate.photo ?? null

  const attachments = useMemo<EmailAttachment[]>(() => {
    const list: EmailAttachment[] = []
    if (resume)
      list.push({
        id: 'resume',
        name: resume.file_name,
        size: resume.size_bytes,
        load: async () => ({
          blob: await dataApi.getResumeBlob(resume),
          filename: resume.file_name,
          mime: resume.mime_type,
        }),
        download: () => void download(resume),
        downloadLabel: he.email.downloadForAttach,
      })
    // The photo goes with the details when there is one; the sender can switch it off.
    if (photo)
      list.push({
        id: 'photo',
        name: photo.file_name,
        size: photo.size_bytes,
        optional: true,
        load: async () => ({
          blob: await dataApi.getPhotoBlob(photo),
          filename: photo.file_name,
          mime: 'image/jpeg',
        }),
        download: () => void photoActions.download(photo),
        downloadLabel: he.email.downloadPhotoForAttach,
      })
    return list
  }, [resume, photo, download, photoActions])

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
      attachments={attachments}
      sendViaServer={
        dataApi.supportsServerEmail
          ? (v, key, included) =>
              sendViaServer({
                candidateId: candidate.id,
                ...v,
                idempotencyKey: key,
                includePhoto: included.includes('photo'),
              })
          : undefined
      }
      buildMailto={(v, included) =>
        buildMailto(candidate, v.to, v.subject, v.body, included.includes('photo'))
      }
    />
  )
}
