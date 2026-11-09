import {
  CalendarClock,
  Eye,
  Loader2,
  Mail,
  MessageSquarePlus,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { EmailDialog } from '@/features/resumes/EmailDialog'
import { useResumeActions } from '@/features/resumes/uploadResume'
import {
  useAddNote,
  useCandidateIndex,
  useDeleteProposal,
  useProposalEvents,
  useProposals,
  useSaveProposal,
} from '@/hooks/useWorkspace'
import { scorePair } from '@/lib/matching'
import { he } from '@/lib/strings.he'
import {
  PROPOSAL_STAGES,
  SIDE_RESPONSES,
  type CandidateRow,
  type Gender,
  type Proposal,
  type ProposalEvent,
  type ProposalInput,
  type SideResponse,
} from '@/lib/types'
import { cn, errorMessage, fullName } from '@/lib/utils'
import { useAppActions } from './appActions'
import { DueBadge, StageBadge, relativeTime } from './bits'
import { ScoreRing } from './NewProposalDialog'

const PIPELINE = PROPOSAL_STAGES.filter((s) => s !== 'closed')

function eventText(e: ProposalEvent): string {
  switch (e.kind) {
    case 'created':
      return he.proposals.eventCreated
    case 'stage':
      return he.proposals.eventStage(
        he.stage[e.from_stage ?? 'idea'],
        he.stage[e.to_stage ?? 'idea'],
      )
    case 'response':
      return he.proposals.eventResponse(
        e.side === 'female' ? 'בחורה' : 'בחור',
        he.response[e.response ?? 'pending'],
      )
    default:
      return e.text ?? ''
  }
}

function SideCard({
  c,
  side,
  response,
  onResponse,
  other,
}: {
  c: CandidateRow | undefined
  side: Gender
  response: SideResponse
  onResponse: (r: SideResponse) => void
  other: CandidateRow | undefined
}) {
  const actions = useAppActions()
  const resumeActions = useResumeActions()
  const [emailOpen, setEmailOpen] = useState(false)
  if (!c) return <Skeleton className="h-40" />
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-ink-muted">
            {side === 'male' ? he.proposals.male : he.proposals.female}
          </p>
          <button
            type="button"
            onClick={() => actions.openCandidate(c.id)}
            className="truncate text-start font-heading text-lg font-bold text-navy-900 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            {fullName(c)}
          </button>
          <p className="text-[13px] text-ink-muted">
            {[c.age, c.city, c.institution].filter((x) => x !== null && x !== '').join(' · ')}
          </p>
        </div>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[12px] font-medium text-ink-muted">
          {side === 'male' ? he.proposals.maleResponse : he.proposals.femaleResponse}
        </legend>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-cream-100 p-1" role="radiogroup">
          {SIDE_RESPONSES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={response === r}
              onClick={() => onResponse(r)}
              className={cn(
                'rounded-md px-1 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
                response === r
                  ? r === 'interested'
                    ? 'bg-success text-surface'
                    : r === 'declined'
                      ? 'bg-danger text-surface'
                      : 'bg-navy-900 text-surface'
                  : 'text-navy-800 hover:bg-surface',
              )}
            >
              {he.response[r]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" onClick={() => actions.openCandidate(c.id)}>
          <UserRound />
          {he.table.details}
        </Button>
        {c.resume && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => resumeActions.view(c.resume!, fullName(c))}
          >
            <Eye />
            {he.resume.view}
          </Button>
        )}
        {other && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEmailOpen(true)}
            title={he.proposals.sendResumeTo(fullName(c))}
          >
            <Mail />
            {he.resume.email}
          </Button>
        )}
      </div>
      <EmailDialog open={emailOpen} onOpenChange={setEmailOpen} candidate={c} />
    </div>
  )
}

