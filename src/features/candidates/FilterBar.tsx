import { AnimatePresence, motion } from 'framer-motion'
import { FileSpreadsheet, Loader2, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FilterCount } from '@/components/ui/filter-trigger'
import { Chip } from '@/components/ui/chip'
import { Segmented } from '@/components/ui/segmented'
import { Tooltip } from '@/components/ui/tooltip'
import { SearchBox } from '@/components/layout/SearchBox'
import { exportCandidatesCsv } from './exportCsv'
import { NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useMeasureVar } from '@/hooks/useMeasureVar'
import type { FiltersApi, ListKey } from '@/hooks/useFilters'
import type { SortState } from '@/lib/api'
import { he, institutionLabel } from '@/lib/strings.he'
import type { CandidateRow, TabKey } from '@/lib/types'
import { AgeFilter, AgeRangeControl, ageLabel } from './AgeFilter'
import type { FacetOptions } from './filtering'
import { EdaFilter, edaLabel } from './EdaFilter'
import { MultiSelectFilter, type OptionGroup } from './MultiSelectFilter'

interface Props {
  api: FiltersApi
  facets: FacetOptions
  counts: { male: number; female: number } | undefined
  shown: number
  displayed: number
  total: number
  loading: boolean
  fetching: boolean
  serverMode: boolean
  capped: boolean
  /** Currently shown rows (for export). */
  rows: CandidateRow[]
}

interface Chip {
  id: string
  label: string
  remove: () => void
}

function useGroups(api: FiltersApi, facets: FacetOptions) {
  const { filters, gender } = api
  // Keep selected values visible even if no longer present in data.
  const merge = (opts: string[], sel: string[]) => [...new Set([...opts, ...sel])]
  const location: OptionGroup[] = [
    {
      key: 'cities',
      heading: he.filters.cities,
      options: merge(facets.cities, filters.cities),
      selected: filters.cities,
    },
    {
      key: 'regions',
      heading: he.filters.regions,
      options: merge(facets.regions, filters.regions),
      selected: filters.regions,
    },
  ]
  const institution: OptionGroup[] = [
    {
      key: 'institutions',
      options: merge(facets.institutions, filters.institutions),
      selected: filters.institutions,
    },
  ]
  return { location, institution, instLabel: institutionLabel(gender) }
}

function useChips(api: FiltersApi): Chip[] {
  const { filters, setList, setAge, setQuery } = api
  const chips: Chip[] = []
  if (filters.q)
    chips.push({ id: 'q', label: he.filters.searchChip(filters.q), remove: () => setQuery('') })
  const age = ageLabel(filters.ageMin, filters.ageMax)
  if (age) chips.push({ id: 'age', label: age, remove: () => setAge(18, 45) })
  const add = (key: ListKey, values: string[]) =>
    values.forEach((v) =>
      chips.push({
        id: `${key}:${v}`,
        label: v,
        remove: () =>
          setList(
            key,
            values.filter((x) => x !== v),
          ),
      }),
    )
  add('cities', filters.cities)
  add('regions', filters.regions)
  add('institutions', filters.institutions)
  const eda = edaLabel(filters.eda, filters.edaText)
  if (eda)
    chips.push({
      id: 'eda',
      label: `${he.filters.community}: ${eda}`,
      remove: () => api.setEda(null, ''),
    })
  return chips
}

const SORT_OPTIONS: { value: string; label: string; sort: SortState }[] = [
  { value: '-updated', label: he.sortOptions.updated, sort: { key: 'updated', dir: 'desc' } },
  { value: 'name', label: he.sortOptions.name, sort: { key: 'name', dir: 'asc' } },
  { value: 'age', label: he.sortOptions.ageAsc, sort: { key: 'age', dir: 'asc' } },
  { value: '-age', label: he.sortOptions.ageDesc, sort: { key: 'age', dir: 'desc' } },
  { value: 'city', label: he.sortOptions.city, sort: { key: 'city', dir: 'asc' } },
]

export const CANDIDATES_PANEL_ID = 'candidates-panel'
export const tabId = (g: TabKey) => `tab-${g}`

const TAB_ORDER = ['male', 'female', 'all'] as const

/** View switch בחורים / בחורות / הכל — WAI-ARIA tabs via the shared Segmented control. */
function GenderTabs({ gender, onChange }: { gender: TabKey; onChange: (g: TabKey) => void }) {
  return (
    <Segmented
      label={he.tabs.ariaLabel}
      value={gender}
      onChange={onChange}
      items={TAB_ORDER.map((g) => ({
        value: g,
        label: he.tabs[g],
        id: tabId(g),
        controls: CANDIDATES_PANEL_ID,
      }))}
    />
  )
}

