import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { EdaPicker } from './EdaFilter'
import { useSaveCandidate } from '@/hooks/useCandidates'
import { isConflict } from '@/lib/api/errors'
import { ageFromBirthDate } from '@/lib/age'
import { gregorianToHebrew } from '@/lib/hebrewDate'
import { he } from '@/lib/strings.he'
import { CANDIDATE_STATUSES, type CandidateFull, type Gender } from '@/lib/types'
import { cn, errorMessage, fullName } from '@/lib/utils'
import { HebrewDatePicker } from './HebrewDatePicker'
import {
  candidateFormSchema,
  candidateToFormValues,
  emptyFormValues,
  formValuesToPayload,
  type CandidateFormValues,
} from '@/lib/validators'

export interface FormSuggestions {
  cities: string[]
  regions: string[]
  communities: string[]
  chassidut: string[]
  institutionsMale: string[]
  institutionsFemale: string[]
}

interface Props {
  open: boolean
  /** null → create */
  candidate: CandidateFull | null
  defaultGender: Gender
  suggestions: FormSuggestions
  onOpenChange: (open: boolean) => void
  onSaved: (id: string, gender: Gender, created: boolean) => void
}

const t = he.form

type SectionId = 'personal' | 'education' | 'extra' | 'notes'

function FormSection({
  id,
  title,
  children,
}: {
  id: SectionId
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={`form-${id}`}
      data-section={id}
      aria-labelledby={`form-${id}-h`}
      className="scroll-mt-4 space-y-4 border-t border-border pt-8 first:border-t-0 first:pt-0"
    >
      <h3 id={`form-${id}-h`} className="text-h3 text-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Tree-style collapsible group inside "מידע נוסף". */
function Collapsible({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-card">
      <h4>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          className="flex w-full items-center gap-2 rounded-md px-4 py-3 text-start text-h4 text-foreground transition-colors duration-fast hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-base',
              open && '-rotate-90',
            )}
            aria-hidden
          />
          {title}
        </button>
      </h4>
      {open && (
        <div id={`${id}-panel`} className="space-y-4 border-t border-border px-4 pb-4 pt-4">
          {children}
        </div>
      )}
    </div>
  )
}

