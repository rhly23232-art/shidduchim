import { motion } from 'framer-motion'
import { House, Lightbulb, Search, UserRound, Users, UsersRound } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { useAppActions } from '@/features/workspace/appActions'
import { useCandidateIndex } from '@/hooks/useWorkspace'
import { he } from '@/lib/strings.he'
import { cn, fullName, hebrewCollator, normalizeSearch } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { Logo, LogoMark } from './Logo'

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
  collapsed,
}: {
  collapsed?: boolean
  to: string
  icon: ReactNode
  label: string
  badge?: number
  badgeTone?: 'navy' | 'danger' | 'gold'
  end?: boolean
  active?: boolean
  onNavigate?: () => void
}) {
  const link = (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      aria-label={collapsed ? (badge ? `${label} (${badge})` : label) : undefined}
      className={({ isActive }) => {
        const on = active ?? isActive
        return cn(
          'group relative flex h-10 items-center gap-3 rounded-lg text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
          collapsed ? 'justify-center px-0' : 'px-3',
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
            {!collapsed && <span className="relative z-10 flex-1 truncate">{label}</span>}
            {collapsed && badge !== undefined && badge > 0 && (
              <span
                className="tabular absolute -top-0.5 end-1 z-10 min-w-[1.05rem] rounded-full bg-gold-500 px-1 text-center text-[10px] font-bold leading-4 text-navy-900"
                aria-hidden
              >
                {badge}
              </span>
            )}
            {!collapsed && badge !== undefined && badge > 0 && (
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
  return collapsed ? (
    <Tooltip content={label} side="left">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

export function Sidebar({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const { rows } = useCandidateIndex()
  const actions = useAppActions()
  const location = useLocation()
  const [params] = useSearchParams()
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const terms = normalizeSearch(q).split(' ').filter(Boolean)
    return rows
      .filter((r) => {
        if (!terms.length) return true
        const h = normalizeSearch(`${fullName(r)} ${r.city ?? ''}`)
        return terms.every((t) => h.includes(t))
      })
      .sort((a, b) => hebrewCollator.compare(fullName(a), fullName(b)))
  }, [rows, q])
  const shown = list.slice(0, 300)
  const onCandidates = location.pathname === '/candidates'
  const tabParam = params.get('tab')
  const tab = tabParam === 'female' || tabParam === 'all' ? tabParam : 'male'

  return (
    <nav aria-label={he.nav.main} className="flex h-full flex-col bg-navy-900 text-surface">
      <div
        className={cn(
          'flex items-center gap-2 pb-4 pt-5',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        {collapsed ? (
          <LogoMark className="size-10" />
        ) : (
          <div className="rounded-xl bg-surface px-2.5 py-2">
            <Logo />
          </div>
        )}
      </div>
      <div className={cn('space-y-5', collapsed ? 'px-2' : 'px-3')}>
        <NavItem
          to="/"
          end
          icon={<House />}
          label={he.nav.home}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />
        <div>
          {collapsed ? (
            <div className="mx-2 mb-2 h-px bg-surface/10" aria-hidden />
          ) : (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-200/70">
              {he.nav.sectionPool}
            </p>
          )}
          <div className="space-y-0.5">
            <NavItem
              to="/candidates?tab=male"
              icon={<UserRound />}
              label={he.nav.males}
              active={onCandidates && tab === 'male'}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
            <NavItem
              to="/candidates?tab=female"
              icon={<Users />}
              label={he.nav.females}
              active={onCandidates && tab === 'female'}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
            <NavItem
              to="/candidates?tab=all"
              icon={<UsersRound />}
              label={he.tabs.allTitle}
              active={onCandidates && tab === 'all'}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          </div>
        </div>
        <div>
          {collapsed ? (
            <div className="mx-2 mb-2 h-px bg-surface/10" aria-hidden />
          ) : (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-200/70">
              {he.nav.sectionWork}
            </p>
          )}
          <NavItem
            to="/ideas"
            icon={<Lightbulb />}
            label={he.nav.ideas}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        </div>
      </div>

      {/* All candidates — quick access list (hidden in the icon rail) */}
      {!collapsed && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-surface/10 px-3 pt-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-200/70">
              {he.nav.candidates}
            </p>
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
      )}
    </nav>
  )
}
