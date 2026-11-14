import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from '@tanstack/react-table'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronsUpDown,
  SearchX,
  UserPlus,
} from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ResumeActions } from '@/features/resumes/ResumeActions'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { SortKey, SortState } from '@/lib/api'
import { he, institutionLabel } from '@/lib/strings.he'
import type { CandidateRow, TabKey } from '@/lib/types'
import { cn, fullName } from '@/lib/utils'
import { allColumns } from './columns.all'
import { femaleColumns } from './columns.female'
import { maleColumns } from './columns.male'
import { LoadSamplesButton } from './SampleData'
import { StatusBadge } from './StatusBadge'
import { rowDragProps } from './moveGender'

const VIRTUALIZE_AFTER = 100
const ROW_H = 60

interface Props {
  gender: TabKey
  rows: CandidateRow[]
  sort: SortState
  onSortChange: (s: SortState | null) => void
  loading: boolean
  error: boolean
  onRetry: () => void
  hasFilters: boolean
  /** Candidates of this gender before filtering — 0 means the database is empty. */
  genderTotal: number
  onResetFilters: () => void
  onAdd: () => void
  onOpen: (r: CandidateRow) => void
  onEdit: (r: CandidateRow) => void
  onDelete: (r: CandidateRow) => void
  /** Move to the opposite table (row menu; dragging does it too). */
  onMove: (r: CandidateRow) => void
}

/** Ignore clicks on controls and on portaled content (menus/dialogs rendered elsewhere). */
function isRowActivation(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement
  if (!e.currentTarget.contains(target)) return false
  return !target.closest('button, a, input, select, textarea, [role="menuitem"], [tabindex="0"]')
}

/** Offset of an element from the document top (for the window virtualizer). */
function useScrollMargin(ref: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  const [margin, setMargin] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setMargin(el.getBoundingClientRect().top + window.scrollY)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(document.body)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return margin
}

export function CandidatesTable(props: Props) {
  const isMobile = useIsMobile()
  const { loading, error, rows, hasFilters, genderTotal } = props

  if (error) {
    return (
      <Card>
        <EmptyState
          tone="destructive"
          icon={<AlertTriangle />}
          title={he.table.errorTitle}
          description={he.table.errorText}
          action={
            <Button variant="primary" onClick={props.onRetry}>
              {he.common.retry}
            </Button>
          }
        />
      </Card>
    )
  }
  if (!loading && rows.length === 0) {
    return hasFilters && genderTotal > 0 ? (
      <Card role="status">
        <EmptyState
          icon={<SearchX />}
          title={he.table.noResultsTitle}
          description={he.table.noResultsText}
          action={<Button onClick={props.onResetFilters}>{he.filters.resetAll}</Button>}
        />
      </Card>
    ) : (
      <Card role="status">
        <EmptyState
          icon={<UserPlus />}
          title={he.table.emptyTitle(props.gender)}
          description={he.table.emptyText}
          action={
            <div className="flex flex-col items-center gap-4">
              <Button variant="primary" onClick={props.onAdd}>
                {he.header.addCandidate}
              </Button>
              <LoadSamplesButton />
            </div>
          }
        />
      </Card>
    )
  }
  return isMobile ? <CardList {...props} /> : <DesktopTable {...props} />
}

