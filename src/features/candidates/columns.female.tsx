import { he } from '@/lib/strings.he'
import {
  actionsColumn,
  ageColumn,
  cityColumn,
  col,
  nameColumn,
  notesColumn,
  resumeColumn,
  Empty,
} from './columns.shared'

/** בחורות: שם מלא | גיל | סמינר | עיסוק / מקום עבודה | עיר מגורים | הערות כלליות | רזומה | פעולות */
export const femaleColumns = [
  nameColumn,
  ageColumn,
  col.accessor('institution', {
    id: 'institution',
    header: he.table.seminary,
    meta: { sortKey: 'institution', className: 'w-[14%]' },
    cell: ({ getValue }) => <span className="block truncate">{getValue() ?? <Empty />}</span>,
  }),
  col.accessor('occupation', {
    id: 'occupation',
    header: he.table.occupation,
    meta: { sortKey: 'occupation', className: 'w-[14%]' },
    cell: ({ getValue }) => {
      const v = getValue()
      return v ? <span className="line-clamp-2">{v}</span> : <Empty />
    },
  }),
  cityColumn,
  notesColumn,
  resumeColumn,
  actionsColumn,
]
