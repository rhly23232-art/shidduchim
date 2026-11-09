import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDebounced } from '@/hooks/useDebounced'
import { EDA_KEYS, type EdaKey } from '@/lib/eda'
import { he } from '@/lib/strings.he'
import { cn } from '@/lib/utils'

interface Props {
  eda: EdaKey | null
  text: string
  onChange: (eda: EdaKey | null, text: string) => void
}

/** Label for chips / the trigger: "עדה: עדות מזרח · מרוקאי". */
export function edaLabel(eda: EdaKey | null, text: string): string | null {
  if (!eda) return null
  const t = text.trim()
  return t ? `${he.eda[eda]} · ${t}` : he.eda[eda]
}

/** The 4 options + a typing box for עדות מזרח (מוצא), חסידות (שם החסידות) and אחר (חופשי). */
export function EdaControl({ eda, text, onChange }: Props) {
  const [draft, setDraft] = useState(text)
  const debounced = useDebounced(draft, 250)

  useEffect(() => setDraft(text), [text, eda])
  useEffect(() => {
    if (eda && debounced !== text) onChange(eda, debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to typing
  }, [debounced])

  const needsText = eda === 'mizrah' || eda === 'chasidut' || eda === 'other'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={he.filters.community}>
        {EDA_KEYS.map((k) => {
          const on = eda === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : k, '')}
              className={cn(
                'h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
                on
                  ? 'border-navy-900 bg-navy-900 text-surface'
                  : 'border-line bg-surface text-navy-900 hover:border-navy-200 hover:bg-navy-50',
              )}
            >
              {he.eda[k]}
            </button>
          )
        })}
      </div>
      {needsText && (
        <div className="space-y-1.5">
          <Label htmlFor="eda-text">{he.eda.inputLabel[eda]}</Label>
          <Input
            id="eda-text"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            placeholder={he.eda.placeholder[eda]}
            className="h-9"
          />
        </div>
      )}
    </div>
  )
}

export function EdaFilter(props: Props) {
  const [open, setOpen] = useState(false)
  const active = edaLabel(props.eda, props.text)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex h-9 max-w-[16rem] items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1',
          active
            ? 'border-navy-900 bg-navy-900 text-surface hover:bg-navy-800'
            : 'border-line bg-surface text-navy-900 hover:border-navy-200 hover:bg-navy-50',
        )}
      >
        <span className="truncate">
          {active ? `${he.filters.community}: ${active}` : he.filters.community}
        </span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 opacity-70 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3">
        <EdaControl {...props} />
      </PopoverContent>
    </Popover>
  )
}

/** Form version (candidate details): same 4 options, the typed detail is saved with the candidate. */
export function EdaPicker({
  eda,
  detail,
  onEda,
  onDetail,
  detailList,
}: {
  eda: EdaKey | null
  detail: string
  onEda: (eda: EdaKey | null) => void
  onDetail: (v: string) => void
  detailList?: string
}) {
  const needsText = eda === 'mizrah' || eda === 'chasidut' || eda === 'other'
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-[13px] font-medium">{he.filters.community}</legend>
      <div
        className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
        role="radiogroup"
        aria-label={he.filters.community}
      >
        {EDA_KEYS.map((k) => {
          const on = eda === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onEda(on ? null : k)}
              className={cn(
                'h-10 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
                on
                  ? 'border-navy-900 bg-navy-900 text-surface'
                  : 'border-line bg-surface text-navy-900 hover:border-navy-200 hover:bg-navy-50',
              )}
            >
              {he.eda[k]}
            </button>
          )
        })}
      </div>
      {needsText && (
        <div className="flex flex-col gap-1.5 pt-1">
          <Label htmlFor="form-eda-detail">{he.eda.inputLabel[eda]}</Label>
          <Input
            id="form-eda-detail"
            value={detail}
            list={detailList}
            maxLength={60}
            onChange={(e) => onDetail(e.target.value)}
            placeholder={he.eda.placeholder[eda]}
          />
        </div>
      )}
    </fieldset>
  )
}
