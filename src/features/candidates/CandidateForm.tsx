import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, ChevronLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { useSaveCandidate } from '@/hooks/useCandidates'
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
      className="scroll-mt-4 space-y-4"
    >
      <h3 id={`form-${id}-h`} className="flex items-center gap-2 text-lg font-bold text-navy-900">
        <span className="h-5 w-1 rounded-full bg-gold-500" aria-hidden />
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
    <div className="rounded-xl border border-line">
      <h4>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-start text-[15px] font-semibold text-navy-900 transition-colors hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          <ChevronLeft
            className={cn(
              'size-4 text-navy-700 transition-transform duration-200',
              open && '-rotate-90',
            )}
            aria-hidden
          />
          {title}
        </button>
      </h4>
      {open && (
        <div id={`${id}-panel`} className="space-y-4 border-t border-line px-4 pb-4 pt-4">
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
  const { register, control, formState, handleSubmit, reset, getFieldState, setValue } = form
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
  const chassidutOn = useWatch({ control, name: 'chassidut_on' })
  const hebrewDate = useMemo(() => gregorianToHebrew(birthDate), [birthDate])
  const err = (name: FieldPath<CandidateFormValues>) =>
    getFieldState(name, formState).error?.message

  const requestClose = () => {
    if (save.isPending) return
    if (formState.isDirty) setConfirmDiscard(true)
    else onOpenChange(false)
  }

  const onSubmit = handleSubmit(
    async (values) => {
      try {
        const id = await save.mutateAsync(formValuesToPayload(values, candidate?.id))
        toast.success(candidate ? t.saved : t.created, { description: values.full_name.trim() })
        reset(values)
        onOpenChange(false)
        onSaved(id, values.gender, !candidate)
      } catch (e) {
        toast.error(t.saveFailed, { description: errorMessage(e) })
      }
    },
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
  const typeOptions =
    gender === 'male' ? t.institutionTypeOptionsMale : t.institutionTypeOptionsFemale

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
            if (target?.closest('[data-sonner-toaster]')) return
            requestClose()
          }}
        >
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-line px-5 pb-3 pe-14 pt-5 sm:px-7">
              <SheetTitle className="font-heading text-2xl font-bold text-navy-900">
                {candidate ? t.editTitle(fullName(candidate)) : t.newTitle}
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-ink-muted">
                {t.subtitle}
              </SheetDescription>
              <nav
                className="relative -mx-1 mt-3 flex gap-1 overflow-x-auto pb-1"
                aria-label={t.newTitle}
              >
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => goTo(sec.id)}
                    aria-current={active === sec.id ? 'step' : undefined}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
                      active === sec.id
                        ? 'bg-navy-100 font-semibold text-navy-900'
                        : 'font-medium text-navy-800 hover:bg-navy-50',
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
              className="min-h-0 flex-1 space-y-9 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7"
            >
              {/* ---------------- 1. personal ---------------- */}
              <FormSection id="personal" title={t.sections.personal}>
                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-medium">
                    {t.gender}
                    <span className="ms-0.5 text-danger" aria-hidden>
                      *
                    </span>
                  </legend>
                  <div className="inline-flex rounded-lg bg-cream-100 p-1" role="radiogroup">
                    {(['male', 'female'] as const).map((g) => (
                      <label
                        key={g}
                        className={cn(
                          'relative cursor-pointer rounded-md px-5 py-1.5 text-sm font-semibold transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-500',
                          gender === g
                            ? 'bg-navy-900 text-surface shadow-sm'
                            : 'text-navy-800 hover:text-navy-900',
                        )}
                      >
                        <input type="radio" value={g} className="sr-only" {...register('gender')} />
                        {he.gender[g]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {text('full_name', t.fullName, {
                  required: true,
                  placeholder: t.fullNamePlaceholder,
                })}
                <div className="grid grid-cols-1 gap-4 rounded-xl bg-cream-50/70 p-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium" id="heb-date-label">
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
                          <CalendarDays className="size-3.5 text-gold-700" aria-hidden />
                          {t.convertsTo}{' '}
                          <span className="font-medium text-navy-900">{hebrewDate}</span>
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
                  {text('community', t.community, { list: 'dl-communities' })}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex h-[13px] items-center gap-2.5">
                      <label htmlFor="chassidut-switch" className="text-[13px] font-medium">
                        {t.chassidutToggle}
                      </label>
                      <Switch
                        id="chassidut-switch"
                        checked={chassidutOn}
                        onChange={(v) => setValue('chassidut_on', v, { shouldDirty: true })}
                        label={t.chassidutToggle}
                        className="scale-90"
                      />
                    </div>
                    {chassidutOn ? (
                      <Input
                        aria-label={t.chassidutName}
                        list="dl-chassidut"
                        placeholder={t.chassidutPlaceholder}
                        autoFocus={!candidate}
                        {...register('chassidut')}
                      />
                    ) : (
                      <div className="h-10" aria-hidden />
                    )}
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
                    {text('institution', t.institutionMale, { list: 'dl-inst' })}
                    <Field label={t.institutionType} error={err('institution_type')}>
                      {(id, aria) => (
                        <NativeSelect id={id} {...aria} {...register('institution_type')}>
                          <option value="">{he.form.choose}</option>
                          {t.institutionTypeOptionsMale.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </Field>
                  </Grid>
                ) : (
                  <>
                    <Grid>
                      {text('institution', t.institutionFemale, { list: 'dl-inst' })}
                      <Field label={t.institutionType} error={err('institution_type')}>
                        {(id, aria) => (
                          <Input
                            id={id}
                            {...aria}
                            list="dl-inst-type"
                            {...register('institution_type')}
                          />
                        )}
                      </Field>
                      {text('occupation', t.occupation)}
                      {text('degree', t.degree)}
                      {area('future_plans', t.futurePlans, 2)}
                    </Grid>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-navy-900">
                          {t.educationHistory}
                        </h4>
                        <Button
                          size="sm"
                          variant="subtle"
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
                        <p className="rounded-lg bg-cream-50 px-3 py-3 text-sm text-ink-muted">
                          {t.noEducation}
                        </p>
                      )}
                      <ol className="space-y-2.5">
                        {education.fields.map((fld, i) => (
                          <li
                            key={fld.id}
                            className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-cream-50/50 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-start"
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
                              className="text-danger hover:bg-danger-soft sm:mt-[22px]"
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
                className="scroll-mt-4 space-y-4"
              >
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-cream-50/70 px-4 py-3">
                  <div>
                    <h3
                      id="form-extra-h"
                      className="flex items-center gap-2 text-lg font-bold text-navy-900"
                    >
                      <span className="h-5 w-1 rounded-full bg-gold-500" aria-hidden />
                      {t.extraInfo}
                    </h3>
                    <p className="ms-3 text-[12.5px] text-ink-muted">{t.extraInfoHint}</p>
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

                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-navy-900">{t.inLaws}</h4>
                          <Button
                            size="sm"
                            variant="subtle"
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
                          <p className="rounded-lg bg-cream-50 px-3 py-3 text-sm text-ink-muted">
                            {t.noInLaws}
                          </p>
                        )}
                        <ul className="space-y-2.5">
                          {inLaws.fields.map((fld, i) => (
                            <li
                              key={fld.id}
                              className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-cream-50/50 p-3 sm:grid-cols-[8rem_1.2fr_1.5fr_auto] sm:items-start"
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
                                className="text-danger hover:bg-danger-soft sm:mt-[22px]"
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
              <datalist id="dl-inst-type">
                {typeOptions.map((v) => (
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

            <div className="flex items-center justify-end gap-2 border-t border-line bg-cream-50/70 px-5 py-3.5 sm:px-7">
              <Button variant="secondary" onClick={requestClose} disabled={save.isPending}>
                {he.common.cancel}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={save.isPending}
                className="min-w-28"
              >
                {save.isPending && <Loader2 className="animate-spin" />}
                {save.isPending ? he.common.saving : he.common.save}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
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
