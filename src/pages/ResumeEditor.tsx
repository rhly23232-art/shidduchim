import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Download, Eraser, FileUp, Mail, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip } from '@/components/ui/tooltip'
import {
  buildResumeDocx,
  hasAnyValue,
  RESUME_SECTIONS,
  valuesFromCandidate,
  type ResumeValues,
} from '@/features/documents/resumeTemplate'
import { saveDocx, useGeneratedAttachment } from '@/features/documents/useDocActions'
import { ComposeEmailDialog } from '@/features/resumes/ComposeEmailDialog'
import { useResumeActions } from '@/features/resumes/uploadResume'
import { CandidatePicker } from '@/features/workspace/CandidatePicker'
import { qk } from '@/hooks/useCandidates'
import { useCandidateIndex } from '@/hooks/useWorkspace'
import { dataApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { DOCX_MIME } from '@/lib/files/docx'
import { mailtoUrl } from '@/lib/files/save'
import { he } from '@/lib/strings.he'
import { errorMessage, fullName } from '@/lib/utils'

const t = he.documents.editor
const DRAFT_KEY = 'shidduchim-resume-draft'

interface Draft {
  candidateId: string | null
  values: ResumeValues
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) {
      const d = JSON.parse(raw) as Draft
      if (d && typeof d.values === 'object')
        return { candidateId: d.candidateId ?? null, values: d.values }
    }
  } catch {
    /* no storage */
  }
  return { candidateId: null, values: {} }
}

/** Free-fill resume: every field optional; draft auto-saved; export to Word, email or attach. */
export default function ResumeEditorPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { rows, byId } = useCandidateIndex()
  const { upload } = useResumeActions()
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [filling, setFilling] = useState(false)
  const { values, candidateId } = draft
  const candidate = candidateId ? byId.get(candidateId) : undefined
  const empty = !hasAnyValue(values)

  // Auto-save the draft (prevents losing typed text on refresh / navigation).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      } catch {
        /* storage unavailable */
      }
    }, 300)
    return () => clearTimeout(id)
  }, [draft])

  const setValue = (id: string, v: string) =>
    setDraft((d) => ({ ...d, values: { ...d.values, [id]: v } }))

  const fillFromCandidate = async (id: string, onlyEmpty: boolean) => {
    setFilling(true)
    try {
      const full = await qc.fetchQuery({
        queryKey: qk.detail(id),
        queryFn: () => dataApi.getCandidate(id),
      })
      if (!full) throw new Error(he.detail.notFound)
      const fromCard = valuesFromCandidate(full)
      setDraft((d) => {
        const next = { ...d.values }
        for (const [k, v] of Object.entries(fromCard)) {
          if (!onlyEmpty || !next[k]?.trim()) next[k] = v
        }
        return { ...d, values: next }
      })
      toast.success(t.filled)
    } catch (e) {
      toast.error(he.common.unknownError, { description: errorMessage(e) })
    } finally {
      setFilling(false)
    }
  }

  const pickCandidate = (id: string | null) => {
    setDraft((d) => ({ ...d, candidateId: id }))
    if (id && empty) void fillFromCandidate(id, true)
  }

  const fileName = t.fileName(
    (values.name?.trim() || (candidate ? fullName(candidate) : '')).replace(/\s+/g, '-'),
  )
  const docx = useMemo(() => buildResumeDocx(values), [values])
  const { attachment, server } = useGeneratedAttachment(fileName, () => docx, [docx, fileName])

  const attach = async () => {
    if (!candidate) return
    const file = new File([docx], fileName, { type: DOCX_MIME })
    await upload(candidate, file, DOCX_MIME)
  }

  return (
    <main id="main" className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-32 pt-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="-ms-2">
          <Link to="/documents">
            <ArrowRight />
            {t.back}
          </Link>
        </Button>
        <p className="text-body-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 items-end gap-4 pt-5 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="resume-candidate">{t.linkTo}</Label>
            <CandidatePicker
              id="resume-candidate"
              value={candidateId}
              onChange={pickCandidate}
              candidates={rows}
              placeholder={t.none}
              allowNone
              noneLabel={t.none}
            />
            <p className="text-caption text-muted-foreground">{t.linkHint}</p>
          </div>
          <Button
            disabled={!candidateId}
            loading={filling}
            onClick={() => candidateId && void fillFromCandidate(candidateId, false)}
            className="sm:mb-6"
          >
            {!filling && <Wand2 />}
            {t.fillFromCandidate}
          </Button>
        </CardContent>
      </Card>

      {RESUME_SECTIONS.map((s) => (
        <Card key={s.id} aria-labelledby={`rs-${s.id}`} role="group">
          <CardHeader>
            <CardTitle id={`rs-${s.id}`}>{s.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {s.fields.map((f) => (
              <Field key={f.id} label={f.label} className={f.area ? 'sm:col-span-2' : undefined}>
                {(id, aria) =>
                  f.area ? (
                    <Textarea
                      id={id}
                      {...aria}
                      rows={f.lines ?? 3}
                      placeholder={f.placeholder}
                      value={values[f.id] ?? ''}
                      onChange={(e) => setValue(f.id, e.target.value)}
                    />
                  ) : (
                    <Input
                      id={id}
                      {...aria}
                      dir={f.ltr ? 'ltr' : undefined}
                      className={f.ltr ? 'text-start' : undefined}
                      placeholder={f.placeholder}
                      value={values[f.id] ?? ''}
                      onChange={(e) => setValue(f.id, e.target.value)}
                    />
                  )
                }
              </Field>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* sticky action bar */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-card px-4 py-3 md:-mx-8 md:px-8">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setConfirmClear(true)}
            disabled={empty}
            className="max-sm:px-3"
          >
            <Eraser />
            <span className="max-sm:sr-only">{t.clear}</span>
          </Button>
          <div className="ms-auto flex items-center gap-2">
            <Button onClick={() => setSendOpen(true)} disabled={empty} className="max-sm:px-3">
              <Mail />
              <span className="max-sm:sr-only">{t.send}</span>
            </Button>
            <Tooltip content={candidate ? null : t.attachNeedsCandidate}>
              <span tabIndex={candidate ? undefined : 0} className="inline-flex">
                <Button
                  disabled={!candidate || empty}
                  onClick={() => (candidate?.resume ? setConfirmReplace(true) : void attach())}
                  className="max-sm:px-3"
                >
                  <FileUp />
                  <span className="max-sm:sr-only">{t.attach}</span>
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="primary"
              disabled={empty}
              onClick={() => void saveDocx(fileName, docx)}
            >
              <Download />
              {t.download}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t.clearTitle}
        description={t.clearText}
        confirmLabel={t.clear}
        destructive
        onConfirm={() => {
          setDraft({ candidateId: null, values: {} })
          toast.success(t.cleared)
        }}
      />
      <ConfirmDialog
        open={confirmReplace}
        onOpenChange={setConfirmReplace}
        title={t.attachReplaceTitle}
        description={candidate?.resume ? t.attachReplaceText(candidate.resume.file_name) : ''}
        confirmLabel={t.attachReplace}
        onConfirm={() => void attach()}
      />
      <ComposeEmailDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={he.documents.send.sendFilledTitle}
        description={he.documents.send.sendFilledDescription}
        defaults={{
          to: '',
          subject: he.documents.send.filledSubject(values.name?.trim() ?? ''),
          body: he.documents.send.filledBody(user?.fullName ?? ''),
        }}
        attachment={attachment}
        sendViaServer={server}
        buildMailto={async (v) => mailtoUrl(v.to, v.subject, v.body)}
      />
    </main>
  )
}