function Editor({ p, onDeleted }: { p: Proposal; onDeleted: () => void }) {
  const { byId } = useCandidateIndex()
  const save = useSaveProposal()
  const del = useDeleteProposal()
  const addNote = useAddNote()
  const events = useProposalEvents(p.id)
  const [notes, setNotes] = useState(p.notes ?? '')
  const [reason, setReason] = useState(p.closed_reason ?? '')
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const male = byId.get(p.male_id)
  const female = byId.get(p.female_id)
  const fit = male && female ? scorePair(male, female) : null

  useEffect(() => {
    setNotes(p.notes ?? '')
    setReason(p.closed_reason ?? '')
  }, [p.id, p.notes, p.closed_reason])

  const base: ProposalInput = {
    male_id: p.male_id,
    female_id: p.female_id,
    stage: p.stage,
    male_response: p.male_response,
    female_response: p.female_response,
    next_followup: p.next_followup,
    notes: p.notes,
    closed_reason: p.closed_reason,
  }
  const patch = async (change: Partial<ProposalInput>, quiet = false) => {
    try {
      await save.mutateAsync({ id: p.id, input: { ...base, ...change } })
      if (!quiet) toast.success(he.proposals.saved)
    } catch (e) {
      toast.error(he.common.unknownError, { description: errorMessage(e) })
    }
  }

  const stageIndex = PIPELINE.indexOf(p.stage as (typeof PIPELINE)[number])

  return (
    <>
      <div className="border-b border-line px-5 pb-4 pe-14 pt-5 sm:px-7">
        <div className="flex items-center gap-2">
          <StageBadge stage={p.stage} />
          {p.next_followup && <DueBadge date={p.next_followup} />}
        </div>
        <SheetTitle className="mt-2 font-heading text-2xl font-bold text-navy-900">
          {male && female ? he.proposals.pair(fullName(male), fullName(female)) : '…'}
        </SheetTitle>
        <SheetDescription className="mt-0.5 text-sm text-ink-muted">
          {he.stageHint[p.stage]}
        </SheetDescription>
      </div>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
        {/* Stage stepper */}
        <section aria-labelledby="pd-stage">
          <h3 id="pd-stage" className="mb-3 font-sans text-sm font-semibold text-navy-900">
            {he.proposals.stage}
          </h3>
          <ol className="grid grid-cols-5 gap-1.5">
            {PIPELINE.map((s, i) => {
              const done = p.stage !== 'closed' && i <= stageIndex
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => s !== p.stage && void patch({ stage: s })}
                    aria-current={p.stage === s ? 'step' : undefined}
                    className={cn(
                      'flex w-full flex-col items-center gap-1.5 rounded-lg px-1 py-2 text-center text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
                      p.stage === s
                        ? 'bg-navy-50 text-navy-900'
                        : 'text-ink-muted hover:bg-cream-100',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-full rounded-full transition-colors',
                        done ? (s === 'engaged' ? 'bg-success' : 'bg-navy-900') : 'bg-navy-100',
                      )}
                      aria-hidden
                    />
                    {he.stage[s]}
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {p.stage !== 'closed' ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger hover:bg-danger-soft"
                onClick={() => void patch({ stage: 'closed', closed_reason: reason || null })}
              >
                {he.proposals.moveTo}: {he.stage.closed}
              </Button>
            ) : (
              <div className="w-full space-y-1.5">
                <Label htmlFor="pd-reason">{he.proposals.closedReason}</Label>
                <div className="flex gap-2">
                  <Input
                    id="pd-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={he.proposals.closedReasonPlaceholder}
                    maxLength={500}
                  />
                  <Button
                    size="md"
                    onClick={() => void patch({ closed_reason: reason.trim() || null })}
                    disabled={reason === (p.closed_reason ?? '')}
                  >
                    {he.common.save}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Two sides */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label={he.proposals.title}>
          <SideCard
            c={male}
            side="male"
            response={p.male_response}
            onResponse={(r) => void patch({ male_response: r })}
            other={female}
          />
          <SideCard
            c={female}
            side="female"
            response={p.female_response}
            onResponse={(r) => void patch({ female_response: r })}
            other={male}
          />
        </section>

        {fit && (
          <section className="flex items-start gap-3 rounded-xl bg-navy-50 p-3">
            <ScoreRing score={fit.score} />
            <div className="min-w-0 text-[13px]">
              <p className="font-semibold text-navy-900">{he.match.score}</p>
              {fit.reasons.length > 0 && <p className="text-success">{fit.reasons.join(' · ')}</p>}
              {fit.concerns.length > 0 && (
                <p className="text-warning">{fit.concerns.join(' · ')}</p>
              )}
            </div>
          </section>
        )}

        {/* Follow-up + notes */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-[14rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="pd-follow" className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-gold-700" aria-hidden />
              {he.proposals.followup}
            </Label>
            <Input
              id="pd-follow"
              type="date"
              className="tabular"
              value={p.next_followup ?? ''}
              onChange={(e) => void patch({ next_followup: e.target.value || null }, true)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd-notes">{he.proposals.notes}</Label>
            <Textarea
              id="pd-notes"
              rows={3}
              value={notes}
              maxLength={4000}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() =>
                notes !== (p.notes ?? '') && void patch({ notes: notes.trim() || null })
              }
            />
          </div>
        </section>

        {/* History */}
        <section aria-labelledby="pd-history" className="space-y-3">
          <h3 id="pd-history" className="font-sans text-sm font-semibold text-navy-900">
            {he.proposals.history}
          </h3>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const t = note.trim()
              if (!t) return
              void addNote.mutateAsync({ proposalId: p.id, text: t }).then(() => setNote(''))
            }}
          >
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={he.proposals.notePlaceholder}
              aria-label={he.proposals.addNote}
              maxLength={2000}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!note.trim() || addNote.isPending}
              aria-label={he.proposals.addNote}
            >
              {addNote.isPending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />}
            </Button>
          </form>
          {events.isPending ? (
            <Skeleton className="h-24" />
          ) : (
            <ol className="relative space-y-3 border-s-2 border-navy-100 ps-5">
              {events.data?.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    className={cn(
                      'absolute -start-[27px] top-1.5 size-3 rounded-full border-2 border-surface ring-2 ring-navy-100',
                      e.kind === 'note'
                        ? 'bg-gold-500'
                        : e.kind === 'stage' && e.to_stage === 'engaged'
                          ? 'bg-success'
                          : 'bg-navy-700',
                    )}
                    aria-hidden
                  />
                  <p
                    className={cn(
                      'text-[14px] leading-snug',
                      e.kind === 'note' ? 'text-ink' : 'text-ink-muted',
                    )}
                  >
                    {eventText(e)}
                  </p>
                  {e.kind === 'stage' && e.text && (
                    <p className="text-[13px] text-ink-muted">{e.text}</p>
                  )}
                  <p className="tabular text-[11.5px] text-ink-muted">
                    {relativeTime(e.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line bg-cream-50/70 px-5 py-3 sm:px-7">
        <Button
          variant="ghost"
          className="text-danger hover:bg-danger-soft"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 />
          {he.common.delete}
        </Button>
        {stageIndex >= 0 && stageIndex < PIPELINE.length - 1 && (
          <Button
            variant="primary"
            onClick={() => void patch({ stage: PIPELINE[stageIndex + 1]! })}
            disabled={save.isPending}
          >
            {save.isPending && <Loader2 className="animate-spin" />}
            {he.proposals.nextStage}: {he.stage[PIPELINE[stageIndex + 1]!]}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={he.proposals.deleteTitle}
        description={he.proposals.deleteText}
        confirmLabel={he.common.delete}
        destructive
        onConfirm={() => void del.mutateAsync(p.id).then(onDeleted)}
      />
    </>
  )
}

export function ProposalDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const proposals = useProposals()
  const p = id ? proposals.data?.find((x) => x.id === id) : undefined
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="end" className="max-w-[720px]">
        {p ? (
          <Editor p={p} onDeleted={onClose} />
        ) : (
          <div className="space-y-4 p-7" aria-busy>
            <SheetTitle className="sr-only">{he.common.loading}</SheetTitle>
            <SheetDescription className="sr-only">{he.common.loading}</SheetDescription>
            {proposals.isPending ? (
              <>
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-40" />
              </>
            ) : (
              <p className="pt-10 text-center text-ink-muted">{he.detail.notFound}</p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
