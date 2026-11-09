import { CalendarClock, CheckCircle2, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input, NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { useAppActions } from '@/features/workspace/appActions'
import {
  CandidatePicker,
  Checkbox,
  DueBadge,
  StageBadge,
  daysFromToday,
} from '@/features/workspace/bits'
import {
  useCandidateIndex,
  useDeleteTask,
  useProposals,
  useSaveTask,
  useTasks,
} from '@/hooks/useWorkspace'
import { he } from '@/lib/strings.he'
import { ACTIVE_STAGES, type Proposal, type Task, type TaskInput } from '@/lib/types'
import { cn, fullName } from '@/lib/utils'

const toInput = ({ id: _i, created_at: _c, updated_at: _u, ...rest }: Task): TaskInput => rest

type Item =
  | { kind: 'task'; t: Task; due: string | null }
  | { kind: 'followup'; p: Proposal; due: string }

function bucket(due: string | null): 'overdue' | 'today' | 'upcoming' | 'noDate' {
  if (!due) return 'noDate'
  const n = daysFromToday(due)
  return n < 0 ? 'overdue' : n === 0 ? 'today' : 'upcoming'
}

function TaskEditor({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { rows, byId } = useCandidateIndex()
  const proposals = useProposals()
  const save = useSaveTask()
  const [v, setV] = useState<TaskInput | null>(null)
  const [key, setKey] = useState<string | null>(null)
  if ((task?.id ?? null) !== key) {
    setKey(task?.id ?? null)
    setV(task ? toInput(task) : null)
  }
  if (!task || !v) return null
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{he.common.edit}</DialogTitle>
          <DialogDescription>{he.tasks.subtitle}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">{he.tasks.titleLabel}</Label>
            <Input
              id="t-title"
              value={v.title}
              maxLength={300}
              onChange={(e) => setV({ ...v, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-due">{he.tasks.due}</Label>
            <Input
              id="t-due"
              type="date"
              className="tabular"
              value={v.due_date ?? ''}
              onChange={(e) => setV({ ...v, due_date: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-cand">{he.tasks.candidate}</Label>
            <CandidatePicker
              id="t-cand"
              value={v.candidate_id}
              onChange={(id) => setV({ ...v, candidate_id: id })}
              candidates={rows}
              placeholder={he.tasks.none}
              allowNone
              noneLabel={he.tasks.none}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-prop">{he.tasks.proposal}</Label>
            <NativeSelect
              id="t-prop"
              value={v.proposal_id ?? ''}
              onChange={(e) => setV({ ...v, proposal_id: e.target.value || null })}
            >
              <option value="">{he.tasks.none}</option>
              {(proposals.data ?? []).map((p) => {
                const m = byId.get(p.male_id)
                const f = byId.get(p.female_id)
                return m && f ? (
                  <option key={p.id} value={p.id}>
                    {he.proposals.pair(fullName(m), fullName(f))}
                  </option>
                ) : null
              })}
            </NativeSelect>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {he.common.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={!v.title.trim() || save.isPending}
            onClick={() =>
              void save
                .mutateAsync({ id: task.id, input: { ...v, title: v.title.trim() } })
                .then(() => {
                  toast.success(he.tasks.saved)
                  onClose()
                })
            }
          >
            {he.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Group({
  title,
  tone,
  children,
  count,
}: {
  title: string
  tone?: 'danger' | 'gold'
  children: ReactNode
  count: number
}) {
  if (count === 0) return null
  return (
    <section aria-label={title} className="rounded-xl border border-line bg-surface shadow-card">
      <h2
        className={cn(
          'flex items-center gap-2 border-b border-line px-4 py-3 font-sans text-[14px] font-semibold',
          tone === 'danger' ? 'text-danger' : tone === 'gold' ? 'text-gold-700' : 'text-navy-900',
        )}
      >
        {title}
        <span className="tabular rounded-full bg-cream-100 px-2 text-[12px] text-ink-muted">
          {count}
        </span>
      </h2>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  )
}

export default function TasksPage() {
  const tasks = useTasks()
  const proposals = useProposals()
  const { byId } = useCandidateIndex()
  const save = useSaveTask()
  const del = useDeleteTask()
  const actions = useAppActions()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [showDone, setShowDone] = useState(false)

  const add = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    void save
      .mutateAsync({
        input: {
          title: t,
          due_date: due || null,
          done: false,
          candidate_id: null,
          proposal_id: null,
        },
      })
      .then(() => {
        setTitle('')
        setDue('')
        toast.success(he.tasks.saved)
      })
  }

  const toggle = (t: Task, done: boolean) => {
    void save.mutateAsync({ id: t.id, input: { ...toInput(t), done } })
    if (done) toast.success(he.tasks.doneToast)
  }

  const open = (tasks.data ?? []).filter((t) => !t.done)
  const done = (tasks.data ?? []).filter((t) => t.done)
  const followups = (proposals.data ?? []).filter(
    (p) => ACTIVE_STAGES.includes(p.stage) && p.next_followup,
  )
  const items: Item[] = [
    ...open.map((t): Item => ({ kind: 'task', t, due: t.due_date })),
    ...followups.map((p): Item => ({ kind: 'followup', p, due: p.next_followup! })),
  ].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  const groups = (['overdue', 'today', 'upcoming', 'noDate'] as const).map((b) => ({
    b,
    list: items.filter((i) => bucket(i.due) === b),
  }))

  const renderItem = (i: Item) => {
    if (i.kind === 'followup') {
      const m = byId.get(i.p.male_id)
      const f = byId.get(i.p.female_id)
      return (
        <li key={`p-${i.p.id}`} className="flex items-center gap-3 px-4 py-3">
          <CalendarClock className="size-5 shrink-0 text-gold-700" aria-hidden />
          <button
            type="button"
            onClick={() => actions.openProposal(i.p.id)}
            className="min-w-0 flex-1 truncate text-start text-[14.5px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            <span className="text-ink-muted">{he.tasks.followups}: </span>
            <span className="font-medium text-navy-900">
              {m && f ? he.proposals.pair(fullName(m), fullName(f)) : ''}
            </span>
          </button>
          <span className="hidden sm:inline">
            <StageBadge stage={i.p.stage} />
          </span>
          <DueBadge date={i.due} />
        </li>
      )
    }
    const t = i.t
    const c = t.candidate_id ? byId.get(t.candidate_id) : undefined
    return (
      <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
        <Checkbox checked={t.done} label={he.tasks.markDone} onChange={(d) => toggle(t, d)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] text-ink">{t.title}</p>
          {(c || t.proposal_id) && (
            <div className="flex flex-wrap gap-x-3 text-[12.5px]">
              {c && (
                <button
                  type="button"
                  onClick={() => actions.openCandidate(c.id)}
                  className="text-navy-700 hover:underline"
                >
                  {fullName(c)}
                </button>
              )}
              {t.proposal_id && (
                <button
                  type="button"
                  onClick={() => actions.openProposal(t.proposal_id!)}
                  className="text-navy-700 hover:underline"
                >
                  {he.nav.proposals}
                </button>
              )}
            </div>
          )}
        </div>
        <DueBadge date={t.due_date} />
        <Tooltip content={he.common.edit}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${he.common.edit} — ${t.title}`}
            onClick={() => setEditing(t)}
          >
            <Pencil />
          </Button>
        </Tooltip>
        <Tooltip content={he.common.delete}>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            aria-label={`${he.common.delete} — ${t.title}`}
            onClick={() => void del.mutateAsync(t.id)}
          >
            <Trash2 />
          </Button>
        </Tooltip>
      </li>
    )
  }

  return (
    <main id="main" className="mx-auto max-w-4xl space-y-4 px-4 pb-16 pt-5 md:px-6">
      <p className="text-sm text-ink-muted">{he.tasks.subtitle}</p>
      <form
        onSubmit={add}
        className="flex flex-wrap gap-2 rounded-xl border border-line bg-surface p-3 shadow-card"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={he.tasks.quickAdd}
          aria-label={he.tasks.titleLabel}
          maxLength={300}
          className="min-w-0 flex-1 basis-60"
        />
        <Input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label={he.tasks.due}
          className="tabular w-auto"
        />
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          <Plus />
          {he.tasks.new}
        </Button>
      </form>

      {tasks.isPending || proposals.isPending ? (
        <Skeleton className="h-60" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-line bg-surface px-6 py-14 text-center shadow-card">
          <span className="grid size-12 place-items-center rounded-full bg-success-soft">
            <ListChecks className="size-6 text-success" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-navy-900">{he.tasks.empty}</h2>
          <p className="mt-1.5 text-sm text-ink-muted">{he.tasks.emptyText}</p>
        </div>
      ) : (
        groups.map(({ b, list }) => (
          <Group
            key={b}
            title={he.tasks[b]}
            count={list.length}
            tone={b === 'overdue' ? 'danger' : b === 'today' ? 'gold' : undefined}
          >
            {list.map(renderItem)}
          </Group>
        ))
      )}

      {done.length > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDone((s) => !s)}
            aria-expanded={showDone}
          >
            <CheckCircle2 />
            {he.tasks.completed} ({done.length})
          </Button>
          {showDone && (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface opacity-75">
              {done.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Checkbox checked label={he.tasks.markUndone} onChange={(d) => toggle(t, d)} />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink-muted line-through">
                    {t.title}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    aria-label={`${he.common.delete} — ${t.title}`}
                    onClick={() => void del.mutateAsync(t.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <TaskEditor task={editing} onClose={() => setEditing(null)} />
    </main>
  )
}
