import { Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { useCandidateIndex, useSaveIdea, useIdeas, useSaveProposal } from '@/hooks/useWorkspace'
import { scorePair } from '@/lib/matching'
import { he } from '@/lib/strings.he'
import { PROPOSAL_STAGES, type ProposalStage } from '@/lib/types'
import { errorMessage } from '@/lib/utils'
import type { NewProposalPrefill } from './appActions'
import { CandidatePicker } from './bits'

interface Props {
  prefill: NewProposalPrefill | null
  onClose: () => void
  onCreated: (id: string) => void
}

export function NewProposalDialog({ prefill, onClose, onCreated }: Props) {
  const { rows, byId } = useCandidateIndex()
  const save = useSaveProposal()
  const saveIdea = useSaveIdea()
  const ideas = useIdeas()
  const [male, setMale] = useState<string | null>(null)
  const [female, setFemale] = useState<string | null>(null)
  const [stage, setStage] = useState<ProposalStage>('idea')
  const [followup, setFollowup] = useState('')
  const [notes, setNotes] = useState('')
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!prefill) return
    setMale(prefill.male_id ?? null)
    setFemale(prefill.female_id ?? null)
    setStage('idea')
    setFollowup('')
    setNotes(prefill.notes ?? '')
    setTried(false)
  }, [prefill])

  const m = male ? byId.get(male) : undefined
  const f = female ? byId.get(female) : undefined
  const fit = m && f ? scorePair(m, f) : null

  const submit = async () => {
    setTried(true)
    if (!male || !female) return
    try {
      const { saved } = await save.mutateAsync({
        input: {
          male_id: male,
          female_id: female,
          stage,
          male_response: 'pending',
          female_response: 'pending',
          next_followup: followup || null,
          notes: notes.trim() || null,
          closed_reason: null,
        },
      })
      toast.success(he.proposals.created)
      if (prefill?.ideaId) {
        const idea = ideas.data?.find((i) => i.id === prefill.ideaId)
        if (idea) {
          const { id: _id, created_at: _c, updated_at: _u, ...input } = idea
          void saveIdea.mutateAsync({ id: idea.id, input: { ...input, done: true } })
          toast.message(he.ideas.converted)
        }
      }
      onCreated(saved.id)
    } catch (e) {
      toast.error(he.common.unknownError, { description: errorMessage(e) })
    }
  }

  return (
    <Dialog open={!!prefill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{he.proposals.new}</DialogTitle>
          <DialogDescription>{he.proposals.subtitle}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-male">
                {he.proposals.male}
                <span className="ms-0.5 text-danger" aria-hidden>
                  *
                </span>
              </Label>
              <CandidatePicker
                id="np-male"
                value={male}
                onChange={setMale}
                candidates={rows}
                gender="male"
                placeholder={he.proposals.selectMale}
                invalid={tried && !male}
              />
              {tried && !male && (
                <p role="alert" className="text-xs font-medium text-danger">
                  {he.validation.required}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-female">
                {he.proposals.female}
                <span className="ms-0.5 text-danger" aria-hidden>
                  *
                </span>
              </Label>
              <CandidatePicker
                id="np-female"
                value={female}
                onChange={setFemale}
                candidates={rows}
                gender="female"
                placeholder={he.proposals.selectFemale}
                invalid={tried && !female}
              />
              {tried && !female && (
                <p role="alert" className="text-xs font-medium text-danger">
                  {he.validation.required}
                </p>
              )}
            </div>
          </div>

          {fit && (
            <div className="flex items-start gap-3 rounded-xl bg-navy-50 p-3" aria-live="polite">
              <ScoreRing score={fit.score} />
              <div className="min-w-0 text-[13px]">
                <p className="font-semibold text-navy-900">{he.match.score}</p>
                {fit.reasons.length > 0 && (
                  <p className="text-success">{fit.reasons.join(' · ')}</p>
                )}
                {fit.concerns.length > 0 && (
                  <p className="text-warning">{fit.concerns.join(' · ')}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-stage">{he.proposals.stage}</Label>
              <NativeSelect
                id="np-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as ProposalStage)}
              >
                {PROPOSAL_STAGES.filter((s) => s !== 'closed' && s !== 'engaged').map((s) => (
                  <option key={s} value={s}>
                    {he.stage[s]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-follow">{he.proposals.followup}</Label>
              <Input
                id="np-follow"
                type="date"
                value={followup}
                onChange={(e) => setFollowup(e.target.value)}
                className="tabular"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-notes">{he.proposals.notes}</Label>
            <Textarea
              id="np-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {he.common.cancel}
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            {he.proposals.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const tone = score >= 75 ? 'stroke-success' : score >= 50 ? 'stroke-gold-500' : 'stroke-navy-200'
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${he.match.score}: ${score}`}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-navy-100" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={tone}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="tabular text-[13px] font-bold text-navy-900">{score}</span>
    </span>
  )
}
