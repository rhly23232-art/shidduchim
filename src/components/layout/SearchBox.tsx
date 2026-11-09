import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDebounced } from '@/hooks/useDebounced'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (q: string) => void
  className?: string
}

/** Free-text search: local state for instant typing, URL updated after 250ms. */
export function SearchBox({ value, onChange, className }: Props) {
  const [text, setText] = useState(value)
  const debounced = useDebounced(text, 250)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastPushed = useRef(value)

  // External changes (reset, back/forward) win over local text.
  useEffect(() => {
    if (value !== lastPushed.current) {
      lastPushed.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    if (debounced !== lastPushed.current) {
      lastPushed.current = debounced
      onChange(debounced)
    }
  }, [debounced, onChange])

  // "/" focuses search (common power-user shortcut)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (
        e.key === '/' &&
        !e.metaKey &&
        !e.ctrlKey &&
        t &&
        !/input|textarea|select/i.test(t.tagName) &&
        !t.isContentEditable
      ) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div role="search" className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && text) {
            e.stopPropagation()
            setText('')
          }
        }}
        placeholder={he.header.searchPlaceholder}
        aria-label={he.header.searchLabel}
        className="h-10 w-full rounded-full border border-line bg-cream-50 pe-9 ps-9 text-sm text-ink transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink-muted/75 hover:border-navy-200 focus-visible:border-gold-500 focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/35 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('')
            inputRef.current?.focus()
          }}
          aria-label={he.header.clearSearch}
          className="absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
