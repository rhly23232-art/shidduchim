import { createColumnHelper, type RowData } from '@tanstack/react-table'
import { ArrowRightLeft, ChevronLeft, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import { ResumeActions } from '@/features/resumes/ResumeActions'
import type { SortKey } from '@/lib/api'
import { he } from '@/lib/strings.he'
import type { CandidateRow } from '@/lib/types'
import { fullName } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    onOpen: (row: CandidateRow) => void
    onEdit: (row: CandidateRow) => void
    onDelete: (row: CandidateRow) => void
    /** Move to the opposite table (wrong gender). */
    onMove: (row: CandidateRow) => void
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    sortKey?: SortKey
    /** Tailwind width / alignment classes for <th>/<td>. */
    className?: string
  }
}

export const col = createColumnHelper<CandidateRow>()

export const Empty = () => (
  <span className="text-muted-foreground/60" aria-label="אין נתון">
    —
  </span>
)

export const nameColumn = col.accessor((r) => fullName(r), {
  id: 'name',
  header: he.table.fullName,
  meta: { sortKey: 'name', className: 'w-[15%]' },
  cell: ({ row }) => (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate font-medium text-foreground">{fullName(row.original)}</span>
      {row.original.status !== 'active' && (
        <span>
          <StatusBadge status={row.original.status} />
        </span>
      )}
    </div>
  ),
})

export const ageColumn = col.accessor('age', {
  id: 'age',
  header: he.table.age,
  meta: { sortKey: 'age', className: 'w-[4.25rem]' },
  cell: ({ getValue }) => {
    const v = getValue()
    return v === null ? <Empty /> : <span className="tabular font-medium">{v}</span>
  },
})

export const cityColumn = col.accessor('city', {
  id: 'city',
  header: he.table.city,
  meta: { sortKey: 'city', className: 'w-[10%]' },
  cell: ({ getValue }) => <span className="block truncate">{getValue() ?? <Empty />}</span>,
})

export const notesColumn = col.accessor('general_notes', {
  id: 'notes',
  header: he.table.notes,
  enableSorting: false,
  meta: { className: 'w-auto' },
  cell: ({ getValue }) => {
    const v = getValue()
    if (!v) return <Empty />
    return (
      <Tooltip content={<span className="whitespace-pre-line">{v}</span>}>
        <span
          tabIndex={0}
          className="line-clamp-2 cursor-default text-body-sm text-muted-foreground focus-visible:rounded-sm"
        >
          {v}
        </span>
      </Tooltip>
    )
  },
})

export const resumeColumn = col.display({
  id: 'resume',
  header: he.table.resume,
  meta: { className: 'w-[8rem]' },
  cell: ({ row }) => <ResumeActions candidate={row.original} variant="compact" />,
})

export const actionsColumn = col.display({
  id: 'actions',
  header: () => <span className="sr-only">{he.table.actions}</span>,
  meta: { className: 'w-[11.25rem]' },
  cell: ({ row, table }) => {
    const r = row.original
    const name = fullName(r)
    const meta = table.options.meta!
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          onClick={() => meta.onOpen(r)}
          aria-label={he.table.detailsAria(name)}
          className="group/btn"
        >
          {he.table.details}
          <ChevronLeft className="transition-transform duration-fast group-hover/btn:-translate-x-1" />
        </Button>
        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={he.table.moreActions(name)}>
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => meta.onEdit(r)}>
              <Pencil />
              {he.common.edit}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => meta.onMove(r)}>
              <ArrowRightLeft />
              {he.move.to(r.gender === 'male' ? 'female' : 'male')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => meta.onDelete(r)}>
              <Trash2 />
              {he.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  },
})
