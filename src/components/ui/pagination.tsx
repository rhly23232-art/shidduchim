import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'

/** Previous / next with "X–Y מתוך Z". Renders nothing when everything fits on one page. */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  label = 'עימוד',
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  label?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 pt-2">
      <p className="tabular text-body-sm text-muted-foreground" aria-live="polite">
        {from}–{to} מתוך {total}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onPage(page - 1)} disabled={page === 0}>
          <ChevronRight />
          הקודם
        </Button>
        <span className="tabular text-body-sm text-muted-foreground">
          עמוד {page + 1} מתוך {pages}
        </span>
        <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages - 1}>
          הבא
          <ChevronLeft />
        </Button>
      </div>
    </nav>
  )
}
