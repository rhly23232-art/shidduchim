import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/Header'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { CandidateDetailModal } from '@/features/candidates/CandidateDetailModal'
import { CandidateForm, type FormSuggestions } from '@/features/candidates/CandidateForm'
import { CandidatesTable } from '@/features/candidates/CandidatesTable'
import { CANDIDATES_PANEL_ID, FilterBar, tabId } from '@/features/candidates/FilterBar'
import { qk, useCandidateDataset, useDeleteCandidate } from '@/hooks/useCandidates'
import { useFilters } from '@/hooks/useFilters'
import { dataApi } from '@/lib/api'
import { he } from '@/lib/strings.he'
import type { CandidateFull, CandidateRow, Gender } from '@/lib/types'
import { errorMessage, fullName, hebrewCollator } from '@/lib/utils'

interface FormState {
  open: boolean
  candidate: CandidateFull | null
}

const uniqSorted = (values: (string | null)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].sort(hebrewCollator.compare)

export default function Dashboard() {
  const filtersApi = useFilters()
  const { gender, filters, sort, openId, activeCount } = filtersApi
  const data = useCandidateDataset(gender, filters, sort)
  const qc = useQueryClient()
  const del = useDeleteCandidate()
  const [form, setForm] = useState<FormState>({ open: false, candidate: null })
  const [toDelete, setToDelete] = useState<CandidateRow | null>(null)

  // All cached rows (both genders) → instant modal paint + form suggestions.
  const cachedAll = qc.getQueryData<{ rows: CandidateRow[] }>(qk.list)?.rows
  const preview = useMemo(
    () =>
      openId
        ? (data.rows.find((r) => r.id === openId) ??
          cachedAll?.find((r) => r.id === openId) ??
          null)
        : null,
    [openId, data.rows, cachedAll],
  )

  const suggestions = useMemo<FormSuggestions>(() => {
    const rows = cachedAll ?? data.rows
    return {
      cities: uniqSorted([...rows.map((r) => r.city), ...data.facets.cities]),
      regions: uniqSorted([...rows.map((r) => r.region), ...data.facets.regions]),
      communities: uniqSorted([...rows.map((r) => r.community), ...data.facets.communities]),
      chassidut: uniqSorted(rows.map((r) => r.chassidut)),
      institutionsMale: uniqSorted(
        rows.filter((r) => r.gender === 'male').map((r) => r.institution),
      ),
      institutionsFemale: uniqSorted(
        rows.filter((r) => r.gender === 'female').map((r) => r.institution),
      ),
    }
  }, [cachedAll, data.rows, data.facets])

  const openCreate = useCallback(() => setForm({ open: true, candidate: null }), [])
  const openEditFull = useCallback((c: CandidateFull) => setForm({ open: true, candidate: c }), [])
  const openEditRow = useCallback(
    async (r: CandidateRow) => {
      try {
        const full = await qc.fetchQuery({
          queryKey: qk.detail(r.id),
          queryFn: () => dataApi.getCandidate(r.id),
        })
        if (!full) throw new Error(he.detail.notFound)
        setForm({ open: true, candidate: full })
      } catch (e) {
        toast.error(he.table.errorTitle, { description: errorMessage(e) })
      }
    },
    [qc],
  )

  const onSaved = useCallback(
    (id: string, g: Gender, created: boolean) => {
      if (created || g !== gender) filtersApi.showCandidate(id, g)
    },
    [filtersApi, gender],
  )

  const confirmDelete = async () => {
    const target = toDelete
    if (!target) return
    setToDelete(null)
    try {
      await del.mutateAsync(target.id)
      if (openId === target.id) filtersApi.closeCandidate()
      toast.success(he.form.deleted(fullName(target)))
    } catch (e) {
      toast.error(he.form.deleteFailed, { description: errorMessage(e) })
    }
  }

  return (
    <div className="min-h-[100dvh]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-surface"
      >
        {he.app.skipToContent}
      </a>
      <Header query={filters.q} onQueryChange={filtersApi.setQuery} onAdd={openCreate} />
      <FilterBar
        api={filtersApi}
        facets={data.facets}
        counts={data.counts}
        shown={data.matched}
        displayed={data.rows.length}
        total={data.genderTotal}
        loading={data.isLoading}
        fetching={data.isFetching}
        serverMode={data.mode === 'server'}
        capped={data.capped}
      />
      <main id="main" className="mx-auto max-w-[1440px] px-4 pb-16 pt-4 md:px-6 md:pt-5">
        <div id={CANDIDATES_PANEL_ID} role="tabpanel" aria-labelledby={tabId(gender)}>
          <CandidatesTable
            gender={gender}
            rows={data.rows}
            sort={sort}
            onSortChange={filtersApi.setSort}
            loading={data.isLoading}
            error={data.isError}
            onRetry={data.refetch}
            hasFilters={activeCount > 0}
            genderTotal={data.genderTotal}
            onResetFilters={filtersApi.resetFilters}
            onAdd={openCreate}
            onOpen={(r) => filtersApi.openCandidate(r.id)}
            onEdit={(r) => void openEditRow(r)}
            onDelete={setToDelete}
          />
        </div>
      </main>

      <CandidateDetailModal
        id={openId}
        preview={preview}
        onClose={filtersApi.closeCandidate}
        onEdit={openEditFull}
        onDelete={setToDelete}
      />
      <CandidateForm
        open={form.open}
        candidate={form.candidate}
        defaultGender={gender}
        suggestions={suggestions}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={onSaved}
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
    </div>
  )
}
