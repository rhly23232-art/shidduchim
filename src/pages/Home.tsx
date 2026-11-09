import { ChevronLeft, Lightbulb, UserRound, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'

function HomeCard({
  to,
  title,
  text,
  icon,
  wide,
}: {
  to: string
  title: string
  text: string
  icon: ReactNode
  wide?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex rounded-lg border border-border bg-card transition-[border-color,box-shadow] duration-base ease-out hover:border-input-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        wide ? 'items-center gap-4 p-5' : 'min-h-56 flex-col gap-6 p-6 sm:min-h-64',
      )}
    >
      <span
        className="grid size-12 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground [&_svg]:size-6"
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-foreground', wide ? 'text-h3' : 'text-h1')}>{title}</span>
        <span className="mt-1 block text-body text-muted-foreground">{text}</span>
      </span>
      <span
        className={cn(
          'flex items-center gap-1 text-body font-medium text-primary',
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

/** Main screen: בחורים (right) · בחורות (left), and a wide, short רעיונות card below. */
export default function HomePage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 md:px-8 md:pt-10">
      <nav aria-label={he.home.title} className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        <HomeCard
          to="/candidates?tab=male"
          title={he.nav.males}
          text={he.home.malesText}
          icon={<UserRound />}
        />
        <HomeCard
          to="/candidates?tab=female"
          title={he.nav.females}
          text={he.home.femalesText}
          icon={<Users />}
        />
        <div className="sm:col-span-2">
          <HomeCard
            to="/ideas"
            title={he.nav.ideas}
            text={he.home.ideasText}
            icon={<Lightbulb />}
            wide
          />
        </div>
      </nav>
    </main>
  )
}
