import { Download, Eye, FileSpreadsheet, FileText, Search, SearchX, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { fieldBase } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { exportCandidatesExcel } from '@/features/candidates/exportExcel'
import { ResumeActions } from '@/features/resumes/ResumeActions'
import { isViewable, useResumeActions } from '@/features/resumes/uploadResume'
import { useAppActions } from '@/features/workspace/appActions'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useCandidateIndex } from '@/hooks/useWorkspace'
import { he } from '@/lib/strings.he'
import type { CandidateRow, TabKey } from '@/lib/types'
import { cn, formatBytes, fullName, hebrewCollator, normalizeSearch } from '@/lib/utils'

const t = he.resumeTable

function ResumeCell({ r }: { r: CandidateRow }) {
  if (!r.resume) return <span className="text-muted-foreground">{t.none}</span>
  return (
    <span className="flex min-w-0 items-center gap-2">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate" dir="auto">
          {r.resume.file_name}
        </span>
        <span className="tabular block text-caption text-muted-foreground">
          <span dir="ltr">{formatBytes(r.resume.size_bytes)}</span> ·{' '}
          {new Date(r.resume.uploaded_at).toLocaleDateString('he-IL')}
        </span>
      </span>
    </span>
  )
}

function RowActions({ r }: { r: CandidateRow }) {
  const { download, view } = useResumeActions()
  const name = fullName(r)
  if (!r.resume) return <ResumeActions candidate={r} variant="compact" />
  const resume = r.resume
  return (
    <div className="flex items-center justify-end gap-1">
      {isViewable(resume.mime_type) && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => view(resume, name)}
          aria-label={`${he.resume.view} — ${name}`}
        >
          <Eye />
          <span className="max-lg:sr-only">{he.resume.view}</span>
        </Button>
      )}
      <Button
        size="sm"
        onClick={() => void download(resume)}
        aria-label={`${he.resume.download} — ${name}`}
      >
        <Download />
        {he.resume.download}
      </Button>
    </div>
  )
}

/** Every candidate with their resume: download / view / upload, plus export of all to Excel. */
export default function ResumeTablePage() {
  const { rows, isLoading } = useCandidateIndex()
  const actions = useAppActions()
  const isMobile = useIsMobile()
  const [scope, setScope] = useState<TabKey>('all')
  const [q, setQ] = useState('')
  const [onlyWith, setOnlyWith] = useState(false)

  const list = useMemo(() => {
    const terms = normalizeSearch(q).split(' ').filter(Boolean)
    return rows
      .filter((r) => scope === 'all' || r.gender === scope)
      .filter((r) => !onlyWith || r.resume)
      .filter((r) => {
        if (!terms.length) return true
        const h = normalizeSearch(`${fullName(r)} ${r.city ?? ''} ${r.resume?.file_name ?? ''}`)
        return terms.every((x) => h.includes(x))
      })
      .sort((a, b) => hebrewCollator.compare(fullName(a), fullName(b)))
  }, [rows, scope, q, onlyWith])
  const withResume = rows.filter((r) => r.resume).length

  return (
    <main id="main" className="space-y-4 px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-body text-muted-foreground">
          {t.subtitle}
          {rows.length > 0 && (
            <span className="tabular"> · {t.summary(withResume, rows.length)}</span>
          )}
        </p>
        <Button
          variant="primary"
          className="ms-auto"
          disabled={isLoading || rows.length === 0}
          onClick={() => void exportCandidatesExcel(rows, 'all')}
        >
          <FileSpreadsheet />
          {t.exportAll}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          role="radiogroup"
          label={he.tabs.ariaLabel}
          value={scope}
          onChange={setScope}
          items={[
            { value: 'all', label: he.tabs.all },
            { value: 'male', label: he.nav.males },
            { value: 'female', label: he.nav.females },
          ]}
        />
        <div role="search" className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            className={cn(fieldBase, 'h-9 ps-9')}
          />
        </div>
        <Checkbox checked={onlyWith} onChange={setOnlyWith} label={t.onlyWith}>
          {t.onlyWith}
        </Checkbox>
      </div>

      {isLoading ? (
        <Card className="space-y-3 p-5" aria-busy>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </Card>
      ) : rows.length === 0 ? (
        <Card role="status">
          <EmptyState icon={<UserPlus />} title={t.empty} description={t.emptyText} />
        </Card>
      ) : list.length === 0 ? (
        <Card role="status">
          <EmptyState icon={<SearchX />} title={t.noMatch} description={t.noMatchText} />
        </Card>
      ) : isMobile ? (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id}>
              <Card className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => actions.openCandidate(r.id)}
                    className="min-w-0 rounded-sm text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block truncate text-h4 text-foreground">{fullName(r)}</span>
                    <span className="text-body-sm text-muted-foreground">
                      {[he.gender[r.gender], r.age, r.city].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </div>
                <div className="text-body-sm">
                  <ResumeCell r={r} />
                </div>
                <div className="border-t border-border pt-3">
                  <RowActions r={r} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0 text-table">
            <caption className="sr-only">{t.caption}</caption>
            <thead>
              <tr>
                {[
                  [he.table.fullName, 'w-[22%]'],
                  [he.table.type, 'w-[7rem]'],
                  [he.table.age, 'w-[4.5rem]'],
                  [he.table.city, 'w-[13%]'],
                  [t.file, 'w-auto'],
                ].map(([h, w]) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      'h-11 border-b border-border px-4 text-start text-body-sm font-medium text-muted-foreground',
                      w,
                    )}
                  >
                    {h}
                  </th>
                ))}
                <th scope="col" className="h-11 w-[13rem] border-b border-border px-4">
                  <span className="sr-only">{he.table.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.id}
                  className="group transition-colors duration-fast hover:bg-secondary/60"
                >
                  <td className="h-14 border-b border-border px-4 group-last:border-b-0">
                    <button
                      type="button"
                      onClick={() => actions.openCandidate(r.id)}
                      className="max-w-full truncate rounded-sm text-start font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {fullName(r)}
                    </button>
                  </td>
                  <td className="border-b border-border px-4 group-last:border-b-0">
                    <Badge>{he.gender[r.gender]}</Badge>
                  </td>
                  <td className="tabular border-b border-border px-4 group-last:border-b-0">
                    {r.age ?? '—'}
                  </td>
                  <td className="truncate border-b border-border px-4 group-last:border-b-0">
                    {r.city ?? '—'}
                  </td>
                  <td className="border-b border-border px-4 py-2 group-last:border-b-0">
                    <ResumeCell r={r} />
                  </td>
                  <td className="border-b border-border px-4 group-last:border-b-0">
                    <RowActions r={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