// ---------------------------------------------------------------------------------------
function DesktopTable({
  gender,
  rows,
  sort,
  onSortChange,
  loading,
  onOpen,
  onEdit,
  onDelete,
  onMove,
}: Props) {
  const columns = (
    gender === 'male' ? maleColumns : gender === 'female' ? femaleColumns : allColumns
  ) as ColumnDef<CandidateRow, unknown>[]
  const sorting = useMemo<SortingState>(
    () => (sort.key === 'updated' ? [] : [{ id: sort.key, desc: sort.dir === 'desc' }]),
    [sort],
  )
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    meta: { onOpen, onEdit, onDelete, onMove },
  })

  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const virtual = rows.length > VIRTUALIZE_AFTER
  const scrollMargin = useScrollMargin(bodyRef, [virtual, gender])
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_H,
    overscan: 12,
    scrollMargin,
    enabled: virtual,
  })

  const tableRows = table.getRowModel().rows
  const items = virtual ? virtualizer.getVirtualItems() : []
  const padTop = virtual && items.length ? items[0]!.start - scrollMargin : 0
  const padBottom =
    virtual && items.length ? virtualizer.getTotalSize() - (items.at(-1)!.end - scrollMargin) : 0
  const visible: Row<CandidateRow>[] = virtual ? items.map((i) => tableRows[i.index]!) : tableRows
  const colCount = columns.length

  const toggleSort = (key: SortKey) => {
    if (sort.key !== key) return onSortChange({ key, dir: 'asc' })
    if (sort.dir === 'asc') return onSortChange({ key, dir: 'desc' })
    onSortChange(null)
  }

  return (
    // 768–1023px: horizontal scroll keeps every specified column readable; ≥1024px: sticky header.
    <div className="relative overflow-x-auto rounded-lg border border-border bg-card lg:overflow-visible">
      <table className="w-full min-w-[960px] table-fixed border-separate border-spacing-0 text-body lg:min-w-0">
        <caption className="sr-only">{he.table.tableCaption(gender)}</caption>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h, i) => {
                const meta = h.column.columnDef.meta
                const sk = meta?.sortKey
                const active = sk && sort.key === sk
                return (
                  <th
                    key={h.id}
                    scope="col"
                    aria-sort={
                      active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'z-10 h-11 whitespace-nowrap border-b border-border bg-card px-3 text-start text-body-sm font-medium text-muted-foreground first:ps-5 last:pe-5 lg:sticky lg:px-4',
                      i === 0 && 'rounded-ss-lg',
                      i === hg.headers.length - 1 && 'rounded-se-lg',
                      meta?.className,
                    )}
                    style={{ top: 'calc(var(--header-h) + var(--filterbar-h))' }}
                  >
                    {sk ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(sk)}
                        className={cn(
                          '-mx-2 inline-flex items-center gap-1 rounded-sm px-2 py-1 transition-colors duration-fast hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active && 'text-foreground',
                        )}
                        aria-label={`${flexRender(h.column.columnDef.header, h.getContext())} — ${
                          active
                            ? sort.dir === 'asc'
                              ? he.table.sortedAsc
                              : he.table.sortedDesc
                            : he.table.sortAsc
                        }`}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {active ? (
                          sort.dir === 'asc' ? (
                            <ArrowUp className="size-4 text-brand" aria-hidden />
                          ) : (
                            <ArrowDown className="size-4 text-brand" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown className="size-4 opacity-40" aria-hidden />
                        )}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody ref={bodyRef}>
          {loading ? (
            Array.from({ length: 8 }, (_, i) => (
              <tr key={i} style={{ height: ROW_H }}>
                {columns.map((c, j) => (
                  <td key={j} className="border-b border-border px-3 first:ps-5 last:pe-5 lg:px-4">
                    <Skeleton
                      className={cn(
                        'h-4',
                        j === 0 ? 'w-28' : j === 1 ? 'w-8' : c.id === 'notes' ? 'w-4/5' : 'w-20',
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <>
              {padTop > 0 && (
                <tr aria-hidden>
                  <td colSpan={colCount} style={{ height: padTop, padding: 0 }} />
                </tr>
              )}
              {visible.map((row, i) => (
                <tr
                  key={row.id}
                  {...rowDragProps(row.original)}
                  data-index={virtual ? items[i]!.index : undefined}
                  ref={virtual ? virtualizer.measureElement : undefined}
                  onClick={(e) => isRowActivation(e) && onOpen(row.original)}
                  className="group cursor-pointer transition-colors duration-fast hover:bg-secondary/60"
                  style={{ height: ROW_H }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'border-b border-border px-3 py-2 align-middle text-table text-foreground first:ps-5 last:pe-5 group-last:border-b-0 lg:px-4',
                        cell.column.columnDef.meta?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {padBottom > 0 && (
                <tr aria-hidden>
                  <td colSpan={colCount} style={{ height: padBottom, padding: 0 }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------------------
function CardList({ gender, rows, loading, onOpen }: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  const virtual = rows.length > VIRTUALIZE_AFTER
  const scrollMargin = useScrollMargin(listRef, [virtual, gender])
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 190,
    overscan: 6,
    scrollMargin,
    enabled: virtual,
  })

  if (loading) {
    return (
      <ul className="space-y-3" aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="h-44 rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-3 h-4 w-52" />
            <Skeleton className="mt-2 h-4 w-40" />
            <Skeleton className="mt-4 h-9 w-full" />
          </li>
        ))}
      </ul>
    )
  }

  if (!virtual) {
    return (
      <ul ref={listRef} className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <CandidateCard row={r} gender={gender} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    )
  }

  const items = virtualizer.getVirtualItems()
  return (
    <ul ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {items.map((it) => (
        <li
          key={rows[it.index]!.id}
          data-index={it.index}
          ref={virtualizer.measureElement}
          className="absolute inset-x-0 pb-3"
          style={{ transform: `translateY(${it.start - scrollMargin}px)` }}
        >
          <CandidateCard row={rows[it.index]!} gender={gender} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
}

function CandidateCard({
  row: r,
  gender,
  onOpen,
}: {
  row: CandidateRow
  gender: TabKey
  onOpen: (r: CandidateRow) => void
}) {
  const name = fullName(r)
  return (
    <article
      {...rowDragProps(r)}
      onClick={(e) => isRowActivation(e) && onOpen(r)}
      className="cursor-pointer rounded-lg border border-border bg-card p-4 transition-[border-color,box-shadow] duration-base hover:border-input-hover hover:shadow-sm"
      aria-label={name}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-h4 text-foreground">{name}</h3>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {[r.age !== null ? `${he.table.age} ${r.age}` : null, r.city]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {gender === 'all' && <Badge tone="neutral">{he.gender[r.gender]}</Badge>}
          <StatusBadge status={r.status} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
        {r.institution && (
          <>
            <dt className="text-muted-foreground">{institutionLabel(gender)}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span className="truncate">{r.institution}</span>
            </dd>
          </>
        )}
        {gender === 'female' && r.occupation && (
          <>
            <dt className="text-muted-foreground">{he.table.occupation}</dt>
            <dd className="truncate">{r.occupation}</dd>
          </>
        )}
      </dl>
      {r.general_notes && (
        <p className="mt-2 line-clamp-2 text-body-sm text-muted-foreground">{r.general_notes}</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <ResumeActions candidate={r} variant="compact" />
        <Button size="sm" onClick={() => onOpen(r)} aria-label={he.table.detailsAria(name)}>
          {he.table.details}
          <ChevronLeft />
        </Button>
      </div>
    </article>
  )
}
