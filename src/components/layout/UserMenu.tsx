import { LifeBuoy, LogOut, Share2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SwitchAccountDialog } from '@/features/account/SwitchAccountDialog'
import { InviteDialog } from '@/features/share/InviteDialog'
import { SupportDialog } from '@/features/support/SupportDialog'
import { APP_VERSION } from '@/lib/log'
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
  const [dialog, setDialog] = useState<'switch' | 'support' | 'invite' | null>(null)
  if (!user) return null
  const dialogProps = (d: NonNullable<typeof dialog>) => ({
    open: dialog === d,
    onOpenChange: (o: boolean) => setDialog(o ? d : null),
  })
  const display = user.fullName || user.email || 'החשבון שלי'
  const initial = display.trim().charAt(0).toUpperCase()
  return (
    <>
      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger
          aria-label={he.header.userMenu}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-body font-semibold text-accent-foreground transition-colors duration-fast hover:bg-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {initial}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="space-y-1">
            <span className="block truncate text-body font-medium text-foreground">{display}</span>
            {user.fullName && (
              <span className="block truncate text-end" dir="ltr">
                {user.email}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog('switch')}>
            <UsersRound />
            {he.switchAccount.menu}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('support')}>
            <LifeBuoy />
            {he.supportCenter.menu}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('invite')}>
            <Share2 />
            {he.invite.menu}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="tabular py-1 text-caption" dir="ltr">
            {he.support.version(APP_VERSION)}
          </DropdownMenuLabel>
          {
            <DropdownMenuItem
              onSelect={() => {
                // Explicit logout: next login starts clean (no previous filters in the URL).
                void signOut().then(() => navigate('/login', { replace: true }))
              }}
            >
              <LogOut />
              {he.auth.logout}
            </DropdownMenuItem>
          }
        </DropdownMenuContent>
      </DropdownMenu>
      <SwitchAccountDialog {...dialogProps('switch')} />
      <SupportDialog {...dialogProps('support')} />
      {dialog === 'invite' && <InviteDialog {...dialogProps('invite')} />}
    </>
  )
}
