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
        'group relative flex overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
        wide
          ? 'min-h-[6.5rem] items-center gap-5 px-6 py-5'
          : 'min-h-[15rem] flex-col justify-between p-7 sm:min-h-[18rem]',
      )}
    >
      {/* gold accent along the start edge */}
      <span className="absolute inset-y-0 start-0 w-1 bg-gold-500/80" aria-hidden />
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-2xl bg-navy-900 text-gold-300 transition-colors group-hover:bg-navy-800',
          wide ? 'size-14 [&_svg]:size-7' : 'size-16 [&_svg]:size-8',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className={cn('min-w-0', wide && 'flex-1')}>
        <span
          className={cn(
            'block font-heading font-bold text-navy-900',
            wide ? 'text-2xl' : 'text-3xl sm:text-4xl',
          )}
        >
          {title}
        </span>
        <span className="mt-1.5 block text-[15px] text-ink-muted">{text}</span>
      </span>
      <span
        className={cn(
          'flex items-center gap-1 text-sm font-semibold text-navy-800 transition-transform duration-200 group-hover:-translate-x-1',
          !wide && 'self-end',
        )}
        aria-hidden
      >
        {he.home.enter}
        <ChevronLeft className="size-4" />
      </span>
    </Link>
  )
}

/** Main screen: בחורים (right) · בחורות (left), and a wide, short רעיונות card below. */
export default function HomePage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
      <nav aria-label={he.home.title} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
