import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArchiveRestore,
  Download,
  FileText,
  History,
  Lightbulb,
  RotateCcw,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  buildBackup,
  existingIn,
  useLastBackup,
  readBackup,
  restoreBackup,
  type ParsedBackup,
} from '@/features/history/backup'
import { journalKey } from '@/features/history/HistoryDialog'
import { daysLeft, listTrash, purge, restoreCandidate, restoreIdea } from '@/features/history/ops'
import { useAppActions } from '@/features/workspace/appActions'
import { useCandidateIndex, useRefreshAll } from '@/hooks/useWorkspace'
import { dataApi } from '@/lib/api'
import { FIELD_LABELS as LABELS } from '@/lib/api/journaled'
import type { JournalEntry } from '@/lib/api/types'
import { saveFile, todayStamp } from '@/lib/files/save'
import { he } from '@/lib/strings.he'
import { hebrewDateTime, relativeTime } from '@/lib/time'
import { errorMessage } from '@/lib/utils'

const t = he.backup
const WEEK = 7 * 86_400_000

function FullBackup() {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const last = useLastBackup()
  const due = !last || Date.now() - last.getTime() > WEEK

  const run = async () => {
    setProgress({ done: 0, total: 0 })
    try {
      const blob = await buildBackup((done, total) => setProgress({ done, total }))
      const name = t.fileName(todayStamp())
      if (await saveFile(name, blob)) toast.success(t.ready, { description: name })
    } catch (e) {
      toast.error(he.common.unknownError, { description: errorMessage(e) })
    } finally {
      setProgress(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.fullTitle}</CardTitle>
        <CardDescription>{t.fullText}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {due && <Alert tone="warning">{last ? t.remind : t.remindNever}</Alert>}
        <p className="text-body-sm text-muted-foreground">
          {last
            ? t.last(`${hebrewDateTime(last.toISOString())} (${relativeTime(last.toISOString())})`)
            : t.never}
        </p>
        {progress ? (
          <div className="space-y-2" role="status" aria-live="polite">
            <p className="tabular text-body-sm text-foreground">
              {t.building(progress.done, progress.total)}
            </p>
            <Progress
              value={progress.total ? (progress.done / progress.total) * 100 : 5}
              label={t.building(progress.done, progress.total)}
            />
          </div>
        ) : (
          <Button variant="primary" onClick={() => void run()}>
            <Download />
            {t.download}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function RestoreFromFile() {
  const { rows } = useCandidateIndex()
  const refresh = useRefreshAll()
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedBackup | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const pick = async (file: File) => {
    try {
      setParsed(await readBackup(file))
    } catch {
      toast.error(t.notBackup)
      setParsed(null)
    }
  }
  const existing = parsed ? existingIn(parsed.backup, rows) : new Set<string>()
  const missing = parsed ? parsed.backup.candidates.length - existing.size : 0

  const run = async () => {
    if (!parsed) return
    setProgress({ done: 0, total: 1 })
    try {
      const res = await restoreBackup(parsed, rows, (done, total) => setProgress({ done, total }))
      await refresh()
      toast.success(t.restored(res.candidates, res.ideas), {
        description: res.failed.length ? t.restoreFailed(res.failed.join(', ')) : undefined,
        duration: res.failed.length ? 15000 : undefined,
      })
      setParsed(null)
    } catch (e) {
      toast.error(he.common.unknownError, { description: errorMessage(e) })
    } finally {
      setProgress(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.restoreTitle}</CardTitle>
        <CardDescription>{t.restoreText}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void pick(f)
          }}
        />
        {parsed && !progress && (
          <Alert tone="info">
            {t.preview(
              parsed.backup.candidates.length,
              parsed.backup.ideas.length,
              existing.size,
              hebrewDateTime(parsed.backup.created_at),
            )}
          </Alert>
        )}
        {progress ? (
          <div className="space-y-2" role="status" aria-live="polite">
            <p className="tabular text-body-sm text-foreground">
              {t.restoring(progress.done, progress.total)}
            </p>
            <Progress
              value={progress.total ? (progress.done / progress.total) * 100 : 5}
              label={t.restoring(progress.done, progress.total)}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => inputRef.current?.click()}>
              <Upload />
              {t.choose}
            </Button>
            {parsed && (
              <Button variant="primary" onClick={() => void run()}>
                <ArchiveRestore />
                {missing ? t.restoreN(missing) : t.restoreIdeasOnly}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Trash() {
  const qc = useQueryClient()
  const refresh = useRefreshAll()
  const actions = useAppActions()
  const q = useQuery({ queryKey: ['ws', 'trash'], queryFn: listTrash, staleTime: 0 })
  const [busy, setBusy] = useState<string | null>(null)
  const [toPurge, setToPurge] = useState<JournalEntry | null>(null)

  const restore = async (e: JournalEntry) => {
    setBusy(e.id)
    try {
      if (e.kind === 'delete') {
        const id = await restoreCandidate(e)
        toast.success(t.restoredOne(e.title), {
          action: { label: he.table.details, onClick: () => actions.openCandidate(id) },
        })
      } else {
        await restoreIdea(e)
        toast.success(t.restoredOne(e.title))
      }
      await refresh()
    } catch (err) {
      toast.error(he.common.unknownError, { description: errorMessage(err) })
    } finally {
      setBusy(null)
    }
  }
  const doPurge = async () => {
    if (!toPurge) return
    try {
      await purge(toPurge)
      await qc.invalidateQueries({ queryKey: ['ws'] })
    } catch (err) {
      toast.error(he.common.unknownError, { description: errorMessage(err) })
    }
  }

  const items = q.data ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.trashTitle}</CardTitle>
        <CardDescription>{t.trashText}</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <div className="space-y-2" aria-busy>
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Trash2 />} title={t.trashEmpty} headingLevel={3} className="py-8" />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground"
                  aria-hidden
                >
                  {e.kind === 'delete' ? (
                    <UserRound className="size-4" />
                  ) : (
                    <Lightbulb className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{e.title}</p>
                  <p className="text-caption text-muted-foreground">
                    {e.kind === 'delete' ? t.candidate : t.idea} · {t.deletedAt(relativeTime(e.at))}{' '}
                    · {t.daysLeft(daysLeft(e))}
                    {e.data.file && (
                      <>
                        {' · '}
                        <FileText className="inline size-3" aria-hidden /> {t.withResume}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" loading={busy === e.id} onClick={() => void restore(e)}>
                    {busy !== e.id && <RotateCcw />}
                    {t.restore}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                    onClick={() => setToPurge(e)}
                    disabled={!!busy}
                  >
                    <Trash2 />
                    <span className="max-sm:sr-only">{t.purge}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!toPurge}
        onOpenChange={(o) => !o && setToPurge(null)}
        title={toPurge ? t.purgeTitle(toPurge.title) : ''}
        description={t.purgeText}
        confirmLabel={t.purge}
        destructive
        onConfirm={() => void doPurge()}
      />
    </Card>
  )
}

function Activity() {
  const actions = useAppActions()
  const { byId } = useCandidateIndex()
  const q = useQuery({
    queryKey: journalKey(),
    queryFn: () => dataApi.journal.list({ limit: 30 }),
    staleTime: 0,
  })
  const items = q.data ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.activityTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-24" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<History />}
            title={t.activityEmpty}
            headingLevel={3}
            className="py-8"
          />
        ) : (
          <ul className="space-y-1">
            {items.map((e) => {
              const live = e.candidate_id ? byId.get(e.candidate_id) : undefined
              const text = (
                <>
                  <Badge
                    tone={
                      e.kind === 'delete' || e.kind === 'idea_delete'
                        ? 'destructive'
                        : e.kind === 'edit'
                          ? 'neutral'
                          : 'success'
                    }
                  >
                    {t.kinds[e.kind]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{e.title}</span>
                    {e.kind === 'edit' && e.data.changes?.length ? (
                      <span className="text-muted-foreground">
                        {' — '}
                        {e.data.changes
                          .map((c) => c.field)
                          .slice(0, 4)
                          .map((f) => (f in LABELS ? LABELS[f] : f))
                          .join(', ')}
                      </span>
                    ) : null}
                  </span>
                  <time
                    dateTime={e.at}
                    className="shrink-0 text-caption text-muted-foreground"
                    title={hebrewDateTime(e.at)}
                  >
                    {relativeTime(e.at)}
                  </time>
                </>
              )
              return (
                <li key={e.id}>
                  {live ? (
                    <button
                      type="button"
                      onClick={() => actions.openCandidate(live.id)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-start text-body transition-colors duration-fast hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {text}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-2 text-body">{text}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Recycle bin, recent activity, full backup and restore. */
export default function BackupPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-16 pt-6 md:px-8">
      <p className="text-body text-muted-foreground">{t.subtitle}</p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FullBackup />
        <RestoreFromFile />
      </div>
      <Trash />
      <Activity />
    </main>
  )
}
