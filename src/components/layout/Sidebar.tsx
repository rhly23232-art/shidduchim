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
  in_process: 'bg-warning-dot',
  engaged: 'bg-info',
  paused: 'bg-input-hover',
} as const

function NavItem({
  to,
  icon,
  label,
  end,
  active,
  onNavigate,
  collapsed,
}: {
  collapsed?: boolean
  to: string
  icon: ReactNode
  label: string
  end?: boolean
  active?: boolean
  onNavigate?: () => void
}) {
  const link = (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      aria-label={collapsed ? label : undefined}
      aria-current={active === undefined ? undefined : active ? 'page' : false}
      className={({ isActive }) => {
        const on = active ?? isActive
        return cn(
          'group relative flex h-10 items-center gap-3 rounded-md text-body font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed ? 'justify-center px-0' : 'px-3',
          on
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )
      }}
    >
      {({ isActive }) => {
        const on = active ?? isActive
        return (
          <>
            {on && (
              <span
                className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-brand"
                aria-hidden
              />
            )}
            <span className="[&_svg]:size-[18px]" aria-hidden>
              {icon}
            </span>
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
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

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: string }) {
  return collapsed ? (
    <div className="mx-2 mb-2 h-px bg-border" aria-hidden />
  ) : (
    <p className="px-3 pb-2 text-caption font-medium text-muted-foreground">{children}</p>
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
    <nav
      aria-label={he.nav.main}
      className="flex h-full flex-col border-e border-border bg-card text-foreground"
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center',
          collapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        {collapsed ? <LogoMark className="size-9" /> : <Logo />}
      </div>
      <div className={cn('space-y-6 pt-2', collapsed ? 'px-3' : 'px-3')}>
        <NavItem
          to="/"
          end
          icon={<House />}
          label={he.nav.home}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />
        <div>
          <SectionLabel collapsed={collapsed}>{he.nav.sectionPool}</SectionLabel>
          <div className="space-y-1">
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
          <SectionLabel collapsed={collapsed}>{he.nav.sectionWork}</SectionLabel>
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
        <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-border px-3 pt-4">
          <p className="px-3 pb-2 text-caption font-medium text-muted-foreground">
            {he.nav.candidates}
          </p>
          <div className="relative pb-2">
            <Search
              className="pointer-events-none absolute start-3 top-2 size-4 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={he.nav.quickFind}
              aria-label={he.nav.quickFind}
              className="h-8 w-full rounded-md border border-input bg-card pe-2 ps-8 text-body-sm text-foreground transition-colors duration-fast hover:border-input-hover focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0"
            />
          </div>
          <ul className="scroll-thin -mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-3">
            {shown.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    actions.openCandidate(r.id)
                    onNavigate?.()
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-start transition-colors duration-fast hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[r.status])}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">
                    {fullName(r)}
                    <span className="sr-only"> — {he.status[r.status]}</span>
                  </span>
                  <span className="tabular shrink-0 text-caption text-muted-foreground">
                    {r.gender === 'male' ? 'בחור' : 'בחורה'}
                    {r.age !== null ? ` · ${r.age}` : ''}
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="px-3 py-3 text-body-sm text-muted-foreground">
                {he.filters.noOptions}
              </li>
            )}
            {list.length > shown.length && (
              <li className="px-3 py-2 text-caption text-muted-foreground">
                {he.filters.results(shown.length, list.length)}
              </li>
            )}
          </ul>
        </div>
      )}
    </nav>
  )
}
