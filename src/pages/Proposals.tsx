import { CalendarClock, Columns3, HeartHandshake, List, MoreVertical, Plus } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { SearchBox } from '@/components/layout/SearchBox'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppActions } from '@/features/workspace/appActions'
import { DueBadge, ResponseChip, STAGE_DOT, StageBadge } from '@/features/workspace/bits'
import { useCandidateIndex, useProposals, useSaveProposal } from '@/hooks/useWorkspace'
import { he } from '@/lib/strings.he'
import { PROPOSAL_STAGES, type CandidateRow, type Proposal, type ProposalStage } from '@/lib/types'
import { cn, errorMessage, fullName, normalizeSearch } from '@/lib/utils'

type View = 'board' | 'list'

function useMove() {
  const save = useSaveProposal()
  return (p: Proposal, stage: ProposalStage) => {
    if (p.stage === stage) return
    const { id, owner_id: _o, created_at: _c, updated_at: _u, ...input } = p
    save
      .mutateAsync({ id, input: { ...input, stage } })
      .then(() => toast.success(`${he.proposals.moveTo}: ${he.stage[stage]}`))
      .catch((e) => toast.error(he.common.unknownError, { description: errorMessage(e) }))
  }
}

function MoveMenu({ p, label }: { p: Proposal; label: string }) {
  const move = useMove()
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${he.proposals.moveTo} — ${label}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{he.proposals.moveTo}</DropdownMenuLabel>
        {PROPOSAL_STAGES.map((s) => (
          <DropdownMenuItem key={s} disabled={s === p.stage} onSelect={() => move(p, s)}>
            <span className={cn('size-2 rounded-full', STAGE_DOT[s])} aria-hidden />
            {he.stage[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Card({ p, m, f }: { p: Proposal; m: CandidateRow; f: CandidateRow }) {
  const actions = useAppActions()
  const label = he.proposals.pair(fullName(m), fullName(f))
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/proposal', p.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => actions.openProposal(p.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) actions.openProposal(p.id)
      }}
      tabIndex={0}
      aria-label={label}
      className="group cursor-pointer rounded-xl border border-line bg-surface p-3 shadow-card transition-[box-shadow,transform] duration-150 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[14px] font-semibold text-navy-900">
            {fullName(m)}{' '}
            <span className="tabular text-[12px] font-normal text-ink-muted">{m.age ?? ''}</span>
          </p>
          <p className="truncate text-[14px] font-semibold text-navy-900">
            {fullName(f)}{' '}
            <span className="tabular text-[12px] font-normal text-ink-muted">{f.age ?? ''}</span>
          </p>
        </div>
        <MoveMenu p={p} label={label} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <ResponseChip side="male" response={p.male_response} />
        <ResponseChip side="female" response={p.female_response} />
      </div>
      {(p.next_followup || p.notes || p.closed_reason) && (
        <div className="mt-2 space-y-1.5 border-t border-line pt-2">
          {p.next_followup && p.stage !== 'closed' && p.stage !== 'engaged' && (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-ink-muted" aria-hidden />
              <DueBadge date={p.next_followup} />
            </span>
          )}
          {(p.closed_reason || p.notes) && (
            <p className="line-clamp-2 text-[12.5px] leading-snug text-ink-muted">
              {p.closed_reason || p.notes}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

export default function ProposalsPage() {
  const proposals = useProposals()
  const { byId, isLoading } = useCandidateIndex()
  const actions = useAppActions()
  const move = useMove()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'list' ? 'list' : 'board'
  const focusStage = params.get('stage') as ProposalStage | null
  const [q, setQ] = useState('')
  const [dragOver, setDragOver] = useState<ProposalStage | null>(null)

  const items = useMemo(() => {
    const terms = normalizeSearch(q).split(' ').filter(Boolean)
    return (proposals.data ?? []).flatMap((p) => {
      const m = byId.get(p.male_id)
      const f = byId.get(p.female_id)
      if (!m || !f) return []
      if (terms.length) {
        const h = normalizeSearch(`${fullName(m)} ${fullName(f)}`)
        if (!terms.every((t) => h.includes(t))) return []
      }
      return [{ p, m, f }]
    })
  }, [proposals.data, byId, q])

  const setView = (v: View) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (v === 'board') n.delete('view')
        else n.set('view', v)
        return n
      },
      { replace: true },
    )

  const onDrop = (e: DragEvent, stage: ProposalStage) => {
    e.preventDefault()
    setDragOver(null)
    const id = e.dataTransfer.getData('text/proposal')
    const p = proposals.data?.find((x) => x.id === id)
    if (p) move(p, stage)
  }

  const loading = proposals.isPending || isLoading

  return (
    <main id="main" className="space-y-4 px-4 pb-16 pt-5 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink-muted">{he.proposals.subtitle}</p>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={setQ} className="w-56" />
          <div
            className="flex rounded-lg bg-cream-100 p-1"
            role="radiogroup"
            aria-label={he.proposals.viewMode}
          >
            {(
              [
                ['board', he.proposals.board, <Columns3 key="b" />],
                ['list', he.proposals.list, <List key="l" />],
              ] as const
            ).map(([v, label, icon]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 [&_svg]:size-4',
                  view === v
                    ? 'bg-surface text-navy-900 shadow-sm'
                    : 'text-navy-800 hover:text-navy-900',
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={() => actions.newProposal()}>
            <Plus />
            {he.proposals.new}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : items.length === 0 && !q ? (
        <div className="flex flex-col items-center rounded-xl border border-line bg-surface px-6 py-16 text-center shadow-card">
          <span className="grid size-12 place-items-center rounded-full bg-navy-50">
            <HeartHandshake className="size-6 text-navy-700" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-navy-900">{he.proposals.empty}</h2>
          <p className="mt-1.5 text-sm text-ink-muted">{he.proposals.emptyText}</p>
          <Button variant="primary" className="mt-5" onClick={() => actions.newProposal()}>
            {he.proposals.new}
          </Button>
        </div>
      ) : view === 'board' ? (
        <>
          <p className="text-[12.5px] text-ink-muted">{he.proposals.dragHint}</p>
          <div className="relative -mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
            <div className="grid min-w-[1080px] grid-cols-6 gap-3">
              {PROPOSAL_STAGES.map((s) => {
                const col = items.filter((x) => x.p.stage === s)
                return (
                  <section
                    key={s}
                    aria-label={he.stage[s]}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(s)
                    }}
                    onDragLeave={() => setDragOver((d) => (d === s ? null : d))}
                    onDrop={(e) => onDrop(e, s)}
                    className={cn(
                      'flex min-h-[18rem] flex-col rounded-xl border bg-cream-100/70 p-2 transition-colors',
                      dragOver === s ? 'border-gold-500 bg-gold-100/50' : 'border-transparent',
                      focusStage === s && 'ring-2 ring-gold-500/60',
                    )}
                  >
                    <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                      <span className={cn('size-2.5 rounded-full', STAGE_DOT[s])} aria-hidden />
                      <h2 className="font-sans text-[13.5px] font-semibold text-navy-900">
                        {he.stage[s]}
                      </h2>
                      <span className="tabular ms-auto rounded-full bg-surface px-2 text-[12px] font-semibold text-ink-muted">
                        {col.length}
                      </span>
                    </header>
                    <div className="flex flex-1 flex-col gap-2">
                      {col.map(({ p, m, f }) => (
                        <Card key={p.id} p={p} m={m} f={f} />
                      ))}
                      {col.length === 0 && (
                        <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line px-2 py-6 text-center text-[12.5px] text-ink-muted">
                          {he.proposals.emptyColumn}
                        </p>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{he.proposals.title}</caption>
            <thead>
              <tr className="text-start text-[12.5px] text-ink-muted">
                {[
                  he.proposals.male,
                  he.proposals.female,
                  he.proposals.stage,
                  he.proposals.maleResponse,
                  he.proposals.femaleResponse,
                  he.proposals.followup,
                  '',
                ].map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="h-11 border-b border-line px-4 text-start font-semibold"
                  >
                    {h || <span className="sr-only">{he.table.actions}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items
                .filter((x) => !focusStage || x.p.stage === focusStage)
                .map(({ p, m, f }) => (
                  <tr
                    key={p.id}
                    onClick={() => actions.openProposal(p.id)}
                    className="cursor-pointer transition-colors hover:bg-navy-50/55"
                  >
                    <td className="border-b border-line px-4 py-3 font-semibold text-navy-900">
                      {fullName(m)}
                    </td>
                    <td className="border-b border-line px-4 py-3 font-semibold text-navy-900">
                      {fullName(f)}
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <StageBadge stage={p.stage} />
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <ResponseChip side="male" response={p.male_response} />
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <ResponseChip side="female" response={p.female_response} />
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      {p.next_followup ? (
                        <DueBadge date={p.next_followup} />
                      ) : (
                        <span className="text-ink-muted/60">—</span>
                      )}
                    </td>
                    <td className="border-b border-line px-2 py-3 text-end">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          actions.openProposal(p.id)
                        }}
                      >
                        {he.proposals.open}
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
