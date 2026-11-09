import { ChevronLeft, Lightbulb, UserRound, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { gregorianToHebrew } from '@/lib/hebrewDate'
import { AREA_TINT, TINTS, type TintName } from '@/lib/palette'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'

function HomeCard({
  to,
  title,
  text,
  icon,
  tint,
  wide,
}: {
  to: string
  title: string
  text: string
  icon: ReactNode
  tint: TintName
  wide?: boolean
}) {
  const t = TINTS[tint]
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex overflow-hidden rounded-lg border bg-card transition-[border-color,box-shadow] duration-base ease-out hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        t.border,
        t.hoverBorder,
        wide ? 'items-center gap-4 p-5' : 'min-h-56 flex-col gap-6 p-6 sm:min-h-64',
      )}
    >
      {/* soft tint wash — the card's identity color */}
      <span
        className={cn(
          'pointer-events-none absolute inset-0',
          wide ? cn(t.bg, 'opacity-70') : cn('bg-gradient-to-b via-card/60 to-card', t.wash),
        )}
        aria-hidden
      />
      <span
        className={cn(
          'relative grid size-12 shrink-0 place-items-center rounded-md bg-card shadow-sm [&_svg]:size-6',
          t.fg,
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className={cn('block text-foreground', wide ? 'text-h3' : 'text-h1')}>{title}</span>
        <span className="mt-1 block text-body text-muted-foreground">{text}</span>
      </span>
      <span
        className={cn(
          'relative flex items-center gap-1 text-body font-medium',
          t.fg,
          !wide && 'self-start',
        )}
        aria-hidden
      >
        {he.home.enter}
        <ChevronLeft className="size-4 transition-transform duration-fast group-hover:-translate-x-1" />
      </span>
    </Link>
  )
}

function todayLine(): string {
  const d = new Date()
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [he.home.weekdays[d.getDay()], gregorianToHebrew(iso)].filter(Boolean).join(' · ')
}

/** Main screen: בחורים (right) · בחורות (left), and a wide, short רעיונות card below. */
export default function HomePage() {
  const { user } = useAuth()
  const first = (user?.fullName ?? '').trim().split(/\s+/)[0] ?? ''
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 md:px-8 md:pt-10">
      <div className="mb-8">
        <p className="text-body-sm font-medium text-muted-foreground">{todayLine()}</p>
        <h2 className="mt-1 text-h1 text-foreground">{he.home.hello(first)}</h2>
        <p className="mt-1 text-body text-muted-foreground">{he.home.lead}</p>
      </div>
      <nav aria-label={he.home.title} className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        <HomeCard
          to="/candidates?tab=male"
          title={he.nav.males}
          text={he.home.malesText}
          icon={<UserRound />}
          tint={AREA_TINT.male}
        />
        <HomeCard
          to="/candidates?tab=female"
          title={he.nav.females}
          text={he.home.femalesText}
          icon={<Users />}
          tint={AREA_TINT.female}
        />
        <div className="sm:col-span-2">
          <HomeCard
            to="/ideas"
            title={he.nav.ideas}
            text={he.home.ideasText}
            icon={<Lightbulb />}
            tint={AREA_TINT.ideas}
            wide
          />
        </div>
      </nav>
    </main>
  )
}
