import { FlaskConical, Plus } from 'lucide-react'
import { useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useMeasureVar } from '@/hooks/useMeasureVar'
import { isDemoMode } from '@/lib/env'
import { he } from '@/lib/strings.he'
import { Logo } from './Logo'
import { SearchBox } from './SearchBox'
import { UserMenu } from './UserMenu'

interface Props {
  query: string
  onQueryChange: (q: string) => void
  onAdd: () => void
}

export function Header({ query, onQueryChange, onAdd }: Props) {
  const ref = useRef<HTMLElement>(null)
  useMeasureVar(ref, '--header-h')
  return (
    <header
      ref={ref}
      className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 md:flex-nowrap md:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          {isDemoMode && (
            <Tooltip content={he.app.demoTooltip}>
              <Badge tone="gold" tabIndex={0} className="cursor-help">
                <FlaskConical className="size-3" aria-hidden />
                {he.app.demoBadge}
              </Badge>
            </Tooltip>
          )}
        </div>
        <SearchBox
          value={query}
          onChange={onQueryChange}
          className="order-last w-full md:order-none md:mx-auto md:max-w-md md:flex-1"
        />
        <div className="ms-auto flex items-center gap-2 md:ms-0">
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
      </div>
    </header>
  )
}
