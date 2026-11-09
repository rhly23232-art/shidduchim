import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { ComposeEmailDialog } from '@/features/resumes/ComposeEmailDialog'
import { CandidatePicker } from '@/features/workspace/CandidatePicker'
import { useCandidateIndex } from '@/hooks/useWorkspace'
import { useAuth } from '@/lib/auth'
import { mailtoUrl } from '@/lib/files/save'
import { he } from '@/lib/strings.he'
import { fullName } from '@/lib/utils'
import { buildResumeDocx } from './resumeTemplate'
import { useGeneratedAttachment } from './useDocActions'

const t = he.documents.send

/** Sends the blank resume form (Word) to a candidate's mother, to fill and send back. */
export function SendBlankResumeDialog({
  open,
  onOpenChange,
  candidateId: initialId = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId?: string | null
}) {
  const { user } = useAuth()
  const { rows, byId } = useCandidateIndex()
  const [candidateId, setCandidateId] = useState<string | null>(initialId)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setCandidateId(initialId)
  }
  const c = candidateId ? byId.get(candidateId) : undefined
  const { attachment, server } = useGeneratedAttachment(
    he.documents.resume.fileBlank,
    () => buildResumeDocx(),
    [],
  )

  return (
    <ComposeEmailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.title}
      description={t.description}
      toLabel={t.to}
      defaults={{
        to: '',
        subject: t.subject(c ? fullName(c) : ''),
        body: t.body(c?.last_name ?? '', user?.fullName ?? ''),
      }}
      defaultsKey={candidateId ?? 'none'}
      attachment={attachment}
      sendViaServer={server}
      buildMailto={async (v) => mailtoUrl(v.to, v.subject, v.body)}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="blank-resume-candidate">{t.candidate}</Label>
        <CandidatePicker
          id="blank-resume-candidate"
          value={candidateId}
          onChange={setCandidateId}
          candidates={rows}
          placeholder={he.documents.editor.none}
          allowNone
          noneLabel={he.documents.editor.none}
        />
      </div>
    </ComposeEmailDialog>
  )
}
