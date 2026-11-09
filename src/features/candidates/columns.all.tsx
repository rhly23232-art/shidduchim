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

/** הכל: שם מלא | בחור / בחורה | גיל | ישיבה / סמינר | עיר מגורים | הערות כלליות | רזומה | פעולות */
export const allColumns = [
  nameColumn,
  col.accessor('gender', {
    id: 'gender',
    header: he.table.type,
    enableSorting: false,
    meta: { className: 'w-[7rem]' },
    cell: ({ getValue }) => (
      <Badge tone={getValue() === 'male' ? 'navy' : 'gold'}>{he.gender[getValue()]}</Badge>
    ),
  }),
  ageColumn,
  col.accessor('institution', {
    id: 'institution',
    header: he.table.institutionAll,
    meta: { sortKey: 'institution', className: 'w-[17%]' },
    cell: ({ getValue }) => {
      const v = getValue()
      return v ? (
        <span className="block truncate">{v}</span>
      ) : (
        <span className="text-ink-muted/60">—</span>
      )
    },
  }),
  cityColumn,
  notesColumn,
  resumeColumn,
  actionsColumn,
]