export function FilterBar(props: Props) {
  const { api, facets, shown, displayed, total, loading, fetching, serverMode, capped, rows } =
    props
  const ref = useRef<HTMLDivElement>(null)
  useMeasureVar(ref, '--filterbar-h')
  const [sheetOpen, setSheetOpen] = useState(false)
  const groups = useGroups(api, facets)
  const chips = useChips(api)
  const sortValue = `${api.sort.dir === 'desc' ? '-' : ''}${api.sort.key}`

  const controls = (
    <>
      <AgeFilter min={api.filters.ageMin} max={api.filters.ageMax} onChange={api.setAge} />
      <MultiSelectFilter
        label={he.filters.location}
        groups={groups.location}
        onChange={api.setList}
      />
      <MultiSelectFilter
        label={groups.instLabel}
        groups={groups.institution}
        onChange={api.setList}
      />
      <EdaFilter eda={api.filters.eda} text={api.filters.edaText} onChange={api.setEda} />
    </>
  )

  return (
    <div
      ref={ref}
      className="sticky z-20 border-b border-border bg-background"
      style={{ top: 'var(--header-h)' }}
    >
      <div className="space-y-3 px-4 py-3 md:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <GenderTabs gender={api.gender} onChange={api.setGender} />
          <SearchBox
            value={api.filters.q}
            onChange={api.setQuery}
            className="order-last w-full sm:order-none sm:w-60 xl:w-72"
          />

          {/* Desktop filters */}
          <div
            className="hidden flex-wrap items-center gap-2 md:flex"
            role="group"
            aria-label={he.filters.title}
          >
            {controls}
          </div>

          {/* Mobile: one button opens the filter sheet */}
          <Button
            size="sm"
            className="h-9 md:hidden"
            onClick={() => setSheetOpen(true)}
            aria-label={he.filters.openFilters}
          >
            <SlidersHorizontal />
            {he.filters.title}
            {api.activeCount > 0 && <FilterCount value={api.activeCount} />}
          </Button>

          <p
            className="tabular ms-auto flex items-center gap-2 text-body-sm text-muted-foreground"
            aria-live="polite"
          >
            {fetching && !loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {loading
              ? he.common.loading
              : api.activeCount > 0
                ? he.filters.results(shown, total)
                : null}
          </p>
          <Tooltip content={he.exportCsv.button}>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={he.exportCsv.button}
              disabled={loading || rows.length === 0}
              onClick={() => void exportCandidatesCsv(rows, api.gender)}
            >
              <FileSpreadsheet />
            </Button>
          </Tooltip>
        </div>

        <AnimatePresence initial={false}>
          {(chips.length > 0 || serverMode) && (
            <motion.div
              key="chips"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <AnimatePresence initial={false} mode="popLayout">
                  {chips.map((c) => (
                    <motion.span
                      key={c.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Chip
                        label={c.label}
                        removeLabel={he.filters.removeChip(c.label)}
                        onRemove={c.remove}
                      />
                    </motion.span>
                  ))}
                </AnimatePresence>
                {chips.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7" onClick={api.resetFilters}>
                    <RotateCcw />
                    {he.filters.reset}
                  </Button>
                )}
                {serverMode && (
                  <span className="text-caption text-muted-foreground">
                    {capped ? he.filters.serverCapped(displayed) : he.filters.serverMode}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile filter sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden />
          <div className="px-5 pb-2 pt-3">
            <SheetTitle className="text-h2 text-foreground">{he.filters.title}</SheetTitle>
            <SheetDescription className="text-body text-muted-foreground">
              {he.filters.results(shown, total)}
            </SheetDescription>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-3">
            <section className="space-y-3">
              <h3 className="text-h4 text-foreground">{he.filters.age}</h3>
              <AgeRangeControl
                min={api.filters.ageMin}
                max={api.filters.ageMax}
                onChange={api.setAge}
              />
            </section>
            <section className="space-y-2">
              <h3 className="text-h4 text-foreground">{he.filters.criteria}</h3>
              <div className="flex flex-wrap gap-2">
                <MultiSelectFilter
                  label={he.filters.location}
                  groups={groups.location}
                  onChange={api.setList}
                />
                <MultiSelectFilter
                  label={groups.instLabel}
                  groups={groups.institution}
                  onChange={api.setList}
                />
                <EdaFilter eda={api.filters.eda} text={api.filters.edaText} onChange={api.setEda} />
              </div>
            </section>
            <section className="space-y-2">
              <Label htmlFor="mobile-sort" className="text-h4">
                {he.filters.sortBy}
              </Label>
              <NativeSelect
                id="mobile-sort"
                value={SORT_OPTIONS.some((o) => o.value === sortValue) ? sortValue : '-updated'}
                onChange={(e) =>
                  api.setSort(SORT_OPTIONS.find((o) => o.value === e.target.value)?.sort ?? null)
                }
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </section>
          </div>
          <div className="flex gap-2 border-t border-border px-5 py-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={api.resetFilters}
              disabled={api.activeCount === 0}
            >
              <RotateCcw />
              {he.filters.resetAll}
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setSheetOpen(false)}>
              {he.filters.showResults(shown)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