const Grid = ({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) => (
  <div className={cn('grid grid-cols-1 gap-4', cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
    {children}
  </div>
)

const hasExtra = (c: CandidateFull | null) =>
  !!c &&
  (c.in_laws.length > 0 ||
    !!c.character_description ||
    !!c.desired_home_style ||
    !!c.special_requirements ||
    (!!c.family && Object.values(c.family).some((v) => v !== null && v !== '')))

export function CandidateForm({
  open,
  candidate,
  defaultGender,
  suggestions,
  onOpenChange,
  onSaved,
}: Props) {
  const save = useSaveCandidate()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: emptyFormValues(defaultGender),
    mode: 'onTouched',
  })
  const { register, control, formState, handleSubmit, reset, getFieldState, setValue, getValues } =
    form
  const education = useFieldArray({ control, name: 'education_history' })
  const inLaws = useFieldArray({ control, name: 'in_laws' })
  const [extraOn, setExtraOn] = useState(false)
  const [familyOpen, setFamilyOpen] = useState(true)
  const [traitsOpen, setTraitsOpen] = useState(true)
  const [active, setActive] = useState<SectionId>('personal')

  useEffect(() => {
    if (open) {
      reset(candidate ? candidateToFormValues(candidate) : emptyFormValues(defaultGender))
      setExtraOn(hasExtra(candidate))
      setFamilyOpen(true)
      setTraitsOpen(true)
      setActive('personal')
      scrollRef.current?.scrollTo({ top: 0 })
    }
  }, [open, candidate, defaultGender, reset])

  // Highlight the section being viewed in the steps bar.
  const onScroll = () => {
    const box = scrollRef.current
    if (!box) return
    const sections = [...box.querySelectorAll<HTMLElement>('[data-section]')]
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) {
      setActive((sections.at(-1)?.dataset.section as SectionId) ?? 'personal')
      return
    }
    const top = box.getBoundingClientRect().top + 72
    let current: SectionId = 'personal'
    for (const el of sections)
      if (el.getBoundingClientRect().top <= top) current = el.dataset.section as SectionId
    setActive(current)
  }

  const gender = useWatch({ control, name: 'gender' })
  const birthDate = useWatch({ control, name: 'birth_date' })
  const edaRaw = useWatch({ control, name: 'eda' })
  const eda = edaRaw === '' ? null : edaRaw
  const edaDetailValue = useWatch({ control, name: 'eda_detail' })
  const hebrewDate = useMemo(() => gregorianToHebrew(birthDate), [birthDate])
  const ageFromDate = useMemo(() => ageFromBirthDate(birthDate), [birthDate])
  // A birth date replaces a typed age (the age is then computed from the date).
  useEffect(() => {
    if (birthDate && getValues('age') !== '')
      setValue('age', '', { shouldDirty: true, shouldValidate: true })
  }, [birthDate, getValues, setValue])
  const err = (name: FieldPath<CandidateFormValues>) =>
    getFieldState(name, formState).error?.message

  const requestClose = () => {
    if (save.isPending) return
    if (formState.isDirty) setConfirmDiscard(true)
    else onOpenChange(false)
  }

  const [conflict, setConflict] = useState<CandidateFormValues | null>(null)
  const persist = async (values: CandidateFormValues, force: boolean) => {
    try {
      const payload = formValuesToPayload(values, candidate?.id, candidate ?? undefined)
      // the version this form was opened from — the save is refused if the card changed since
      if (candidate && !force) payload.expected_updated_at = candidate.updated_at
      const id = await save.mutateAsync(payload)
      toast.success(candidate ? t.saved : t.created, { description: values.full_name.trim() })
      reset(values)
      onOpenChange(false)
      onSaved(id, values.gender, !candidate)
    } catch (e) {
      if (isConflict(e)) setConflict(values)
      else toast.error(t.saveFailed, { description: errorMessage(e) })
    }
  }
  const onSubmit = handleSubmit(
    (values) => persist(values, false),
    (errors) => {
      // Open the hidden part that holds the error so it can be seen.
      if (errors.family || errors.in_laws) {
        setExtraOn(true)
        setFamilyOpen(true)
      }
      if (
        errors.character_description ||
        errors.desired_home_style ||
        errors.special_requirements
      ) {
        setExtraOn(true)
        setTraitsOpen(true)
      }
      toast.error(t.fixErrors)
    },
  )

  const sections: { id: SectionId; label: string }[] = [
    { id: 'personal', label: t.sections.personal },
    { id: 'education', label: gender === 'male' ? t.yeshivaSection : t.sections.education },
    { id: 'extra', label: t.extraInfo },
    { id: 'notes', label: t.notesSection },
  ]
  const goTo = (id: SectionId) => {
    if (id === 'extra') setExtraOn(true)
    setActive(id)
    requestAnimationFrame(() =>
      document.getElementById(`form-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  const instOptions =
    gender === 'male' ? suggestions.institutionsMale : suggestions.institutionsFemale

  const text = (
    name: FieldPath<CandidateFormValues>,
    label: string,
    opts?: { required?: boolean; list?: string; className?: string; placeholder?: string },
  ) => (
    <Field label={label} error={err(name)} required={opts?.required} className={opts?.className}>
      {(id, aria) => (
        <Input
          id={id}
          {...aria}
          list={opts?.list}
          placeholder={opts?.placeholder}
          {...register(name)}
        />
      )}
    </Field>
  )
  const area = (name: FieldPath<CandidateFormValues>, label: string, rows = 3) => (
    <Field label={label} error={err(name)} className="sm:col-span-2">
      {(id, aria) => <Textarea id={id} {...aria} rows={rows} {...register(name)} />}
    </Field>
  )
  const num = (name: FieldPath<CandidateFormValues>, label: string) => (
    <Field label={label} error={err(name)}>
      {(id, aria) => (
        <Input id={id} {...aria} inputMode="numeric" className="tabular" {...register(name)} />
      )}
    </Field>
  )

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <SheetContent
          side="end"
          onEscapeKeyDown={(e) => {
            e.preventDefault()
            requestClose()
          }}
          onInteractOutside={(e) => {
            e.preventDefault()
            const target = e.target as HTMLElement | null
            if (target?.closest('[data-sonner-toaster], [role=alertdialog]')) return
            requestClose()
          }}
        >
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border px-5 pb-3 pe-16 pt-5 sm:px-8">
              <SheetTitle className="text-h1 text-foreground">
                {candidate ? t.editTitle(fullName(candidate)) : t.newTitle}
              </SheetTitle>
              <SheetDescription className="mt-1 text-body text-muted-foreground">
                {t.subtitle}
              </SheetDescription>
              <nav
                className="relative -mx-1 mt-4 flex gap-1 overflow-x-auto pb-1"
                aria-label={t.newTitle}
              >
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => goTo(sec.id)}
                    aria-current={active === sec.id ? 'step' : undefined}
                    className={cn(
                      'whitespace-nowrap rounded-md px-3 py-2 text-body-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active === sec.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    {sec.label}
                  </button>
                ))}
              </nav>
            </div>

            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8"
            >
              {/* ---------------- 1. personal ---------------- */}
              <FormSection id="personal" title={t.sections.personal}>
                <div className="flex flex-col gap-2">
                  <span id="form-gender-label" className="text-label text-foreground">
                    {t.gender}
                    <span className="ms-1 text-destructive" aria-hidden>
                      *
                    </span>
                  </span>
                  <input type="hidden" {...register('gender')} />
                  <Segmented
                    role="radiogroup"
                    label={t.gender}
                    value={gender}
                    onChange={(g) =>
                      setValue('gender', g, { shouldDirty: true, shouldValidate: true })
                    }
                    items={(['male', 'female'] as const).map((g) => ({
                      value: g,
                      label: he.gender[g],
                    }))}
                    className="w-fit min-w-48"
                  />
                </div>
                {text('full_name', t.fullName, {
                  required: true,
                  placeholder: t.fullNamePlaceholder,
                })}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)]">
                  <Field
                    label={t.age}
                    error={birthDate ? undefined : err('age')}
                    hint={birthDate ? t.ageFromDate : t.ageHint}
                  >
                    {(id, aria) =>
                      birthDate ? (
                        <Input
                          key="age-computed"
                          id={id}
                          {...aria}
                          readOnly
                          tabIndex={-1}
                          value={ageFromDate ?? ''}
                          className="tabular bg-secondary text-center"
                        />
                      ) : (
                        <Input
                          key="age-typed"
                          id={id}
                          {...aria}
                          inputMode="numeric"
                          maxLength={2}
                          placeholder="—"
                          className="tabular text-center"
                          {...register('age')}
                        />
                      )
                    }
                  </Field>
                  <div className="flex flex-col gap-2">
                    <span className="text-label text-foreground" id="heb-date-label">
                      {t.hebrewBirthDate}
                    </span>
                    <HebrewDatePicker
                      idPrefix="heb-date"
                      value={birthDate}
                      onChange={(iso) =>
                        setValue('birth_date', iso, { shouldDirty: true, shouldValidate: true })
                      }
                    />
                  </div>
                  <Field
                    label={t.gregorianBirthDate}
                    error={err('birth_date')}
                    hint={
                      hebrewDate ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-4 text-brand" aria-hidden />
                          {t.convertsTo}{' '}
                          <span className="font-medium text-foreground">{hebrewDate}</span>
                        </span>
                      ) : (
                        t.hebrewAuto
                      )
                    }
                  >
                    {(id, aria) => (
                      <Input
                        id={id}
                        {...aria}
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        className="tabular"
                        {...register('birth_date')}
                      />
                    )}
                  </Field>
                </div>
                <Grid>
                  {text('city', t.city, { list: 'dl-cities' })}
                  {text('region', t.region, { list: 'dl-regions' })}
                  <div className="sm:col-span-2">
                    <EdaPicker
                      eda={eda}
                      detail={edaDetailValue}
                      onEda={(v) => {
                        setValue('eda', v ?? '', { shouldDirty: true })
                        setValue('eda_detail', '', { shouldDirty: true })
                      }}
                      onDetail={(v) => setValue('eda_detail', v, { shouldDirty: true })}
                      detailList={
                        eda === 'chasidut'
                          ? 'dl-chassidut'
                          : eda === 'mizrah'
                            ? 'dl-communities'
                            : undefined
                      }
                    />
                  </div>
                  {num('height_cm', t.height)}
                  <Field label={t.status} error={err('status')}>
                    {(id, aria) => (
                      <NativeSelect id={id} {...aria} {...register('status')}>
                        {CANDIDATE_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {he.status[st]}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </Field>
                  {text('appearance', t.appearance, { className: 'sm:col-span-2' })}
                </Grid>
              </FormSection>

              {/* ---------------- 2. education ---------------- */}
              <FormSection
                id="education"
                title={gender === 'male' ? t.yeshivaSection : t.sections.education}
              >
                {gender === 'male' ? (
                  <Grid>
                    {text('institution', t.institutionMale, {
                      list: 'dl-inst',
                      className: 'sm:col-span-2',
                    })}
                  </Grid>
                ) : (
                  <>
                    <Grid>
                      {text('institution', t.institutionFemale, { list: 'dl-inst' })}
                      {text('occupation', t.occupation)}
                      {text('degree', t.degree)}
                      {area('future_plans', t.futurePlans, 2)}
                    </Grid>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-h4 text-foreground">{t.educationHistory}</h4>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            education.append(
                              { name: '', type: '', years: '' },
                              { shouldFocus: true },
                            )
                          }
                        >
                          <Plus />
                          {t.educationAdd}
                        </Button>
                      </div>
                      {education.fields.length === 0 && (
                        <p className="rounded-md bg-secondary px-4 py-3 text-body-sm text-muted-foreground">
                          {t.noEducation}
                        </p>
                      )}
                      <ol className="space-y-3">
                        {education.fields.map((fld, i) => (
                          <li
                            key={fld.id}
                            className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-start"
                          >
                            {text(`education_history.${i}.name`, t.educationName, {
                              required: true,
                            })}
                            <Field
                              label={t.educationType}
                              error={err(`education_history.${i}.type`)}
                            >
                              {(id, aria) => (
                                <Input
                                  id={id}
                                  {...aria}
                                  list="dl-edu-type"
                                  {...register(`education_history.${i}.type`)}
                                />
                              )}
                            </Field>
                            {text(`education_history.${i}.years`, t.educationYears, {
                              placeholder: t.educationYearsPlaceholder,
                            })}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive-soft hover:text-destructive sm:mt-[21px]"
                              onClick={() => education.remove(i)}
                              aria-label={t.removeRow(`${t.educationName} ${i + 1}`)}
                            >
                              <Trash2 />
                            </Button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </>
                )}
              </FormSection>

              {/* ---------------- 3. extra info (toggle) ---------------- */}
              <section
                id="form-extra"
                data-section="extra"
                aria-labelledby="form-extra-h"
                className="scroll-mt-4 space-y-4 border-t border-border pt-8"
              >
                <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
                  <div>
                    <h3 id="form-extra-h" className="text-h3 text-foreground">
                      {t.extraInfo}
                    </h3>
                    <p className="text-body-sm text-muted-foreground">{t.extraInfoHint}</p>
                  </div>
                  <Switch checked={extraOn} onChange={setExtraOn} label={t.extraInfo} />
                </div>
                {extraOn && (
                  <div className="space-y-3">
                    <Collapsible
                      id="sub-family"
                      title={t.sections.family}
                      open={familyOpen}
                      onToggle={() => setFamilyOpen((o) => !o)}
                    >
                      <Grid>
                        {text('family.father_name', t.fatherName)}
                        {text('family.father_occupation', t.fatherOccupation)}
                        {text('family.mother_name', t.motherName)}
                        {text('family.mother_occupation', t.motherOccupation)}
                        {text('family.mother_maiden_name', t.motherMaidenName)}
                        <div className="grid grid-cols-2 gap-4">
                          {num('family.siblings_count', t.siblingsCount)}
                          {num('family.birth_order', t.birthOrder)}
                        </div>
                        {area('family.lineage', t.lineage, 2)}
                      </Grid>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-h4 text-foreground">{t.inLaws}</h4>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              inLaws.append(
                                { relation: 'גיס', full_name: '', details: '' },
                                {
                                  shouldFocus: true,
                                  focusName: `in_laws.${inLaws.fields.length}.full_name`,
                                },
                              )
                            }
                          >
                            <Plus />
                            {t.inLawAdd}
                          </Button>
                        </div>
                        {inLaws.fields.length === 0 && (
                          <p className="rounded-md bg-secondary px-4 py-3 text-body-sm text-muted-foreground">
                            {t.noInLaws}
                          </p>
                        )}
                        <ul className="space-y-3">
                          {inLaws.fields.map((fld, i) => (
                            <li
                              key={fld.id}
                              className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 sm:grid-cols-[8rem_1.2fr_1.5fr_auto] sm:items-start"
                            >
                              <Field
                                label={t.inLawRelation}
                                error={err(`in_laws.${i}.relation`)}
                                required
                              >
                                {(id, aria) => (
                                  <Input
                                    id={id}
                                    {...aria}
                                    list="dl-relations"
                                    {...register(`in_laws.${i}.relation`)}
                                  />
                                )}
                              </Field>
                              {text(`in_laws.${i}.full_name`, t.inLawName, { required: true })}
                              {text(`in_laws.${i}.details`, t.inLawDetails)}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive-soft hover:text-destructive sm:mt-[21px]"
                                onClick={() => inLaws.remove(i)}
                                aria-label={t.removeRow(`${t.inLawName} ${i + 1}`)}
                              >
                                <Trash2 />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Collapsible>
                    <Collapsible
                      id="sub-traits"
                      title={t.sections.traits}
                      open={traitsOpen}
                      onToggle={() => setTraitsOpen((o) => !o)}
                    >
                      <Grid>
                        {area('character_description', t.character)}
                        {area('desired_home_style', t.homeStyle, 2)}
                        {area('special_requirements', t.specialRequirements, 2)}
                      </Grid>
                    </Collapsible>
                  </div>
                )}
              </section>

              {/* ---------------- 4. general notes (always visible) ---------------- */}
              <FormSection id="notes" title={t.notesSection}>
                <Field label={t.generalNotes} error={err('general_notes')}>
                  {(id, aria) => (
                    <Textarea id={id} {...aria} rows={3} {...register('general_notes')} />
                  )}
                </Field>
              </FormSection>

              <datalist id="dl-cities">
                {suggestions.cities.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <datalist id="dl-regions">
                {suggestions.regions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <datalist id="dl-communities">
                {suggestions.communities.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <datalist id="dl-chassidut">
                {suggestions.chassidut.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <datalist id="dl-inst">
                {instOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <datalist id="dl-edu-type">
                {[
                  ...t.institutionTypeOptionsMale,
                  ...t.institutionTypeOptionsFemale,
                  'תלמוד תורה',
                  'בית ספר',
                ].map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <datalist id="dl-relations">
                {t.inLawRelationOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-4 sm:px-8">
              <Button variant="outline" onClick={requestClose} disabled={save.isPending}>
                {he.common.cancel}
              </Button>
              <Button type="submit" variant="primary" loading={save.isPending} className="min-w-28">
                {save.isPending ? he.common.saving : he.common.save}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={!!conflict}
        onOpenChange={(o) => !o && setConflict(null)}
        title={t.conflictTitle}
        description={t.conflictText}
        cancelLabel={t.conflictBack}
        confirmLabel={t.conflictOverwrite}
        destructive
        onConfirm={() => {
          const v = conflict
          setConflict(null)
          if (v) void persist(v, true)
        }}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t.discardTitle}
        description={t.discardText}
        confirmLabel={t.discardConfirm}
        cancelLabel={t.keepEditing}
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </>
  )
}
