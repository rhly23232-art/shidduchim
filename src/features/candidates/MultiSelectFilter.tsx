import { useState } from 'react'
import { CheckboxIndicator } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { FilterChevron, FilterCount, filterTriggerClass } from '@/components/ui/filter-trigger'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ListKey } from '@/hooks/useFilters'
import { he } from '@/lib/strings.he'

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
        className={filterTriggerClass(count > 0, className)}
        aria-label={count ? `${label} — ${he.filters.selectedCount(count)}` : label}
      >
        {label}
        {count > 0 && <FilterCount value={count} />}
        <FilterChevron open={open} />
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
                        <CheckboxIndicator checked={checked} />
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
          <div className="mt-1 border-t border-border pt-2">
            <button
              type="button"
              onClick={() => groups.forEach((g) => g.selected.length && onChange(g.key, []))}
              className="w-full rounded-md px-2 py-2 text-start text-body-sm font-medium text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {he.filters.clearSelection}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
