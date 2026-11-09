import { useQueryClient } from '@tanstack/react-query'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { CandidateDetailModal } from '@/features/candidates/CandidateDetailModal'
import { CandidateForm, type FormSuggestions } from '@/features/candidates/CandidateForm'
import { ResumeViewer } from '@/features/resumes/ResumeViewer'
import {
  AppActionsContext,
  type AppActions,
  type NewProposalPrefill,
} from '@/features/workspace/appActions'
import { NewProposalDialog } from '@/features/workspace/NewProposalDialog'
import { ProposalDrawer } from '@/features/workspace/ProposalDrawer'
import { qk, useDeleteCandidate } from '@/hooks/useCandidates'
import { useOverlayParam } from '@/hooks/useOverlayParam'
import { useCandidateIndex, wk } from '@/hooks/useWorkspace'
import { dataApi } from '@/lib/api'
import { hostDownloads, hostMcp } from '@/lib/hostBridge'
import { he } from '@/lib/strings.he'
import type { CandidateFull, CandidateRow, Gender } from '@/lib/types'
import { errorMessage, fullName, hebrewCollator } from '@/lib/utils'
import { CommandPalette } from './CommandPalette'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

const uniqSorted = (values: (string | null)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].sort(hebrewCollator.compare)

function usePageTitle(): string {
  const { pathname, search } = useLocation()
  if (pathname.startsWith('/proposals')) return he.nav.proposals
  if (pathname.startsWith('/match')) return he.nav.match
  if (pathname.startsWith('/ideas')) return he.nav.ideas
  if (pathname.startsWith('/tasks')) return he.nav.tasks
  if (pathname.startsWith('/candidates'))
    return new URLSearchParams(search).get('tab') === 'female' ? he.tabs.female : he.tabs.male
  return he.nav.dashboard
}

export function AppShell() {
  const qc = useQueryClient()
  const location = useLocation()
  const { rows, byId } = useCandidateIndex()
  const [candidateId, openCandidateParam, closeCandidate] = useOverlayParam('c')
  const [proposalId, openProposalParam, closeProposal] = useOverlayParam('p')
  const [form, setForm] = useState<{
    open: boolean
    candidate: CandidateFull | null
    gender: Gender
  }>({
    open: false,
    candidate: null,
    gender: 'male',
  })
  const [toDelete, setToDelete] = useState<CandidateRow | null>(null)
  const [newProposal, setNewProposal] = useState<NewProposalPrefill | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const del = useDeleteCandidate()
  const title = usePageTitle()

  // Warm up host capabilities early so the first click is instant (no-ops outside claude.ai).
  useEffect(() => {
    void hostDownloads()
    void hostMcp()
  }, [])

  // Close the mobile drawer on navigation.
  useEffect(() => setNavOpen(false), [location.pathname])

  const currentTab: Gender =
    new URLSearchParams(location.search).get('tab') === 'female' ? 'female' : 'male'

  const editCandidate = useCallback(
    async (c: CandidateFull | CandidateRow) => {
      try {
        const full =
          'in_laws' in c
            ? c
            : await qc.fetchQuery({
                queryKey: qk.detail(c.id),
                queryFn: () => dataApi.getCandidate(c.id),
              })
        if (!full) throw new Error(he.detail.notFound)
        setForm({ open: true, candidate: full, gender: full.gender })
      } catch (e) {
        toast.error(he.table.errorTitle, { description: errorMessage(e) })
      }
    },
    [qc],
  )

  const actions = useMemo<AppActions>(
    () => ({
      openCandidate: openCandidateParam,
      newCandidate: (g) => setForm({ open: true, candidate: null, gender: g ?? currentTab }),
      editCandidate: (c) => void editCandidate(c),
      deleteCandidate: setToDelete,
      openProposal: openProposalParam,
      newProposal: (prefill) => setNewProposal(prefill ?? {}),
      openPalette: () => setPaletteOpen(true),
    }),
    [openCandidateParam, openProposalParam, editCandidate, currentTab],
  )

  const preview = candidateId ? (byId.get(candidateId) ?? null) : null

  const suggestions = useMemo<FormSuggestions>(
    () => ({
      cities: uniqSorted(rows.map((r) => r.city)),
      regions: uniqSorted(rows.map((r) => r.region)),
      communities: uniqSorted(rows.map((r) => r.community)),
      chassidut: uniqSorted(rows.map((r) => r.chassidut)),
      institutionsMale: uniqSorted(
        rows.filter((r) => r.gender === 'male').map((r) => r.institution),
      ),
      institutionsFemale: uniqSorted(
        rows.filter((r) => r.gender === 'female').map((r) => r.institution),
      ),
    }),
    [rows],
  )

  const confirmDelete = async () => {
    const target = toDelete
    if (!target) return
    setToDelete(null)
    try {
      await del.mutateAsync(target.id)
      if (candidateId === target.id) closeCandidate()
      await Promise.all([
        qc.invalidateQueries({ queryKey: wk.proposals }),
        qc.invalidateQueries({ queryKey: wk.ideas }),
        qc.invalidateQueries({ queryKey: wk.tasks }),
      ])
      toast.success(he.form.deleted(fullName(target)))
    } catch (e) {
      toast.error(he.form.deleteFailed, { description: errorMessage(e) })
    }
  }

  return (
    <AppActionsContext.Provider value={actions}>
      <div className="min-h-[100dvh] lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-surface"
        >
          {he.app.skipToContent}
        </a>
        <aside className="sticky top-0 hidden h-[100dvh] lg:block">
          <Sidebar />
        </aside>
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent
            side="start"
            className="max-w-[300px] border-0 p-0 [&>button]:text-surface [&>button]:hover:bg-surface/10 [&>button]:hover:text-surface"
          >
            <SheetTitle className="sr-only">{he.nav.main}</SheetTitle>
            <SheetDescription className="sr-only">{he.nav.main}</SheetDescription>
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="min-w-0">
          <Header
            title={title}
            onMenu={() => setNavOpen(true)}
            onSearch={() => setPaletteOpen(true)}
            onAdd={() => actions.newCandidate()}
          />
          <Suspense
            fallback={
              <div className="space-y-3 px-4 pt-6 md:px-6" aria-busy>
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-64" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </div>

      <CandidateDetailModal
        id={candidateId}
        preview={preview}
        onClose={closeCandidate}
        onEdit={(c) => void editCandidate(c)}
        onDelete={setToDelete}
      />
      <CandidateForm
        open={form.open}
        candidate={form.candidate}
        defaultGender={form.gender}
        suggestions={suggestions}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={(id, _g, created) => created && openCandidateParam(id)}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete ? he.form.deleteTitle(fullName(toDelete)) : ''}
        description={he.form.deleteText}
        confirmLabel={he.form.deleteConfirm}
        destructive
        onConfirm={() => void confirmDelete()}
      />
      <ProposalDrawer id={proposalId} onClose={closeProposal} />
      <NewProposalDialog
        prefill={newProposal}
        onClose={() => setNewProposal(null)}
        onCreated={(id) => {
          setNewProposal(null)
          openProposalParam(id)
        }}
      />
      <ResumeViewer />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </AppActionsContext.Provider>
  )
}
