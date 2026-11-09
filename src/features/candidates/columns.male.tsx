import { Badge } from '@/components/ui/badge'
import { he } from '@/lib/strings.he'
import {
  actionsColumn,
  ageColumn,
  cityColumn,
  col,
  nameColumn,
  notesColumn,
  resumeColumn,
} from './columns.shared'

/** בחורים: שם מלא | גיל | ישיבה | עיר מגורים | הערות כלליות | רזומה | פעולות */
export const maleColumns = [
  nameColumn,
  ageColumn,
  col.accessor('institution', {
    id: 'institution',
    header: he.table.yeshiva,
    meta: { sortKey: 'institution', className: 'w-[17%]' },
    cell: ({ row }) => {
      const { institution, institution_type } = row.original
      if (!institution) return <span className="text-ink-muted/60">—</span>
      return (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="max-w-full truncate">{institution}</span>
          {institution_type && <Badge tone="navy">{institution_type}</Badge>}
        </div>
      )
    },
  }),
  cityColumn,
  notesColumn,
  resumeColumn,
  actionsColumn,
]
