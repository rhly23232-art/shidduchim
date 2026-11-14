import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore, type DragEvent } from 'react'
import { toast } from 'sonner'
import { qk, useSaveCandidate } from '@/hooks/useCandidates'
import { dataApi } from '@/lib/api'
import { isConflict } from '@/lib/api/errors'
import { payloadOf } from '@/lib/candidatePayload'
import { he } from '@/lib/strings.he'
import type { CandidateRow, Gender } from '@/lib/types'
import { errorMessage, fullName } from '@/lib/utils'

/**
 * Moving a candidate that was entered in the wrong table (בחור ↔ בחורה):
 * drag a row onto the opposite tab / sidebar item, or use the row menu.
 */

const MIME = 'application/x-shidduchim-candidate'

// ---------- shared drag state (rows ↔ drop targets in other components) ----------
interface DragState {
  /** the row being dragged */
  row: CandidateRow | null
  /** a target that just received a candidate (short highlight) */
  flash: Gender | null
}
let state: DragState = { row: null, flash: null }
const subs = new Set<() => void>()
const set = (patch: Partial<DragState>) => {
  state = { ...state, ...patch }
  subs.forEach((fn) => fn())
}
const subscribe = (fn: () => void) => {
  subs.add(fn)
  return () => subs.delete(fn)
}
const useDragState = () => useSyncExternalStore(subscribe, () => state)

export const otherGender = (g: Gender): Gender => (g === 'male' ? 'female' : 'male')

let flashTimer: ReturnType<typeof setTimeout> | undefined
const flash = (g: Gender) => {
  clearTimeout(flashTimer)
  set({ flash: g })
  flashTimer = setTimeout(() => set({ flash: null }), 1400)
}

/** Changes the candidate's gender (full save, so history records it), with an undo. */
export function useMoveCandidate() {
  const save = useSaveCandidate()
  const { mutateAsync } = save
  const qc = useQueryClient()
  // instant feedback: the row leaves its table right away (rolled back if the save fails)
  const patchGender = useCallback(
    (id: string, gender: Gender) =>
      qc.setQueryData<{ rows: CandidateRow[]; overLimit: boolean }>(qk.list, (old) =>
        old ? { ...old, rows: old.rows.map((r) => (r.id === id ? { ...r, gender } : r)) } : old,
      ),
    [qc],
  )

  const move = useCallback(
    async (row: CandidateRow, to: Gender, opts: { undo?: boolean } = {}): Promise<boolean> => {
      if (row.gender === to) return false
      const name = fullName(row)
      patchGender(row.id, to)
      try {
        const full = await dataApi.getCandidate(row.id)
        if (!full) throw new Error(he.detail.notFound)
        const payload = payloadOf(full, full.id, full.updated_at)
        payload.candidate.gender = to
        await mutateAsync(payload)
        flash(to)
        if (opts.undo) {
          toast.success(he.move.undone, { description: name })
        } else {
          toast.success(he.move.moved(name, to), {
            description: he.move.movedHint,
            action: {
              label: he.move.undo,
              onClick: () => void move({ ...row, gender: to }, row.gender, { undo: true }),
            },
          })
        }
        return true
      } catch (e) {
        patchGender(row.id, row.gender)
        void qc.invalidateQueries({ queryKey: qk.all })
        toast.error(he.move.failed, {
          description: isConflict(e) ? he.move.conflict : errorMessage(e),
        })
        return false
      }
    },
    [mutateAsync, patchGender, qc],
  )
  return { move, pending: save.isPending }
}

// ---------- drag source (table row / card) ----------
/** Props that make a row draggable to the opposite table. */
export function rowDragProps(row: CandidateRow) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      // let buttons / links inside the row keep their own behavior
      if ((e.target as HTMLElement).closest?.('button, a, input')) {
        e.preventDefault()
        return
      }
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData(MIME, row.id)
      e.dataTransfer.setData('text/plain', fullName(row))
      const ghost = dragGhost(fullName(row), otherGender(row.gender))
      e.dataTransfer.setDragImage(ghost, 16, 16)
      setTimeout(() => ghost.remove(), 0)
      set({ row })
    },
    onDragEnd: () => {
      overTarget = null
      overSubs.forEach((fn) => fn())
      set({ row: null })
    },
  }
}

function dragGhost(name: string, to: Gender): HTMLElement {
  const el = document.createElement('div')
  el.dir = 'rtl'
  el.textContent = `${name} ← ${he.move.target(to)}`
  Object.assign(el.style, {
    position: 'fixed',
    top: '-1000px',
    insetInlineStart: '0',
    padding: '6px 14px',
    borderRadius: '999px',
    font: '500 14px Heebo, system-ui, sans-serif',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--brand))',
    boxShadow: '0 6px 18px rgb(0 0 0 / 0.12)',
    whiteSpace: 'nowrap',
  })
  document.body.appendChild(el)
  return el
}

// ---------- drop target (tab / sidebar item) ----------
export type DropState = 'idle' | 'available' | 'over' | 'flash'

/** Drop handlers + visual state for the בחורים / בחורות targets. */
export function useGenderDropTarget(gender: Gender) {
  const s = useDragState()
  const { move } = useMoveCandidate()
  const valid = !!s.row && s.row.gender !== gender
  const [over, setOver] = useOver(gender)

  const props = {
    onDragEnter: (e: DragEvent) => {
      if (!valid) return
      e.preventDefault()
      setOver(true)
    },
    onDragOver: (e: DragEvent) => {
      if (!valid) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (!over) setOver(true)
    },
    onDragLeave: (e: DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      setOver(false)
    },
    onDrop: (e: DragEvent) => {
      setOver(false)
      const row = s.row
      if (!valid || !row || e.dataTransfer.getData(MIME) !== row.id) return
      e.preventDefault()
      set({ row: null })
      void move(row, gender)
    },
  }
  const dropState: DropState =
    s.flash === gender ? 'flash' : valid ? (over ? 'over' : 'available') : 'idle'
  return { props, state: dropState }
}

// which target the pointer is over (one at a time)
let overTarget: Gender | null = null
const overSubs = new Set<() => void>()
function useOver(g: Gender): [boolean, (v: boolean) => void] {
  const cur = useSyncExternalStore(
    (fn) => {
      overSubs.add(fn)
      return () => overSubs.delete(fn)
    },
    () => overTarget,
  )
  const setOver = (v: boolean) => {
    const next = v ? g : overTarget === g ? null : overTarget
    if (next === overTarget) return
    overTarget = next
    overSubs.forEach((fn) => fn())
  }
  return [cur === g, setOver]
}

/** Tailwind classes for a drop target in each state. */
export const dropClasses: Record<DropState, string> = {
  idle: '',
  available: 'outline-dashed outline-2 outline-offset-2 outline-brand/50',
  over: 'outline outline-2 outline-offset-2 outline-brand bg-accent text-accent-foreground scale-[1.04] shadow-sm',
  flash: 'outline outline-2 outline-offset-2 outline-success animate-drop-flash',
}
