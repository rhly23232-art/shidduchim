import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useMeasureVar } from '@/hooks/useMeasureVar'
import type { FiltersApi, ListKey } from '@/hooks/useFilters'
import type { SortState } from '@/lib/api'
import { he, institutionLabel } from '@/lib/strings.he'
import type { Gender } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AgeFilter, AgeRangeControl, ageLabel } from './AgeFilter'
import type { FacetOptions } from './filtering'
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
  const community: OptionGroup[] = [
    {
      key: 'communities',
      options: merge(facets.communities, filters.communities),
      selected: filters.communities,
    },
  ]
  return { location, institution, community, instLabel: institutionLabel(gender) }
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
  add('communities', filters.communities)
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
export const tabId = (g: Gender) => `tab-${g}`

/** WAI-ARIA tabs: roving tabindex, arrow keys (RTL-aware), Home/End. */
function GenderTabs({
  gender,
  onChange,
  counts,
}: {
  gender: Gender
  onChange: (g: Gender) => void
  counts: Props['counts']
}) {
  const order = ['male', 'female'] as const
  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = order.indexOf(gender)
    let next: number | null = null
    // RTL: ArrowLeft moves forward, ArrowRight backward
    if (e.key === 'ArrowLeft') next = (idx + 1) % order.length
    else if (e.key === 'ArrowRight') next = (idx - 1 + order.length) % order.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = order.length - 1
    if (next === null) return
    e.preventDefault()
    onChange(order[next]!)
    requestAnimationFrame(() => document.getElementById(tabId(order[next]!))?.focus())
  }
  return (
    <div
      role="tablist"
      aria-label={he.tabs.ariaLabel}
      onKeyDown={onKeyDown}
      className="flex gap-1 rounded-xl bg-cream-100 p-1"
    >
      {order.map((g) => {
        const active = g === gender
        return (
          <button
            key={g}
            id={tabId(g)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={CANDIDATES_PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(g)}
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 sm:px-4',
              active
                ? 'bg-navy-900 text-surface shadow-sm [box-shadow:inset_0_-2px_0_hsl(var(--gold-500))]'
                : 'text-navy-800 hover:bg-surface/70 hover:text-navy-900',
            )}
          >
            {he.tabs[g]}
            <span
              className={cn(
                'tabular min-w-6 rounded-full px-1.5 text-center text-xs leading-5 transition-colors',
                active ? 'bg-navy-700 text-surface' : 'bg-surface text-ink-muted',
              )}
            >
              {counts ? counts[g] : '·'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function FilterBar(props: Props) {
  const { api, facets, counts, shown, displayed, total, loading, fetching, serverMode, capped } =
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
      <MultiSelectFilter
        label={he.filters.community}
        groups={groups.community}
        onChange={api.setList}
      />
    </>
  )

  return (
    <div
      ref={ref}
      className="sticky z-20 border-b border-line bg-cream-50/95 backdrop-blur supports-[backdrop-filter]:bg-cream-50/85"
      style={{ top: 'var(--header-h)' }}
    >
      <div className="mx-auto max-w-[1440px] space-y-2.5 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <GenderTabs gender={api.gender} onChange={api.setGender} counts={counts} />

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
            className="h-9 rounded-full md:hidden"
            onClick={() => setSheetOpen(true)}
            aria-label={he.filters.openFilters}
          >
            <SlidersHorizontal />
            {he.filters.title}
            {api.activeCount > 0 && (
              <span className="tabular grid min-w-5 place-items-center rounded-full bg-navy-900 px-1 text-[11px] font-bold leading-5 text-surface">
                {api.activeCount}
              </span>
            )}
          </Button>

          <p
            className="tabular ms-auto flex items-center gap-1.5 text-[13px] text-ink-muted"
            aria-live="polite"
          >
            {fetching && !loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {loading ? he.common.loading : he.filters.results(shown, total)}
          </p>
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
              <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                <AnimatePresence initial={false} mode="popLayout">
                  {chips.map((c) => (
                    <motion.span
                      key={c.id}
                      layout
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: 0.15 }}
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-gold-300 bg-gold-100/70 pe-1 ps-2.5 text-[12.5px] font-medium text-navy-900"
                    >
                      <span className="max-w-[16rem] truncate">{c.label}</span>
                      <button
                        type="button"
                        onClick={c.remove}
                        aria-label={he.filters.removeChip(c.label)}
                        className="grid size-5 place-items-center rounded-full text-navy-800 transition-colors hover:bg-gold-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                      >
                        <X className="size-3" strokeWidth={2.5} />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                {chips.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2.5"
                    onClick={api.resetFilters}
                  >
                    <RotateCcw className="!size-3.5" />
                    {he.filters.reset}
                  </Button>
                )}
                {serverMode && (
                  <span className="text-xs text-ink-muted">
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
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden />
          <div className="px-5 pb-2 pt-3">
            <SheetTitle className="font-heading text-xl font-bold text-navy-900">
              {he.filters.title}
            </SheetTitle>
            <SheetDescription className="text-sm text-ink-muted">
              {he.filters.results(shown, total)}
            </SheetDescription>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-3">
            <section className="space-y-3">
              <h3 className="font-sans text-sm font-semibold text-navy-900">{he.filters.age}</h3>
              <AgeRangeControl
                min={api.filters.ageMin}
                max={api.filters.ageMax}
                onChange={api.setAge}
              />
            </section>
            <section className="space-y-2">
              <h3 className="font-sans text-sm font-semibold text-navy-900">
                {he.filters.criteria}
              </h3>
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
                <MultiSelectFilter
                  label={he.filters.community}
                  groups={groups.community}
                  onChange={api.setList}
                />
              </div>
            </section>
            <section className="space-y-2">
              <Label htmlFor="mobile-sort" className="text-sm font-semibold text-navy-900">
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
          <div className="flex gap-2 border-t border-line px-5 py-3">
            <Button
              variant="secondary"
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
