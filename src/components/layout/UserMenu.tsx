import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth'
import { he } from '@/lib/strings.he'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  if (!user) return null
  const display = user.fullName || user.email
  const initial = display.trim().charAt(0).toUpperCase()
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger
        aria-label={he.header.userMenu}
        className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface font-heading text-base font-bold text-navy-900 shadow-sm transition-colors hover:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate text-sm font-medium text-ink">{display}</span>
          {user.fullName && (
            <span className="block truncate" dir="ltr" style={{ textAlign: 'right' }}>
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            // Explicit logout: next login starts clean (no previous filters in the URL).
            void signOut().then(() => navigate('/login', { replace: true }))
          }}
        >
          <LogOut />
          {he.auth.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
