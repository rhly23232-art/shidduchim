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

/** בחורים: שם מלא | גיל | ישיבה | עיר מגורים | הערות כלליות | רזומה | פעולות */
export const maleColumns = [
  nameColumn,
  ageColumn,
  col.accessor('institution', {
    id: 'institution',
    header: he.table.yeshiva,
    meta: { sortKey: 'institution', className: 'w-[17%]' },
    cell: ({ getValue }) => {
      const v = getValue()
      return v ? <span className="block truncate">{v}</span> : <Empty />
    },
  }),
  cityColumn,
  notesColumn,
  resumeColumn,
  actionsColumn,
]
