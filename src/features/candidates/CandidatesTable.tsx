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
import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ResumeActions } from '@/features/resumes/ResumeActions'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { SortKey, SortState } from '@/lib/api'
import { he, institutionLabel } from '@/lib/strings.he'
import type { CandidateRow, Gender } from '@/lib/types'
import { cn, fullName } from '@/lib/utils'
import { femaleColumns } from './columns.female'
import { maleColumns } from './columns.male'
import { StatusBadge } from './StatusBadge'

const VIRTUALIZE_AFTER = 100
const ROW_H = 68

interface Props {
  gender: Gender
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
      <StateBox
        icon={<AlertTriangle className="size-6 text-danger" />}
        title={he.table.errorTitle}
        text={he.table.errorText}
        action={
          <Button variant="primary" onClick={props.onRetry}>
            {he.common.retry}
          </Button>
        }
        tone="danger"
      />
    )
  }
  if (!loading && rows.length === 0) {
    return hasFilters && genderTotal > 0 ? (
      <StateBox
        icon={<SearchX className="size-6 text-navy-700" />}
        title={he.table.noResultsTitle}
        text={he.table.noResultsText}
        action={<Button onClick={props.onResetFilters}>{he.filters.resetAll}</Button>}
      />
    ) : (
      <StateBox
        icon={<UserPlus className="size-6 text-navy-700" />}
        title={he.table.emptyTitle(props.gender)}
        text={he.table.emptyText}
        action={
          <Button variant="primary" onClick={props.onAdd}>
            {he.header.addCandidate}
          </Button>
        }
      />
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
}: Props) {
  const columns = (gender === 'male' ? maleColumns : femaleColumns) as ColumnDef<
    CandidateRow,
    unknown
  >[]
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
    meta: { onOpen, onEdit, onDelete },
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
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card lg:overflow-visible">
      <table className="w-full min-w-[960px] table-fixed border-separate border-spacing-0 text-sm lg:min-w-0">
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
                      'z-10 h-11 whitespace-nowrap border-b border-line bg-surface/95 px-3 text-start text-[12.5px] font-semibold text-ink-muted backdrop-blur first:ps-4 last:pe-4 lg:sticky lg:px-4',
                      i === 0 && 'rounded-tr-xl',
                      i === hg.headers.length - 1 && 'rounded-tl-xl',
                      meta?.className,
                    )}
                    style={{ top: 'calc(var(--header-h) + var(--filterbar-h))' }}
                  >
                    {sk ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(sk)}
                        className={cn(
                          '-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
                          active && 'text-navy-900',
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
                            <ArrowUp className="size-3.5 text-gold-700" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3.5 text-gold-700" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
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
                  <td key={j} className="border-b border-line px-3 first:ps-4 last:pe-4 lg:px-4">
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
                  data-index={virtual ? items[i]!.index : undefined}
                  ref={virtual ? virtualizer.measureElement : undefined}
                  onClick={(e) => isRowActivation(e) && onOpen(row.original)}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-navy-50/55"
                  style={{ height: ROW_H }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'border-b border-line px-3 py-2 align-middle text-ink first:ps-4 last:pe-4 group-last:border-b-0 lg:px-4',
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
          <li
            key={i}
            className="h-[178px] rounded-xl border border-line bg-surface p-4 shadow-card"
          >
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
  gender: Gender
  onOpen: (r: CandidateRow) => void
}) {
  const name = fullName(r)
  return (
    <article
      onClick={(e) => isRowActivation(e) && onOpen(r)}
      className="cursor-pointer rounded-xl border border-line bg-surface p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover"
      aria-label={name}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-lg font-bold leading-tight text-navy-900">
            {name}
          </h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            {[r.age !== null ? `${he.table.age} ${r.age}` : null, r.city]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        {r.institution && (
          <>
            <dt className="text-ink-muted">{institutionLabel(gender)}</dt>
            <dd className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{r.institution}</span>
              {gender === 'male' && r.institution_type && (
                <Badge tone="navy">{r.institution_type}</Badge>
              )}
            </dd>
          </>
        )}
        {gender === 'female' && r.occupation && (
          <>
            <dt className="text-ink-muted">{he.table.occupation}</dt>
            <dd className="truncate">{r.occupation}</dd>
          </>
        )}
      </dl>
      {r.general_notes && (
        <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-ink-muted">
          {r.general_notes}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <ResumeActions candidate={r} variant="compact" />
        <Button size="sm" onClick={() => onOpen(r)} aria-label={he.table.detailsAria(name)}>
          {he.table.details}
          <ChevronLeft />
        </Button>
      </div>
    </article>
  )
}

function StateBox({
  icon,
  title,
  text,
  action,
  tone,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
  tone?: 'danger'
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className="flex flex-col items-center rounded-xl border border-line bg-surface px-6 py-16 text-center shadow-card"
    >
      <span
        className={cn(
          'grid size-12 place-items-center rounded-full',
          tone === 'danger' ? 'bg-danger-soft' : 'bg-navy-50',
        )}
      >
        {icon}
      </span>
      <h2 className="mt-4 text-xl font-bold text-navy-900">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
