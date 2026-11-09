import { CheckCircle2, Lightbulb, Pencil, Pin, PinOff, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Avatar } from '@/components/ui/avatar'
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
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { useAppActions } from '@/features/workspace/appActions'
import { CandidatePicker, relativeTime } from '@/features/workspace/CandidatePicker'
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
          <Field
            label={he.ideas.titleLabel}
            required
            error={tried && !v.title.trim() ? he.validation.required : undefined}
          >
            {(id, aria) => (
              <Input
                id={id}
                {...aria}
                autoFocus
                value={v.title}
                maxLength={200}
                placeholder={he.ideas.titlePlaceholder}
                onChange={(e) => setV({ ...v, title: e.target.value })}
              />
            )}
          </Field>
          <Field label={he.ideas.body}>
            {(id, aria) => (
              <Textarea
                id={id}
                {...aria}
                rows={4}
                maxLength={4000}
                value={v.body ?? ''}
                onChange={(e) => setV({ ...v, body: e.target.value })}
              />
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
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
            <div className="flex flex-col gap-2">
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
          <Button variant="outline" onClick={onClose}>
            {he.common.cancel}
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={save.isPending}>
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
    <main id="main" className="space-y-6 px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-body text-muted-foreground">{he.ideas.subtitle}</p>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card role="status">
          <EmptyState
            icon={<Lightbulb />}
            tint="amber"
            title={he.ideas.empty}
            description={he.ideas.emptyText}
            action={
              <Button variant="primary" onClick={() => setEditing({ open: true, idea: null })}>
                <Plus />
                {he.ideas.new}
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((i) => {
            const m = i.male_id ? byId.get(i.male_id) : undefined
            const f = i.female_id ? byId.get(i.female_id) : undefined
            return (
              <li
                key={i.id}
                className={cn(
                  'flex flex-col rounded-lg border p-5 transition-colors duration-base',
                  i.done ? 'border-border bg-secondary' : i.pinned ? 'bg-tint-amber/40' : 'bg-card',
                  !i.done && (i.pinned ? 'border-tint-amber-strong/60' : 'border-border'),
                )}
              >
                <div className="flex items-start gap-2">
                  <h2
                    className={cn(
                      'flex-1 text-h4',
                      i.done ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}
                  >
                    {i.title}
                  </h2>
                  {i.pinned && (
                    <Badge tone="amber">
                      <Pin className="size-3" aria-hidden />
                      {he.ideas.pinned}
                    </Badge>
                  )}
                  {i.done && <Badge tone="success">{he.ideas.doneBadge}</Badge>}
                </div>
                {i.body && (
                  <p className="mt-2 whitespace-pre-line text-body text-muted-foreground">
                    {i.body}
                  </p>
                )}
                {(m || f) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[m, f].filter(Boolean).map((c) => (
                      <button
                        key={c!.id}
                        type="button"
                        onClick={() => actions.openCandidate(c!.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pe-3 ps-1 text-body-sm font-medium text-foreground transition-colors duration-fast hover:border-input-hover hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Avatar name={fullName(c!)} colorKey={c!.id} size="sm" className="size-6" />
                        {fullName(c!)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-1 pt-4">
                  <span className="tabular me-auto text-caption text-muted-foreground">
                    {relativeTime(i.updated_at)}
                  </span>
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
                      className="text-destructive hover:bg-destructive-soft hover:text-destructive"
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
