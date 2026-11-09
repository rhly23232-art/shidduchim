import { Check, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { fieldBase } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { he } from '@/lib/strings.he'
import type { CandidateRow, Gender } from '@/lib/types'
import { cn, fullName, hebrewCollator } from '@/lib/utils'

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
          fieldBase,
          'flex h-10 items-center justify-between gap-2 text-start',
          !selected && 'text-muted-foreground',
        )}
      >
        <span className="truncate">
          {selected
            ? `${fullName(selected)}${selected.age !== null ? ` · ${selected.age}` : ''}`
            : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-2">
        <Command loop>
          <CommandInput placeholder={he.nav.quickFind} />
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
                <span className="text-muted-foreground">{noneLabel}</span>
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
                  <span className="tabular shrink-0 text-caption text-muted-foreground">
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
