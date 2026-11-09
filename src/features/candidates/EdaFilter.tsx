import { useEffect, useState } from 'react'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { FilterChevron, filterTriggerClass } from '@/components/ui/filter-trigger'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDebounced } from '@/hooks/useDebounced'
import { EDA_KEYS, type EdaKey } from '@/lib/eda'
import { he } from '@/lib/strings.he'

interface Props {
  eda: EdaKey | null
  text: string
  onChange: (eda: EdaKey | null, text: string) => void
}

const EDA_OPTIONS = EDA_KEYS.map((k) => ({ value: k, label: he.eda[k] }))

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
      <ChoiceGroup
        className="grid-cols-2"
        size="sm"
        label={he.filters.community}
        options={EDA_OPTIONS}
        value={eda}
        allowDeselect
        onChange={(k) => onChange(k, '')}
      />
      {needsText && (
        <div className="space-y-2">
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
      <PopoverTrigger className={filterTriggerClass(!!active, 'max-w-64')}>
        <span className="truncate">
          {active ? `${he.filters.community}: ${active}` : he.filters.community}
        </span>
        <FilterChevron open={open} />
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
      <legend className="mb-2 text-label text-foreground">{he.filters.community}</legend>
      <ChoiceGroup
        className="grid-cols-2 sm:grid-cols-4"
        label={he.filters.community}
        options={EDA_OPTIONS}
        value={eda}
        allowDeselect
        onChange={onEda}
      />
      {needsText && (
        <div className="flex flex-col gap-2 pt-1">
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
