import {
  CheckCircle2,
  HeartHandshake,
  Lightbulb,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
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
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { useAppActions } from '@/features/workspace/appActions'
import { CandidatePicker, relativeTime } from '@/features/workspace/bits'
import { useCandidateIndex, useDeleteIdea, useIdeas, useSaveIdea } from '@/hooks/useWorkspace'
import { he } from '@/lib/strings.he'
import type { Idea, IdeaInput } from '@/lib/types'
import { cn, fullName } from '@/lib/utils'

const EMPTY: IdeaInput = {
  title: '',
  body: null,
  male_id: null,
  female_id: null,
  pinned: false,
  done: false,
}
const toInput = ({ id: _i, created_at: _c, updated_at: _u, ...rest }: Idea): IdeaInput => rest

function IdeaEditor({
  idea,
  open,
  onClose,
}: {
  idea: Idea | null
  open: boolean
  onClose: () => void
}) {
  const { rows } = useCandidateIndex()
  const save = useSaveIdea()
  const [v, setV] = useState<IdeaInput>(EMPTY)
  const [tried, setTried] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = open ? (idea?.id ?? 'new') : null
  if (key !== lastKey) {
    setLastKey(key)
    setV(idea ? toInput(idea) : EMPTY)
    setTried(false)
  }
  const submit = async () => {
    setTried(true)
    if (!v.title.trim()) return
    await save.mutateAsync({
      id: idea?.id,
      input: { ...v, title: v.title.trim(), body: v.body?.trim() || null },
    })
    toast.success(he.ideas.saved)
    onClose()
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{idea ? he.common.edit : he.ideas.new}</DialogTitle>
          <DialogDescription>{he.ideas.subtitle}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="idea-title">
              {he.ideas.titleLabel}
              <span className="ms-0.5 text-danger" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="idea-title"
              autoFocus
              value={v.title}
              maxLength={200}
              placeholder={he.ideas.titlePlaceholder}
              aria-invalid={tried && !v.title.trim() ? true : undefined}
              onChange={(e) => setV({ ...v, title: e.target.value })}
            />
            {tried && !v.title.trim() && (
              <p role="alert" className="text-xs font-medium text-danger">
                {he.validation.required}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idea-body">{he.ideas.body}</Label>
            <Textarea
              id="idea-body"
              rows={4}
              maxLength={4000}
              value={v.body ?? ''}
              onChange={(e) => setV({ ...v, body: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="idea-male">{he.ideas.linkMale}</Label>
              <CandidatePicker
                id="idea-male"
                value={v.male_id}
                onChange={(id) => setV({ ...v, male_id: id })}
                candidates={rows}
                gender="male"
                placeholder={he.ideas.none}
                allowNone
                noneLabel={he.ideas.none}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idea-female">{he.ideas.linkFemale}</Label>
              <CandidatePicker
                id="idea-female"
                value={v.female_id}
                onChange={(id) => setV({ ...v, female_id: id })}
                candidates={rows}
                gender="female"
                placeholder={he.ideas.none}
                allowNone
                noneLabel={he.ideas.none}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {he.common.cancel}
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={save.isPending}>
            {he.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function IdeasPage() {
  const ideas = useIdeas()
  const { byId } = useCandidateIndex()
  const save = useSaveIdea()
  const del = useDeleteIdea()
  const actions = useAppActions()
  const [editing, setEditing] = useState<{ open: boolean; idea: Idea | null }>({
    open: false,
    idea: null,
  })
  const [showDone, setShowDone] = useState(false)
  const [toDelete, setToDelete] = useState<Idea | null>(null)

  const list = (ideas.data ?? []).filter((i) => showDone || !i.done)
  const doneCount = (ideas.data ?? []).filter((i) => i.done).length
  const patch = (i: Idea, change: Partial<IdeaInput>) =>
    void save.mutateAsync({ id: i.id, input: { ...toInput(i), ...change } })

  return (
    <main id="main" className="space-y-4 px-4 pb-16 pt-5 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink-muted">{he.ideas.subtitle}</p>
        <div className="ms-auto flex items-center gap-2">
          {doneCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDone((s) => !s)}
              aria-pressed={showDone}
            >
              {he.ideas.showDone} ({doneCount})
            </Button>
          )}
          <Button variant="primary" onClick={() => setEditing({ open: true, idea: null })}>
            <Plus />
            {he.ideas.new}
          </Button>
        </div>
      </div>

      {ideas.isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-line bg-surface px-6 py-16 text-center shadow-card">
          <span className="grid size-12 place-items-center rounded-full bg-gold-100">
            <Lightbulb className="size-6 text-gold-700" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-navy-900">{he.ideas.empty}</h2>
          <p className="mt-1.5 text-sm text-ink-muted">{he.ideas.emptyText}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((i) => {
            const m = i.male_id ? byId.get(i.male_id) : undefined
            const f = i.female_id ? byId.get(i.female_id) : undefined
            return (
              <li
                key={i.id}
                className={cn(
                  'flex flex-col rounded-xl border bg-surface p-4 shadow-card transition-opacity',
                  i.pinned ? 'border-gold-300 bg-gold-100/30' : 'border-line',
                  i.done && 'opacity-60',
                )}
              >
                <div className="flex items-start gap-2">
                  <h2
                    className={cn(
                      'flex-1 font-sans text-[15.5px] font-semibold leading-snug text-navy-900',
                      i.done && 'line-through',
                    )}
                  >
                    {i.title}
                  </h2>
                  {i.pinned && <Badge tone="gold">{he.ideas.pinned}</Badge>}
                </div>
                {i.body && (
                  <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-muted">
                    {i.body}
                  </p>
                )}
                {(m || f) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[m, f].filter(Boolean).map((c) => (
                      <button
                        key={c!.id}
                        type="button"
                        onClick={() => actions.openCandidate(c!.id)}
                        className="rounded-full bg-navy-50 px-2.5 py-0.5 text-[12.5px] font-medium text-navy-800 hover:bg-navy-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                      >
                        {fullName(c!)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-0.5 pt-4">
                  <span className="tabular me-auto text-[12px] text-ink-muted">
                    {relativeTime(i.updated_at)}
                  </span>
                  {m && f && !i.done && (
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() =>
                        actions.newProposal({
                          male_id: m.id,
                          female_id: f.id,
                          notes: i.body ?? i.title,
                          ideaId: i.id,
                        })
                      }
                    >
                      <HeartHandshake />
                      {he.ideas.toProposal}
                    </Button>
                  )}
                  <Tooltip content={i.pinned ? he.ideas.unpin : he.ideas.pin}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={i.pinned ? he.ideas.unpin : he.ideas.pin}
                      onClick={() => patch(i, { pinned: !i.pinned })}
                    >
                      {i.pinned ? <PinOff /> : <Pin />}
                    </Button>
                  </Tooltip>
                  <Tooltip content={i.done ? he.ideas.undone : he.ideas.done}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={i.done ? he.ideas.undone : he.ideas.done}
                      onClick={() => patch(i, { done: !i.done })}
                    >
                      {i.done ? <RotateCcw /> : <CheckCircle2 />}
                    </Button>
                  </Tooltip>
                  <Tooltip content={he.common.edit}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={he.common.edit}
                      onClick={() => setEditing({ open: true, idea: i })}
                    >
                      <Pencil />
                    </Button>
                  </Tooltip>
                  <Tooltip content={he.common.delete}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger-soft"
                      aria-label={he.common.delete}
                      onClick={() => setToDelete(i)}
                    >
                      <Trash2 />
                    </Button>
                  </Tooltip>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <IdeaEditor
        open={editing.open}
        idea={editing.idea}
        onClose={() => setEditing({ open: false, idea: null })}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`${he.common.delete}: ${toDelete?.title ?? ''}`}
        description={he.ideas.deleteText}
        confirmLabel={he.common.delete}
        destructive
        onConfirm={() => toDelete && void del.mutateAsync(toDelete.id)}
      />
    </main>
  )
}
