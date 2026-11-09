import { House, Lightbulb, Palette, UserRound, Users, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AREA_TINT, type TintName } from '@/lib/palette'
import { he } from '@/lib/strings.he'

export interface Area {
  title: string
  tint: TintName
  icon: ReactNode
}

/** The current area of the app: title, identity color and icon (shown in the header). */
export function useArea(): Area {
  const { pathname, search } = useLocation()
  if (pathname === '/' || pathname === '')
    return { title: he.home.title, tint: AREA_TINT.home, icon: <House /> }
  if (pathname.startsWith('/ideas'))
    return { title: he.nav.ideas, tint: AREA_TINT.ideas, icon: <Lightbulb /> }
  if (pathname.startsWith('/design-system'))
    return { title: he.ds.title, tint: 'rose', icon: <Palette /> }
  const tab = new URLSearchParams(search).get('tab')
  if (tab === 'female') return { title: he.tabs.female, tint: AREA_TINT.female, icon: <Users /> }
  if (tab === 'all') return { title: he.tabs.allTitle, tint: AREA_TINT.all, icon: <UsersRound /> }
  return { title: he.tabs.male, tint: AREA_TINT.male, icon: <UserRound /> }
}
