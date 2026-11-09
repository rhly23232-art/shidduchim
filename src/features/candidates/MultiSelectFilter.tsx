import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ListKey } from '@/hooks/useFilters'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'

export interface OptionGroup {
  key: ListKey
  heading?: string
  options: string[]
  selected: string[]
}

interface Props {
  label: string
  groups: OptionGroup[]
  onChange: (key: ListKey, values: string[]) => void
  className?: string
}

/** Searchable multi-select (combobox) with optional groups, e.g. ערים / אזורים. */
export function MultiSelectFilter({ label, groups, onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const count = groups.reduce((n, g) => n + g.selected.length, 0)
  const toggle = (g: OptionGroup, opt: string) => {
    const next = g.selected.includes(opt)
      ? g.selected.filter((x) => x !== opt)
      : [...g.selected, opt]
    onChange(g.key, next)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1',
          count
            ? 'border-navy-900 bg-navy-900 text-surface hover:bg-navy-800'
            : 'border-line bg-surface text-navy-900 hover:border-navy-200 hover:bg-navy-50',
          className,
        )}
        aria-label={count ? `${label} — ${he.filters.selectedCount(count)}` : label}
      >
        {label}
        {count > 0 && (
          <span className="tabular grid min-w-5 place-items-center rounded-full bg-gold-500 px-1 text-[11px] font-bold leading-5 text-navy-900">
            {count}
          </span>
        )}
        <ChevronDown
          className={cn('size-3.5 opacity-70 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <Command loop>
          <CommandInput
            placeholder={he.filters.searchOption}
            aria-label={`${he.common.search} ${label}`}
          />
          <CommandList>
            <CommandEmpty>{he.filters.noOptions}</CommandEmpty>
            {groups.map((g) =>
              g.options.length === 0 ? null : (
                <CommandGroup key={g.key} heading={g.heading}>
                  {g.options.map((opt) => {
                    const checked = g.selected.includes(opt)
                    return (
                      <CommandItem
                        key={opt}
                        value={`${g.key}:${opt}`}
                        keywords={[opt]}
                        onSelect={() => toggle(g, opt)}
                        aria-checked={checked}
                        role="option"
                      >
                        <span
                          className={cn(
                            'grid size-4 shrink-0 place-items-center rounded border transition-colors',
                            checked
                              ? 'border-navy-900 bg-navy-900 text-surface'
                              : 'border-navy-200 bg-surface',
                          )}
                          aria-hidden
                        >
                          {checked && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className="truncate">{opt}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ),
            )}
          </CommandList>
        </Command>
        {count > 0 && (
          <div className="mt-1 border-t border-line pt-2">
            <button
              type="button"
              onClick={() => groups.forEach((g) => g.selected.length && onChange(g.key, []))}
              className="w-full rounded-lg px-2 py-1.5 text-start text-[13px] font-medium text-navy-800 hover:bg-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              {he.filters.clearSelection}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
