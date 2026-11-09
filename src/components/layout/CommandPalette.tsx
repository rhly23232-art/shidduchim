import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command as CommandPrimitive } from 'cmdk'
import { FileStack, FileText, Lightbulb, Plus, Search, UserRound, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DialogOverlay } from '@/components/ui/dialog'
import { useAppActions } from '@/features/workspace/appActions'
import { useCandidateIndex } from '@/hooks/useWorkspace'
import { useReturnFocus } from '@/hooks/useReturnFocus'
import { he } from '@/lib/strings.he'
import { fullName } from '@/lib/utils'

const item =
  'flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-3 text-body outline-none data-[selected=true]:bg-secondary [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'
const group =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground'

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { rows } = useCandidateIndex()
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

  const pages = [
    { to: '/candidates?tab=male', label: he.tabs.male, icon: <UserRound /> },
    { to: '/candidates?tab=female', label: he.tabs.female, icon: <Users /> },
    { to: '/ideas', label: he.nav.ideas, icon: <Lightbulb /> },
    { to: '/documents', label: he.nav.documents, icon: <FileText /> },
    { to: '/resume-table', label: he.nav.resumeTable, icon: <FileStack /> },
  ]

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          {...focus}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-card shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <DialogPrimitive.Title className="sr-only">{he.palette.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {he.palette.placeholder}
          </DialogPrimitive.Description>
          <CommandPrimitive loop>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <CommandPrimitive.Input
                value={q}
                onValueChange={setQ}
                placeholder={he.palette.placeholder}
                className="h-14 w-full bg-transparent text-body-lg outline-none"
              />
            </div>
            <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
              <CommandPrimitive.Empty className="py-10 text-center text-body text-muted-foreground">
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
                    <span className="tabular text-caption text-muted-foreground">
                      {[c.age, c.city].filter((x) => x !== null && x !== '').join(' · ')}
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
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
