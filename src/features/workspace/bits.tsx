import { Check, ChevronDown, CircleDashed, CircleCheck, CircleX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { he } from '@/lib/strings.he'
import type { CandidateRow, Gender, ProposalStage, SideResponse } from '@/lib/types'
import { cn, fullName, hebrewCollator } from '@/lib/utils'

export const STAGE_TONE: Record<
  ProposalStage,
  'neutral' | 'navy' | 'gold' | 'success' | 'warning' | 'danger'
> = {
  idea: 'neutral',
  suggested: 'navy',
  checking: 'gold',
  meeting: 'warning',
  engaged: 'success',
  closed: 'danger',
}

/** Solid dot color per stage, used in the pipeline bar and board headers. */
export const STAGE_DOT: Record<ProposalStage, string> = {
  idea: 'bg-navy-200',
  suggested: 'bg-navy-700',
  checking: 'bg-gold-500',
  meeting: 'bg-warning',
  engaged: 'bg-success',
  closed: 'bg-danger/70',
}

export function StageBadge({ stage }: { stage: ProposalStage }) {
  return <Badge tone={STAGE_TONE[stage]}>{he.stage[stage]}</Badge>
}

export function ResponseChip({ side, response }: { side: Gender; response: SideResponse }) {
  const Icon =
    response === 'interested' ? CircleCheck : response === 'declined' ? CircleX : CircleDashed
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[12px]',
        response === 'interested' && 'text-success',
        response === 'declined' && 'text-danger',
        response === 'pending' && 'text-ink-muted',
      )}
      title={`${side === 'male' ? he.proposals.maleResponse : he.proposals.femaleResponse}: ${he.response[response]}`}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">
        {side === 'male' ? he.proposals.maleResponse : he.proposals.femaleResponse}:{' '}
      </span>
      {he.response[response]}
    </span>
  )
}

const DAY = 86_400_000
export function todayIso(): string {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
/** Whole days from today (negative = past). */
export function daysFromToday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date()
  const a = Date.UTC(y!, m! - 1, d!)
  const b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())
  return Math.round((a - b) / DAY)
}

export function relativeDay(iso: string): string {
  const n = daysFromToday(iso)
  if (n === 0) return he.proposals.today
  if (n === 1) return he.proposals.tomorrow
  if (n > 1) return he.proposals.inDays(n)
  return he.proposals.daysAgo(-n)
}

export function DueBadge({ date, done }: { date: string | null; done?: boolean }) {
  if (!date) return null
  const n = daysFromToday(date)
  const tone = done ? 'neutral' : n < 0 ? 'danger' : n === 0 ? 'gold' : 'neutral'
  return (
    <Badge tone={tone} className="tabular">
      {!done && n < 0 ? `${he.proposals.overdue} · ` : ''}
      {relativeDay(date)}
    </Badge>
  )
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60_000)
  if (min < 1) return 'עכשיו'
  if (min < 60) return `לפני ${min} דק׳`
  const h = Math.round(min / 60)
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`
  const d = Math.round(h / 24)
  if (d === 1) return 'אתמול'
  if (d < 30) return `לפני ${d} ימים`
  return new Date(iso).toLocaleDateString('he-IL')
}

/** Searchable single-select for a candidate of a given gender (or any). */
export function CandidatePicker({
  id,
  value,
  onChange,
  candidates,
  gender,
  placeholder,
  allowNone,
  noneLabel,
  invalid,
}: {
  id?: string
  value: string | null
  onChange: (id: string | null) => void
  candidates: CandidateRow[]
  gender?: Gender
  placeholder: string
  allowNone?: boolean
  noneLabel?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const options = useMemo(
    () =>
      candidates
        .filter((c) => !gender || c.gender === gender)
        .sort((a, b) => hebrewCollator.compare(fullName(a), fullName(b))),
    [candidates, gender],
  )
  const selected = value ? candidates.find((c) => c.id === value) : null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-start text-sm transition-colors hover:border-navy-200 focus-visible:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/35 aria-[invalid=true]:border-danger',
          !selected && 'text-ink-muted',
        )}
      >
        <span className="truncate">
          {selected
            ? `${fullName(selected)}${selected.age !== null ? ` · ${selected.age}` : ''}`
            : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-2">
        <Command loop>
          <CommandInput placeholder={he.match.pickPlaceholder} />
          <CommandList>
            <CommandEmpty>{he.filters.noOptions}</CommandEmpty>
            {allowNone && (
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                <span className="text-ink-muted">{noneLabel}</span>
              </CommandItem>
            )}
            {options.map((c) => (
              <CommandItem
                key={c.id}
                value={c.id}
                keywords={[fullName(c), c.city ?? '', c.institution ?? '']}
                onSelect={() => {
                  onChange(c.id)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn('size-4 shrink-0', value === c.id ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                  <span className="truncate">{fullName(c)}</span>
                  <span className="tabular shrink-0 text-xs text-ink-muted">
                    {[c.age, c.city].filter((x) => x !== null && x !== '').join(' · ')}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Accessible checkbox styled in the design system. */
export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1',
        checked
          ? 'border-success bg-success text-surface'
          : 'border-navy-200 bg-surface hover:border-navy-700',
        className,
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
    </button>
  )
}
