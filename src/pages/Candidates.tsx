import { CandidatesTable } from '@/features/candidates/CandidatesTable'
import { CANDIDATES_PANEL_ID, FilterBar, tabId } from '@/features/candidates/FilterBar'
import { useAppActions } from '@/features/workspace/appActions'
import { useCandidateDataset } from '@/hooks/useCandidates'
import { useFilters } from '@/hooks/useFilters'

export default function CandidatesPage() {
  const filtersApi = useFilters()
  const { gender, filters, sort, activeCount } = filtersApi
  const data = useCandidateDataset(gender, filters, sort)
  const actions = useAppActions()

  return (
    <>
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
        rows={data.rows}
      />
      <main id="main" className="px-4 pb-16 pt-4 md:px-6 md:pt-5">
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
            onAdd={() => actions.newCandidate(gender)}
            onOpen={(r) => actions.openCandidate(r.id)}
            onEdit={(r) => actions.editCandidate(r)}
            onDelete={actions.deleteCandidate}
          />
        </div>
      </main>
    </>
  )
}
