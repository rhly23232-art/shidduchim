import { HDate, gematriya } from '@hebcal/core'
import { useEffect, useMemo, useState } from 'react'
import { NativeSelect } from '@/components/ui/input'
import { he } from '@/lib/strings.he'

/** Hebrew month ids (hebcal numbering) in calendar order from Tishrei. */
function monthsOf(year: number): { id: number; name: string }[] {
  const leap = HDate.isLeapYear(year)
  return [
    { id: 7, name: 'תשרי' },
    { id: 8, name: 'חשון' },
    { id: 9, name: 'כסלו' },
    { id: 10, name: 'טבת' },
    { id: 11, name: 'שבט' },
    ...(leap
      ? [
          { id: 12, name: 'אדר א׳' },
          { id: 13, name: 'אדר ב׳' },
        ]
      : [{ id: 12, name: 'אדר' }]),
    { id: 1, name: 'ניסן' },
    { id: 2, name: 'אייר' },
    { id: 3, name: 'סיון' },
    { id: 4, name: 'תמוז' },
    { id: 5, name: 'אב' },
    { id: 6, name: 'אלול' },
  ]
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function fromIso(iso: string): { d: number; m: number; y: number } | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null
  const h = new HDate(date)
  return { d: h.getDate(), m: h.getMonth(), y: h.getFullYear() }
}

interface Props {
  /** Gregorian ISO date (yyyy-mm-dd) or '' — the single source of truth. */
  value: string
  onChange: (iso: string) => void
  idPrefix: string
}

/**
 * Pick the birth date in the Hebrew calendar (day · month · year, in Hebrew letters).
 * It writes the matching Gregorian date, and follows it when the Gregorian date is edited.
 */
export function HebrewDatePicker({ value, onChange, idPrefix }: Props) {
  const thisYear = new HDate().getFullYear()
  const years = useMemo(() => Array.from({ length: 60 }, (_, i) => thisYear - 14 - i), [thisYear])
  const [d, setD] = useState<number | ''>('')
  const [m, setM] = useState<number | ''>('')
  const [y, setY] = useState<number | ''>('')

  // Follow the Gregorian value (typed below, or loaded when editing).
  useEffect(() => {
    const h = value ? fromIso(value) : null
    if (h) {
      setD(h.d)
      setM(h.m)
      setY(h.y)
    } else if (!value) {
      setD('')
      setM('')
      setY('')
    }
  }, [value])

  const commit = (nd: number | '', nm: number | '', ny: number | '') => {
    setD(nd)
    setM(nm)
    setY(ny)
    if (nd === '' || nm === '' || ny === '') return
    // Adar II exists only in leap years; days past the month's end are clamped.
    const month = nm === 13 && !HDate.isLeapYear(ny) ? 12 : nm
    const day = Math.min(nd, HDate.daysInMonth(month, ny))
    onChange(toIso(new HDate(day, month, ny).greg()))
  }

  const months = monthsOf(typeof y === 'number' ? y : thisYear - 20)
  return (
    <div
      className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-2"
      role="group"
      aria-label={he.form.hebrewBirthDate}
    >
      <NativeSelect
        id={`${idPrefix}-day`}
        aria-label={he.form.hebrewDay}
        value={d}
        onChange={(e) => commit(e.target.value ? Number(e.target.value) : '', m, y)}
      >
        <option value="">{he.form.hebrewDay}</option>
        {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {gematriya(n)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        id={`${idPrefix}-month`}
        aria-label={he.form.hebrewMonth}
        value={m}
        onChange={(e) => commit(d, e.target.value ? Number(e.target.value) : '', y)}
      >
        <option value="">{he.form.hebrewMonth}</option>
        {months.map((mo) => (
          <option key={mo.id} value={mo.id}>
            {mo.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        id={`${idPrefix}-year`}
        aria-label={he.form.hebrewYear}
        value={y}
        onChange={(e) => commit(d, m, e.target.value ? Number(e.target.value) : '')}
      >
        <option value="">{he.form.hebrewYear}</option>
        {years.map((yr) => (
          <option key={yr} value={yr}>
            {gematriya(yr)}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
