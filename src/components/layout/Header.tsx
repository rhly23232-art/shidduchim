import { Menu, Plus, Search } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useMeasureVar } from '@/hooks/useMeasureVar'
import { he } from '@/lib/strings.he'
import { UserMenu } from './UserMenu'

interface Props {
  title: string
  onMenu: () => void
  onSearch: () => void
  onAdd: () => void
}

export function Header({ title, onMenu, onSearch, onAdd }: Props) {
  const ref = useRef<HTMLElement>(null)
  useMeasureVar(ref, '--header-h')
  return (
    <header
      ref={ref}
      className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85"
    >
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenu}
          aria-label={he.nav.open}
        >
          <Menu className="!size-5" />
        </Button>
        <h1 className="min-w-0 truncate text-xl font-bold text-navy-900 md:text-2xl">{title}</h1>
        <button
          type="button"
          onClick={onSearch}
          className="ms-auto flex h-10 items-center gap-2 rounded-full border border-line bg-cream-50 px-3 text-sm text-ink-muted transition-colors hover:border-navy-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 md:w-72"
          aria-label={he.palette.title}
        >
          <Search className="size-4" aria-hidden />
          <span className="hidden flex-1 text-start md:inline">{he.nav.quickFind}</span>
          <kbd
            className="hidden rounded border border-line bg-surface px-1.5 font-sans text-[11px] text-ink-muted md:inline"
            dir="ltr"
          >
            Ctrl K
          </kbd>
        </button>
        <Button
          variant="primary"
          onClick={onAdd}
          className="max-sm:px-3"
          aria-label={he.header.addCandidate}
        >
          <Plus />
          <span className="max-sm:sr-only">{he.header.addCandidate}</span>
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}
