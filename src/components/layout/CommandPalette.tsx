import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command as CommandPrimitive } from 'cmdk'
import {
  HeartHandshake,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DialogOverlay } from '@/components/ui/dialog'
import { useAppActions } from '@/features/workspace/appActions'
import { StageBadge } from '@/features/workspace/bits'
import { useCandidateIndex, useProposals } from '@/hooks/useWorkspace'
import { useReturnFocus } from '@/hooks/useReturnFocus'
import { he } from '@/lib/strings.he'
import { fullName } from '@/lib/utils'

const item =
  'flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[selected=true]:bg-navy-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-muted'
const group =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-muted'

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { rows, byId } = useCandidateIndex()
  const proposals = useProposals()
  const actions = useAppActions()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const focus = useReturnFocus()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) setQ('')
  }, [open])

  const run = (fn: () => void) => {
    onOpenChange(false)
    // let the palette close (and restore focus) before opening the next layer
    setTimeout(fn, 0)
  }

  const candidates = useMemo(() => (q.trim() ? rows : rows.slice(0, 6)), [rows, q])
  const props = useMemo(
    () => (q.trim() ? (proposals.data ?? []) : (proposals.data ?? []).slice(0, 4)),
    [proposals.data, q],
  )

  const pages = [
    { to: '/', label: he.nav.dashboard, icon: <LayoutDashboard /> },
    { to: '/proposals', label: he.nav.proposals, icon: <HeartHandshake /> },
    { to: '/match', label: he.nav.match, icon: <Sparkles /> },
    { to: '/ideas', label: he.nav.ideas, icon: <Lightbulb /> },
    { to: '/tasks', label: he.nav.tasks, icon: <ListChecks /> },
    { to: '/candidates?tab=male', label: he.tabs.male, icon: <UserRound /> },
    { to: '/candidates?tab=female', label: he.tabs.female, icon: <Users /> },
  ]

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          {...focus}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <DialogPrimitive.Title className="sr-only">{he.palette.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {he.palette.placeholder}
          </DialogPrimitive.Description>
          <CommandPrimitive loop>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 shrink-0 text-ink-muted" aria-hidden />
              <CommandPrimitive.Input
                value={q}
                onValueChange={setQ}
                placeholder={he.palette.placeholder}
                className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-ink-muted/70"
              />
            </div>
            <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
              <CommandPrimitive.Empty className="py-10 text-center text-sm text-ink-muted">
                {he.palette.empty}
              </CommandPrimitive.Empty>
              <CommandPrimitive.Group heading={he.palette.candidates} className={group}>
                {candidates.map((c) => (
                  <CommandPrimitive.Item
                    key={c.id}
                    value={`c:${c.id}`}
                    keywords={[fullName(c), c.city ?? '', c.institution ?? '']}
                    onSelect={() => run(() => actions.openCandidate(c.id))}
                    className={item}
                  >
                    {c.gender === 'male' ? <UserRound /> : <Users />}
                    <span className="flex-1 truncate">{fullName(c)}</span>
                    <span className="tabular text-xs text-ink-muted">
                      {[c.age, c.city].filter((x) => x !== null && x !== '').join(' · ')}
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
              {props.length > 0 && (
                <CommandPrimitive.Group heading={he.palette.proposals} className={group}>
                  {props.map((p) => {
                    const m = byId.get(p.male_id)
                    const f = byId.get(p.female_id)
                    if (!m || !f) return null
                    return (
                      <CommandPrimitive.Item
                        key={p.id}
                        value={`p:${p.id}`}
                        keywords={[fullName(m), fullName(f), he.stage[p.stage]]}
                        onSelect={() => run(() => actions.openProposal(p.id))}
                        className={item}
                      >
                        <HeartHandshake />
                        <span className="flex-1 truncate">
                          {he.proposals.pair(fullName(m), fullName(f))}
                        </span>
                        <StageBadge stage={p.stage} />
                      </CommandPrimitive.Item>
                    )
                  })}
                </CommandPrimitive.Group>
              )}
              <CommandPrimitive.Group heading={he.palette.actions} className={group}>
                <CommandPrimitive.Item
                  value="a:new-candidate"
                  keywords={[he.palette.newCandidate]}
                  onSelect={() => run(() => actions.newCandidate())}
                  className={item}
                >
                  <Plus />
                  {he.palette.newCandidate}
                </CommandPrimitive.Item>
                <CommandPrimitive.Item
                  value="a:new-proposal"
                  keywords={[he.palette.newProposal]}
                  onSelect={() => run(() => actions.newProposal())}
                  className={item}
                >
                  <HeartHandshake />
                  {he.palette.newProposal}
                </CommandPrimitive.Item>
                {pages.map((pg) => (
                  <CommandPrimitive.Item
                    key={pg.to}
                    value={`nav:${pg.to}`}
                    keywords={[pg.label]}
                    onSelect={() => run(() => navigate(pg.to))}
                    className={item}
                  >
                    {pg.icon}
                    {pg.label}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            </CommandPrimitive.List>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
