import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RangeSlider } from '@/components/ui/slider'
import { useDebounced } from '@/hooks/useDebounced'
import { AGE_MAX, AGE_MIN } from '@/lib/age'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'

interface Props {
  min: number
  max: number
  onChange: (min: number, max: number) => void
}

export function ageLabel(min: number, max: number): string | null {
  if (min === AGE_MIN && max === AGE_MAX) return null
  if (max === AGE_MAX) return he.filters.ageMinChip(min)
  if (min === AGE_MIN) return he.filters.ageMaxChip(max)
  return he.filters.ageChip(min, max)
}

/** Dual slider (instant) + min/max number inputs (debounced 250ms). */
export function AgeRangeControl({ min, max, onChange }: Props) {
  const [lo, setLo] = useState(String(min))
  const [hi, setHi] = useState(String(max))
  const dLo = useDebounced(lo, 250)
  const dHi = useDebounced(hi, 250)

  useEffect(() => {
    setLo(String(min))
    setHi(String(max))
  }, [min, max])

  useEffect(() => {
    const a = Number(dLo)
    const b = Number(dHi)
    if (!Number.isFinite(a) || !Number.isFinite(b) || dLo === '' || dHi === '') return
    const ca = Math.min(AGE_MAX, Math.max(AGE_MIN, Math.round(a)))
    const cb = Math.min(AGE_MAX, Math.max(AGE_MIN, Math.round(b)))
    if (ca !== min || cb !== max) onChange(ca, cb)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typed values
  }, [dLo, dHi])

  const commitBlur = () => {
    setLo(String(min))
    setHi(String(max))
  }

  return (
    <div className="space-y-4">
      <RangeSlider
        min={AGE_MIN}
        max={AGE_MAX}
        step={1}
        minStepsBetweenThumbs={0}
        value={[min, max]}
        onValueChange={([a, b]) => onChange(a!, b!)}
        thumbLabels={[he.filters.ageFrom, he.filters.ageTo]}
      />
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="age-min">{he.filters.ageFrom}</Label>
          <Input
            id="age-min"
            type="number"
            inputMode="numeric"
            min={AGE_MIN}
            max={AGE_MAX}
            value={lo}
            onChange={(e) => setLo(e.target.value)}
            onBlur={commitBlur}
            className="tabular h-9 text-center"
          />
        </div>
        <span className="pb-2 text-ink-muted" aria-hidden>
          –
        </span>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="age-max">{he.filters.ageTo}</Label>
          <Input
            id="age-max"
            type="number"
            inputMode="numeric"
            min={AGE_MIN}
            max={AGE_MAX}
            value={hi}
            onChange={(e) => setHi(e.target.value)}
            onBlur={commitBlur}
            className="tabular h-9 text-center"
          />
        </div>
      </div>
    </div>
  )
}

export function AgeFilter(props: Props) {
  const [open, setOpen] = useState(false)
  const active = ageLabel(props.min, props.max)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1',
          active
            ? 'border-navy-900 bg-navy-900 text-surface hover:bg-navy-800'
            : 'border-line bg-surface text-navy-900 hover:border-navy-200 hover:bg-navy-50',
        )}
      >
        <span className="tabular">{active ?? he.filters.age}</span>
        <ChevronDown
          className={cn('size-3.5 opacity-70 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4">
        <p className="mb-3 text-sm font-semibold text-navy-900">
          {he.filters.age}
          <span className="tabular ms-2 font-normal text-ink-muted">
            {props.min}–{props.max === AGE_MAX ? `${AGE_MAX}+` : props.max}
          </span>
        </p>
        <AgeRangeControl {...props} />
      </PopoverContent>
    </Popover>
  )
}
