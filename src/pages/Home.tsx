import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  HeartHandshake,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppActions } from '@/features/workspace/appActions'
import {
  Checkbox,
  DueBadge,
  STAGE_DOT,
  StageBadge,
  daysFromToday,
  relativeTime,
  todayIso,
} from '@/features/workspace/bits'
import {
  useCandidateIndex,
  useProposals,
  useRecentEvents,
  useSaveTask,
  useTasks,
} from '@/hooks/useWorkspace'
import { useAuth } from '@/lib/auth'
import { gregorianToHebrew } from '@/lib/hebrewDate'
import { he } from '@/lib/strings.he'
import { ACTIVE_STAGES, PROPOSAL_STAGES, type ProposalEvent } from '@/lib/types'
import { cn, fullName } from '@/lib/utils'

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-line bg-surface shadow-card',
        className,
      )}
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 className="text-[17px] font-bold text-navy-900">{title}</h2>
        {action}
      </header>
      <div className="min-h-0 flex-1 p-5">{children}</div>
    </section>
  )
}

function Kpi({
  label,
  value,
  note,
  icon,
  to,
}: {
  label: string
  value: number | null
  note?: string
  icon: ReactNode
  to: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-800 [&_svg]:size-5"
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-ink-muted">{label}</span>
        {value === null ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <span className="tabular block font-heading text-[28px] font-bold leading-tight text-navy-900">
            {value}
          </span>
        )}
        {note && <span className="block text-[12px] text-ink-muted">{note}</span>}
      </span>
    </Link>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const { rows, byId, isLoading } = useCandidateIndex()
  const proposals = useProposals()
  const tasks = useTasks()
  const events = useRecentEvents()
  const saveTask = useSaveTask()
  const actions = useAppActions()

  const now = new Date()
  const hebToday = gregorianToHebrew(todayIso())
  const name = user?.fullName || user?.email.split('@')[0] || ''

  const all = proposals.data ?? []
  const activeCandidates = rows.filter(
    (r) => r.status === 'active' || r.status === 'in_process',
  ).length
  const active = all.filter((p) => ACTIVE_STAGES.includes(p.stage))
  const inProgress = all.filter((p) => p.stage === 'checking' || p.stage === 'meeting').length
  const engaged = all.filter((p) => p.stage === 'engaged').length
  const perStage = PROPOSAL_STAGES.map((s) => ({ s, n: all.filter((p) => p.stage === s).length }))
  const maxStage = Math.max(1, ...perStage.map((x) => x.n))

  const dueTasks = (tasks.data ?? []).filter(
    (t) => !t.done && t.due_date && daysFromToday(t.due_date) <= 0,
  )
  const dueFollowups = active.filter((p) => p.next_followup && daysFromToday(p.next_followup) <= 0)

  const busy = new Set(active.flatMap((p) => [p.male_id, p.female_id]))
  const waiting = rows.filter((r) => r.status === 'active' && !busy.has(r.id)).slice(0, 6)

  const describe = (e: ProposalEvent) => {
    const p = all.find((x) => x.id === e.proposal_id)
    const m = p && byId.get(p.male_id)
    const f = p && byId.get(p.female_id)
    const pair = m && f ? he.proposals.pair(fullName(m), fullName(f)) : ''
    const what =
      e.kind === 'created'
        ? he.proposals.eventCreated
        : e.kind === 'stage'
          ? he.proposals.eventStage(
              he.stage[e.from_stage ?? 'idea'],
              he.stage[e.to_stage ?? 'idea'],
            )
          : e.kind === 'response'
            ? he.proposals.eventResponse(
                e.side === 'female' ? 'בחורה' : 'בחור',
                he.response[e.response ?? 'pending'],
              )
            : e.text
    return { pair, what, p }
  }

  return (
    <main id="main" className="space-y-6 px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">
            יום {WEEKDAYS[now.getDay()]} · {hebToday} ·{' '}
            <span className="tabular">{now.toLocaleDateString('he-IL')}</span>
          </p>
          <h2 className="mt-1 text-3xl font-bold text-navy-900">{he.dashboard.title(name)}</h2>
          <p className="mt-0.5 text-ink-muted">{he.dashboard.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => actions.newProposal()}>
            <HeartHandshake />
            {he.proposals.new}
          </Button>
          <Button variant="primary" asChild>
            <Link to="/match">
              <Sparkles />
              {he.nav.match}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          to="/candidates"
          label={he.dashboard.activeCandidates}
          value={isLoading ? null : activeCandidates}
          note={he.dashboard.ofTotal(rows.length)}
          icon={<Users />}
        />
        <Kpi
          to="/proposals"
          label={he.dashboard.activeProposals}
          value={proposals.isPending ? null : active.length}
          icon={<HeartHandshake />}
        />
        <Kpi
          to="/proposals"
          label={he.dashboard.inProgress}
          value={proposals.isPending ? null : inProgress}
          icon={<MessageSquare />}
        />
        <Kpi
          to="/proposals"
          label={he.dashboard.engaged}
          value={proposals.isPending ? null : engaged}
          note={he.dashboard.engagedNote}
          icon={<CheckCircle2 />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Panel
          title={he.dashboard.today}
          action={
            <Button variant="link" asChild>
              <Link to="/tasks">
                {he.dashboard.viewAll}
                <ArrowLeft className="!size-3.5" />
              </Link>
            </Button>
          }
        >
          {tasks.isPending || proposals.isPending ? (
            <Skeleton className="h-28" />
          ) : dueTasks.length + dueFollowups.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-ink-muted">
              <CheckCircle2 className="size-5 text-success" aria-hidden />
              {he.dashboard.nothingToday}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {dueFollowups.map((p) => {
                const m = byId.get(p.male_id)
                const f = byId.get(p.female_id)
                return (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <CalendarClock className="size-5 shrink-0 text-gold-700" aria-hidden />
                    <button
                      type="button"
                      onClick={() => actions.openProposal(p.id)}
                      className="min-w-0 flex-1 truncate text-start text-[14.5px] font-medium text-navy-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                    >
                      {he.proposals.followup}:{' '}
                      {m && f ? he.proposals.pair(fullName(m), fullName(f)) : ''}
                    </button>
                    <StageBadge stage={p.stage} />
                    <DueBadge date={p.next_followup} />
                  </li>
                )
              })}
              {dueTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <Checkbox
                    checked={t.done}
                    label={he.tasks.markDone}
                    onChange={(done) => {
                      const { id, created_at: _c, updated_at: _u, ...input } = t
                      void saveTask.mutateAsync({ id, input: { ...input, done } })
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[14.5px]">{t.title}</span>
                  {t.candidate_id && byId.get(t.candidate_id) && (
                    <button
                      type="button"
                      onClick={() => actions.openCandidate(t.candidate_id!)}
                      className="hidden truncate text-[13px] text-navy-700 hover:underline sm:inline"
                    >
                      {fullName(byId.get(t.candidate_id)!)}
                    </button>
                  )}
                  <DueBadge date={t.due_date} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={he.dashboard.pipeline}
          action={
            <Button variant="link" asChild>
              <Link to="/proposals">
                {he.nav.proposals}
                <ArrowLeft className="!size-3.5" />
              </Link>
            </Button>
          }
        >
          {proposals.isPending ? (
            <Skeleton className="h-40" />
          ) : (
            <ul className="space-y-2.5">
              {perStage.map(({ s, n }) => (
                <li key={s}>
                  <Link
                    to={`/proposals?stage=${s}`}
                    className="group grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    <span className="text-[13.5px] text-ink group-hover:text-navy-900">
                      {he.stage[s]}
                    </span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-cream-100">
                      <span
                        className={cn(
                          'block h-full rounded-full transition-[width] duration-500',
                          STAGE_DOT[s],
                        )}
                        style={{ width: `${(n / maxStage) * 100}%` }}
                      />
                    </span>
                    <span className="tabular text-end text-[13.5px] font-semibold text-navy-900">
                      {n}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.25fr]">
        <Panel title={he.dashboard.waiting}>
          <p className="-mt-1 mb-3 text-[13px] text-ink-muted">{he.dashboard.waitingText}</p>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <ul className="divide-y divide-line">
              {waiting.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => actions.openCandidate(c.id)}
                    className="min-w-0 flex-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    <span className="block truncate font-medium text-navy-900 hover:underline">
                      {fullName(c)}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-muted">
                      {[c.gender === 'male' ? 'בחור' : 'בחורה', c.age, c.city]
                        .filter((x) => x !== null && x !== '')
                        .join(' · ')}
                    </span>
                  </button>
                  <Button size="sm" variant="subtle" asChild>
                    <Link to={`/match?for=${c.id}`}>
                      <Sparkles />
                      {he.dashboard.suggestFor}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={he.dashboard.activity}>
          {events.isPending ? (
            <Skeleton className="h-32" />
          ) : !events.data?.length ? (
            <p className="py-6 text-ink-muted">{he.dashboard.noActivity}</p>
          ) : (
            <ol className="space-y-3">
              {events.data.map((e) => {
                const d = describe(e)
                return (
                  <li key={e.id} className="flex gap-3">
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        e.kind === 'note'
                          ? 'bg-gold-500'
                          : e.to_stage === 'engaged'
                            ? 'bg-success'
                            : 'bg-navy-700',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      {d.p ? (
                        <button
                          type="button"
                          onClick={() => actions.openProposal(d.p!.id)}
                          className="truncate text-start text-[14px] font-medium text-navy-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                        >
                          {d.pair}
                        </button>
                      ) : null}
                      <p className="text-[13.5px] text-ink-muted">{d.what}</p>
                    </div>
                    <span className="tabular shrink-0 text-[12px] text-ink-muted">
                      {relativeTime(e.created_at)}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </Panel>
      </div>
    </main>
  )
}
