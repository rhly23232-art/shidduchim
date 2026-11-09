import { HeartHandshake, Plus, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCandidateIndex, useProposals } from '@/hooks/useWorkspace'
import { findMatches } from '@/lib/matching'
import { he } from '@/lib/strings.he'
import type { CandidateRow } from '@/lib/types'
import { fullName } from '@/lib/utils'
import { useAppActions } from './appActions'
import { DueBadge, StageBadge } from './bits'
import { ScoreRing } from './NewProposalDialog'

/** Proposals involving the candidate + the top smart-match suggestions (inside the details card). */
export function CandidateWorkspace({ c }: { c: CandidateRow }) {
  const proposals = useProposals()
  const { rows, byId } = useCandidateIndex()
  const actions = useAppActions()
  const mine = (proposals.data ?? []).filter((p) => p.male_id === c.id || p.female_id === c.id)
  const top = useMemo(
    () =>
      c.status === 'engaged'
        ? []
        : findMatches(c, rows, proposals.data ?? [], 3).filter((m) => !m.proposalId),
    [c, rows, proposals.data],
  )
  const pair = (otherId: string) =>
    c.gender === 'male'
      ? { male_id: c.id, female_id: otherId }
      : { male_id: otherId, female_id: c.id }

  return (
    <div className="space-y-6">
      <section aria-labelledby="cw-proposals" className="border-t border-line pt-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3
            id="cw-proposals"
            className="flex items-center gap-2 text-[17px] font-bold text-navy-900"
          >
            <span
              className="grid size-7 place-items-center rounded-lg bg-gold-100 text-gold-700"
              aria-hidden
            >
              <HeartHandshake className="size-4" />
            </span>
            {he.proposals.forCandidate}
          </h3>
          <Button
            size="sm"
            variant="subtle"
            onClick={() =>
              actions.newProposal(c.gender === 'male' ? { male_id: c.id } : { female_id: c.id })
            }
          >
            <Plus />
            {he.proposals.new}
          </Button>
        </div>
        {mine.length === 0 ? (
          <p className="text-sm text-ink-muted">{he.proposals.noneForCandidate}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {mine.map((p) => {
              const other = byId.get(c.gender === 'male' ? p.female_id : p.male_id)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => actions.openProposal(p.id)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-start transition-colors hover:bg-navy-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-navy-900">
                      {other ? fullName(other) : '—'}
                    </span>
                    <StageBadge stage={p.stage} />
                    {p.next_followup && p.stage !== 'closed' && p.stage !== 'engaged' && (
                      <DueBadge date={p.next_followup} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {top.length > 0 && (
        <section aria-labelledby="cw-matches" className="border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3
              id="cw-matches"
              className="flex items-center gap-2 text-[17px] font-bold text-navy-900"
            >
              <span
                className="grid size-7 place-items-center rounded-lg bg-gold-100 text-gold-700"
                aria-hidden
              >
                <Sparkles className="size-4" />
              </span>
              {he.match.inCandidate}
            </h3>
            <Button size="sm" variant="link" asChild>
              <Link to={`/match?for=${c.id}`}>{he.match.seeAll}</Link>
            </Button>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {top.map((m) => (
              <li
                key={m.candidate.id}
                className="flex flex-col gap-2 rounded-lg border border-line p-3"
              >
                <div className="flex items-center gap-2.5">
                  <ScoreRing score={m.score} size={40} />
                  <button
                    type="button"
                    onClick={() => actions.openCandidate(m.candidate.id)}
                    className="min-w-0 truncate text-start text-[14px] font-semibold text-navy-900 hover:underline"
                  >
                    {fullName(m.candidate)}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.reasons.slice(0, 2).map((r) => (
                    <Badge key={r} tone="success">
                      {r}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="mt-auto"
                  onClick={() => actions.newProposal(pair(m.candidate.id))}
                >
                  <HeartHandshake />
                  {he.match.propose}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
