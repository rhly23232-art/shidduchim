import { HeartHandshake, Info, Sparkles, UserRound } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/features/candidates/StatusBadge'
import { useAppActions } from '@/features/workspace/appActions'
import { CandidatePicker } from '@/features/workspace/bits'
import { ScoreRing } from '@/features/workspace/NewProposalDialog'
import { useCandidateIndex, useProposals } from '@/hooks/useWorkspace'
import { findMatches } from '@/lib/matching'
import { he } from '@/lib/strings.he'
import { fullName } from '@/lib/utils'

export default function MatchPage() {
  const [params, setParams] = useSearchParams()
  const forId = params.get('for')
  const { rows, byId, isLoading } = useCandidateIndex()
  const proposals = useProposals()
  const actions = useAppActions()
  const base = forId ? byId.get(forId) : undefined

  const results = useMemo(
    () => (base ? findMatches(base, rows, proposals.data ?? [], 12) : []),
    [base, rows, proposals.data],
  )

  const pick = (id: string | null) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (id) n.set('for', id)
        else n.delete('for')
        return n
      },
      { replace: true },
    )

  return (
    <main id="main" className="space-y-5 px-4 pb-16 pt-5 md:px-6">
      <p className="text-sm text-ink-muted">{he.match.subtitle}</p>

      <section className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface p-4 shadow-card md:grid-cols-[minmax(0,22rem)_1fr] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="match-pick">{he.match.pick}</Label>
          {isLoading ? (
            <Skeleton className="h-10" />
          ) : (
            <CandidatePicker
              id="match-pick"
              value={forId}
              onChange={pick}
              candidates={rows}
              placeholder={he.match.pickPlaceholder}
            />
          )}
        </div>
        {base && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-cream-50 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-navy-900 text-surface">
              <UserRound className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-lg font-bold text-navy-900">{fullName(base)}</p>
              <p className="text-[13px] text-ink-muted">
                {[he.gender[base.gender], base.age, base.city, base.community, base.chassidut]
                  .filter((x) => x !== null && x !== '')
                  .join(' · ')}
              </p>
            </div>
            <StatusBadge status={base.status} hideActive={false} />
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto"
              onClick={() => actions.openCandidate(base.id)}
            >
              {he.table.details}
            </Button>
          </div>
        )}
      </section>

      {!base ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <Sparkles className="size-7 text-gold-700" aria-hidden />
          <p className="mt-3 text-ink-muted">{he.match.empty}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-navy-900">{he.match.results(results.length)}</h2>
            <p className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <Info className="size-3.5" aria-hidden />
              {he.match.tip}
            </p>
          </div>
          {results.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface px-6 py-10 text-center text-ink-muted">
              {he.match.noResults}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((r) => {
                const c = r.candidate
                const [male, female] = base.gender === 'male' ? [base.id, c.id] : [c.id, base.id]
                return (
                  <li
                    key={c.id}
                    className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      <ScoreRing score={r.score} size={48} />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => actions.openCandidate(c.id)}
                          className="truncate text-start font-heading text-lg font-bold text-navy-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                        >
                          {fullName(c)}
                        </button>
                        <p className="truncate text-[13px] text-ink-muted">
                          {[c.age, c.city, c.institution]
                            .filter((x) => x !== null && x !== '')
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.reasons.map((t) => (
                        <Badge key={t} tone="success">
                          {t}
                        </Badge>
                      ))}
                      {r.concerns.map((t) => (
                        <Badge key={t} tone="warning">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-auto flex gap-2 pt-4">
                      <Button size="sm" variant="ghost" onClick={() => actions.openCandidate(c.id)}>
                        {he.table.details}
                      </Button>
                      {r.proposalId ? (
                        <Button
                          size="sm"
                          className="ms-auto"
                          onClick={() => actions.openProposal(r.proposalId!)}
                        >
                          {he.match.proposed}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          className="ms-auto"
                          onClick={() => actions.newProposal({ male_id: male, female_id: female })}
                        >
                          <HeartHandshake />
                          {he.match.propose}
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
