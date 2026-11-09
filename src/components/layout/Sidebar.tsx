import { motion } from 'framer-motion'
import { Lightbulb, Search, UserRound, Users } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { useAppActions } from '@/features/workspace/appActions'
import { useCandidateIndex, useIdeas } from '@/hooks/useWorkspace'
import { he } from '@/lib/strings.he'
import type { Gender } from '@/lib/types'
import { cn, fullName, hebrewCollator, normalizeSearch } from '@/lib/utils'
import { Logo } from './Logo'

const STATUS_DOT = {
  active: 'bg-success',
  in_process: 'bg-gold-500',
  engaged: 'bg-navy-700',
  paused: 'bg-navy-200',
} as const

function NavItem({
  to,
  icon,
  label,
  badge,
  badgeTone,
  end,
  active,
  onNavigate,
}: {
  to: string
  icon: ReactNode
  label: string
  badge?: number
  badgeTone?: 'navy' | 'danger' | 'gold'
  end?: boolean
  active?: boolean
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => {
        const on = active ?? isActive
        return cn(
          'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
          on ? 'text-surface' : 'text-navy-100/85 hover:bg-surface/[0.06] hover:text-surface',
        )
      }}
    >
      {({ isActive }) => {
        const on = active ?? isActive
        return (
          <>
            {on && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 -z-0 rounded-lg bg-surface/[0.11] [box-shadow:inset_-3px_0_0_hsl(var(--gold-500))]"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10 [&_svg]:size-[18px]" aria-hidden>
              {icon}
            </span>
            <span className="relative z-10 flex-1 truncate">{label}</span>
            {badge !== undefined && badge > 0 && (
              <span
                className={cn(
                  'tabular relative z-10 min-w-6 rounded-full px-1.5 text-center text-[11.5px] font-semibold leading-5',
                  badgeTone === 'danger'
                    ? 'bg-danger text-surface'
                    : badgeTone === 'gold'
                      ? 'bg-gold-500 text-navy-900'
                      : 'bg-surface/15 text-surface',
                )}
              >
                {badge}
              </span>
            )}
          </>
        )
      }}
    </NavLink>
  )
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { rows } = useCandidateIndex()
  const ideas = useIdeas()
  const actions = useAppActions()
  const location = useLocation()
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [g, setG] = useState<Gender | 'all'>('all')

  const counts = useMemo(() => {
    let male = 0
    for (const r of rows) if (r.gender === 'male') male++
    return { male, female: rows.length - male }
  }, [rows])
  const openIdeas = ideas.data?.filter((i) => !i.done).length ?? 0

  const list = useMemo(() => {
    const terms = normalizeSearch(q).split(' ').filter(Boolean)
    return rows
      .filter((r) => g === 'all' || r.gender === g)
      .filter((r) => {
        if (!terms.length) return true
        const h = normalizeSearch(`${fullName(r)} ${r.city ?? ''}`)
        return terms.every((t) => h.includes(t))
      })
      .sort((a, b) => hebrewCollator.compare(fullName(a), fullName(b)))
  }, [rows, q, g])
  const shown = list.slice(0, 300)
  const onCandidates = location.pathname === '/candidates'
  const tab = params.get('tab') === 'female' ? 'female' : 'male'

  return (
    <nav aria-label={he.nav.main} className="flex h-full flex-col bg-navy-900 text-surface">
      <div className="flex items-center gap-2 px-4 pb-4 pt-5">
        <div className="rounded-xl bg-surface px-2.5 py-2">
          <Logo />
        </div>
      </div>
      <div className="space-y-5 px-3">
        <div>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-200/70">
            {he.nav.sectionPool}
          </p>
          <div className="space-y-0.5">
            <NavItem
              to="/candidates?tab=male"
              icon={<UserRound />}
              label={he.nav.males}
              badge={counts.male}
              active={onCandidates && tab === 'male'}
              onNavigate={onNavigate}
            />
            <NavItem
              to="/candidates?tab=female"
              icon={<Users />}
              label={he.nav.females}
              badge={counts.female}
              active={onCandidates && tab === 'female'}
              onNavigate={onNavigate}
            />
          </div>
        </div>
        <div>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-200/70">
            {he.nav.sectionWork}
          </p>
          <NavItem
            to="/ideas"
            icon={<Lightbulb />}
            label={he.nav.ideas}
            badge={openIdeas}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* All candidates — quick access list */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-surface/10 px-3 pt-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-200/70">
            {he.nav.candidates}
          </p>
          <div
            className="flex rounded-md bg-surface/[0.07] p-0.5 text-[11.5px]"
            role="radiogroup"
            aria-label={he.tabs.ariaLabel}
          >
            {(['all', 'male', 'female'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={g === k}
                onClick={() => setG(k)}
                className={cn(
                  'rounded px-2 py-0.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
                  g === k ? 'bg-surface text-navy-900' : 'text-navy-100/80 hover:text-surface',
                )}
              >
                {k === 'all' ? he.nav.all : k === 'male' ? he.nav.males : he.nav.females}
              </button>
            ))}
          </div>
        </div>
        <div className="relative px-1 pb-2">
          <Search
            className="pointer-events-none absolute start-3.5 top-[9px] size-3.5 text-navy-200/70"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={he.nav.quickFind}
            aria-label={he.nav.quickFind}
            className="h-8 w-full rounded-lg border border-surface/10 bg-surface/[0.06] pe-2 ps-8 text-[13px] text-surface placeholder:text-navy-200/60 focus-visible:border-gold-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold-500 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-3 [scrollbar-color:hsl(var(--navy-700))_transparent] [scrollbar-width:thin]">
          {shown.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  actions.openCandidate(r.id)
                  onNavigate?.()
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-start transition-colors hover:bg-surface/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[r.status])}
                  title={he.status[r.status]}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-navy-50">
                  {fullName(r)}
                </span>
                <span className="tabular shrink-0 text-[11.5px] text-navy-200/70">
                  {r.gender === 'male' ? 'בחור' : 'בחורה'}
                  {r.age !== null ? ` · ${r.age}` : ''}
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="px-2.5 py-3 text-[13px] text-navy-200/70">{he.filters.noOptions}</li>
          )}
          {list.length > shown.length && (
            <li className="px-2.5 py-2 text-[12px] text-navy-200/70">
              {he.filters.results(shown.length, list.length)}
            </li>
          )}
        </ul>
      </div>
    </nav>
  )
}
