import { useQuery, useQueryClient } from '@tanstack/react-query'
import { History, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { qk } from '@/hooks/useCandidates'
import { useRefreshAll } from '@/hooks/useWorkspace'
import { dataApi } from '@/lib/api'
import { isConflict } from '@/lib/api/errors'
import { FIELD_LABELS } from '@/lib/api/journaled'
import type { JournalEntry } from '@/lib/api/types'
import { he } from '@/lib/strings.he'
import { hebrewDateTime, relativeTime } from '@/lib/time'
import type { CandidateFull } from '@/lib/types'
import { errorMessage, fullName } from '@/lib/utils'
import { revertEdit } from './ops'

const t = he.history

export const journalKey = (candidateId?: string) => ['ws', 'journal', candidateId ?? 'all'] as const

const STATUS_TEXT: Record<string, string> = he.status
const value = (field: string, v: string | null) => {
  if (v === null) return <span className="text-muted-foreground">{t.emptyValue}</span>
  if (field === 'status') return STATUS_TEXT[v] ?? v
  if (field === 'gender') return v === 'male' ? 'בחור' : v === 'female' ? 'בחורה' : v
  if (field === 'eda') return (he.eda as unknown as Record<string, string>)[v] ?? v
  return v
}

function Entry({ e, onRevert }: { e: JournalEntry; onRevert: (e: JournalEntry) => void }) {
  return (
    <li className="relative ps-6">
      <span
        className="absolute start-0 top-2 size-2 rounded-full bg-brand ring-4 ring-card"
        aria-hidden
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-body font-medium text-foreground">
          {e.kind === 'create'
            ? t.created
            : e.kind === 'restore'
              ? t.restored
              : t.edited(e.data.changes?.length ?? 0)}
        </p>
        <time
          dateTime={e.at}
          className="text-caption text-muted-foreground"
          title={hebrewDateTime(e.at)}
        >
          {hebrewDateTime(e.at)} · {relativeTime(e.at)}
        </time>
      </div>
      {e.kind === 'edit' && e.data.changes && (
        <>
          <dl className="mt-2 space-y-1 rounded-md bg-secondary px-3 py-2 text-body-sm">
            {e.data.changes.map((c) => (
              <div key={c.field} className="grid grid-cols-[8rem_1fr] gap-2 max-sm:grid-cols-1">
                <dt className="text-muted-foreground">{FIELD_LABELS[c.field] ?? c.field}</dt>
                <dd className="min-w-0 break-words">
                  <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                    {value(c.field, c.before)}
                  </span>
                  <span className="mx-2 text-muted-foreground" aria-label="שונה ל">
                    ←
                  </span>
                  <span className="text-foreground">{value(c.field, c.after)}</span>
                </dd>
              </div>
            ))}
          </dl>
          <Button size="sm" variant="ghost" className="-ms-2 mt-2" onClick={() => onRevert(e)}>
            <RotateCcw />
            {t.revert}
          </Button>
        </>
      )}
    </li>
  )
}

/** Side panel with every recorded change of one candidate, and "back to before this change". */
export function HistoryButton({ candidate }: { candidate: CandidateFull | null }) {
  const [open, setOpen] = useState(false)
  const [revert, setRevert] = useState<JournalEntry | null>(null)
  const qc = useQueryClient()
  const refresh = useRefreshAll()
  const q = useQuery({
    queryKey: journalKey(candidate?.id),
    queryFn: () => dataApi.journal.list({ candidateId: candidate!.id, limit: 200 }),
    enabled: open && !!candidate,
    staleTime: 0,
  })
  const entries = (q.data ?? []).filter((e) => e.kind !== 'delete')

  const doRevert = async () => {
    if (!revert || !candidate) return
    try {
      const current = await dataApi.getCandidate(candidate.id)
      if (!current) throw new Error(he.detail.notFound)
      await revertEdit(revert, current)
      await qc.invalidateQueries({ queryKey: qk.detail(candidate.id) })
      await refresh()
      toast.success(t.reverted)
    } catch (e) {
      if (isConflict(e)) {
        toast.error(he.form.conflictTitle, { description: t.conflictRetry })
        await qc.invalidateQueries({ queryKey: journalKey(candidate.id) })
      } else toast.error(he.common.unknownError, { description: errorMessage(e) })
    }
  }

  if (!candidate) return null
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <History />
        {t.open}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-xl">
          <div className="border-b border-border px-6 pb-4 pe-16 pt-5">
            <SheetTitle className="text-h2 text-foreground">
              {t.title(fullName(candidate))}
            </SheetTitle>
            <SheetDescription className="mt-1 text-body text-muted-foreground">
              {t.description}
            </SheetDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {q.isPending ? (
              <div className="space-y-3" aria-busy>
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : entries.length === 0 ? (
              <EmptyState icon={<History />} title={t.empty} headingLevel={3} />
            ) : (
              <ol className="relative space-y-6 before:absolute before:inset-y-2 before:start-[3px] before:w-px before:bg-border">
                {entries.map((e) => (
                  <Entry key={e.id} e={e} onRevert={setRevert} />
                ))}
              </ol>
            )}
            <p className="mt-6 text-caption text-muted-foreground">{t.resumeNote}</p>
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={!!revert}
        onOpenChange={(o) => !o && setRevert(null)}
        title={t.revertTitle}
        description={t.revertText}
        confirmLabel={t.revert}
        onConfirm={() => void doRevert()}
      />
    </>
  )
}
