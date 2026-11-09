import { motion } from 'framer-motion'
import { BookOpen, Heart, Pencil, Trash2, UserRound, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import {
  DownloadResumeButton,
  EmailResumeButton,
  ResumeActions,
} from '@/features/resumes/ResumeActions'
import { useCandidateDetail } from '@/hooks/useCandidates'
import { formatGregorian } from '@/lib/hebrewDate'
import { he } from '@/lib/strings.he'
import type { CandidateFull, CandidateRow } from '@/lib/types'
import { fullName } from '@/lib/utils'
import { edaDetail, edaOf, hasEda } from '@/lib/eda'
import { edaLabel } from './EdaFilter'
import { StatusBadge } from './StatusBadge'

const f = he.detail.fields

interface Props {
  id: string | null
  /** Row from the cached list — lets the modal render instantly while details load. */
  preview: CandidateRow | null
  onClose: () => void
  onEdit: (c: CandidateFull) => void
  onDelete: (c: CandidateRow) => void
}

type Value = ReactNode | string | number | null | undefined
const has = (v: Value) => v !== null && v !== undefined && v !== '' && v !== false

function Item({ label, value, wide }: { label: string; value: Value; wide?: boolean }) {
  if (!has(value)) return null
  return (
    <div className={wide ? 'col-span-2' : 'min-w-0'}>
      <dt className="text-[12px] font-medium text-ink-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-[14.5px] leading-relaxed text-ink">
        {value}
      </dd>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
  index,
}: {
  title: string
  icon: ReactNode
  children: ReactNode[]
  index: number
}) {
  // Hidden entirely when every item inside is empty.
  if (!children.some(Boolean)) return null
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04, ease: 'easeOut' }}
      aria-labelledby={`sec-${index}`}
      className="border-t border-line pt-5 first:border-t-0 first:pt-0"
    >
      <h3
        id={`sec-${index}`}
        className="mb-3 flex items-center gap-2 text-[17px] font-bold text-navy-900"
      >
        <span
          className="grid size-7 place-items-center rounded-lg bg-gold-100 text-gold-700"
          aria-hidden
        >
          {icon}
        </span>
        {title}
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:gap-x-6">{children}</dl>
    </motion.section>
  )
}

function joinWith(main: string | null | undefined, sub: string | null | undefined): string | null {
  if (!main && !sub) return null
  if (main && sub) return `${main} · ${sub}`
  return main || sub || null
}

function DetailSections({ c, full }: { c: CandidateRow; full: CandidateFull | undefined }) {
  const fam = full?.family
  const inLaws = full?.in_laws ?? []
  const instLabel = c.gender === 'male' ? f.institutionMale : f.institutionFemale
  const birthOrder =
    fam?.birth_order != null
      ? fam.siblings_count != null
        ? he.detail.birthOrderOf(fam.birth_order, fam.siblings_count)
        : he.detail.birthOrderOnly(fam.birth_order)
      : null

  return (
    <div className="space-y-6">
      <Section
        index={0}
        title={he.detail.sections.personal}
        icon={<UserRound className="size-4" />}
      >
        {[
          <Item key="name" label={f.fullName} value={fullName(c)} />,
          <Item key="age" label={f.age} value={c.age} />,
          <Item key="heb" label={f.hebrewBirthDate} value={c.hebrew_birth_date} />,
          <Item key="greg" label={f.gregorianBirthDate} value={formatGregorian(c.birth_date)} />,
          <Item key="city" label={f.city} value={joinWith(c.city, c.region)} />,
          <Item key="origin" label={f.countryOfOrigin} value={c.country_of_origin} />,
          <Item
            key="eda"
            label={f.community}
            value={hasEda(c) ? edaLabel(edaOf(c), edaDetail(c)) : null}
          />,
          <Item
            key="height"
            label={f.height}
            value={c.height_cm ? `${c.height_cm} ${he.common.cm}` : null}
          />,
          <Item key="app" label={f.appearance} value={c.appearance} />,
        ]}
      </Section>

      <Section
        index={1}
        title={he.detail.sections.education}
        icon={<BookOpen className="size-4" />}
      >
        {[
          c.education_history.length > 0 ? (
            <div key="hist" className="col-span-2">
              <dt className="text-[12px] font-medium text-ink-muted">{f.educationHistory}</dt>
              <dd className="mt-2">
                <ol className="relative space-y-3 border-s-2 border-navy-100 ps-5">
                  {c.education_history.map((e, i) => (
                    <li key={i} className="relative">
                      <span
                        className="absolute -start-[27px] top-1.5 size-3 rounded-full border-2 border-surface bg-gold-500 ring-2 ring-navy-100"
                        aria-hidden
                      />
                      <p className="text-[14.5px] font-medium text-ink">{e.name}</p>
                      {(e.type || e.years) && (
                        <p className="text-[13px] text-ink-muted">
                          {[e.type, e.years].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </dd>
            </div>
          ) : null,
          has(c.institution) ? <Item key="inst" label={instLabel} value={c.institution} /> : null,
          has(c.degree) ? <Item key="deg" label={f.degree} value={c.degree} /> : null,
          has(c.occupation) ? <Item key="occ" label={f.occupation} value={c.occupation} /> : null,
          has(c.future_plans) ? (
            <Item key="plans" label={f.futurePlans} value={c.future_plans} wide />
          ) : null,
        ]}
      </Section>

      {full ? (
        <Section index={2} title={he.detail.sections.family} icon={<Users className="size-4" />}>
          {[
            has(fam?.father_name) ? (
              <Item
                key="father"
                label={f.father}
                value={joinWith(fam?.father_name, fam?.father_occupation)}
              />
            ) : null,
            has(fam?.mother_name) || has(fam?.mother_occupation) ? (
              <Item
                key="mother"
                label={f.mother}
                value={joinWith(fam?.mother_name, fam?.mother_occupation)}
              />
            ) : null,
            has(fam?.mother_maiden_name) ? (
              <Item key="maiden" label={f.motherMaidenName} value={fam?.mother_maiden_name} />
            ) : null,
            has(fam?.siblings_count) ? (
              <Item key="sib" label={f.siblings} value={fam?.siblings_count} />
            ) : null,
            has(birthOrder) ? <Item key="order" label={f.birthOrder} value={birthOrder} /> : null,
            has(fam?.lineage) ? (
              <Item key="lin" label={f.lineage} value={fam?.lineage} wide />
            ) : null,
            inLaws.length > 0 ? (
              <div key="inlaws" className="col-span-2">
                <dt className="text-[12px] font-medium text-ink-muted">{f.inLaws}</dt>
                <dd className="mt-2">
                  <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                    {inLaws.map((l) => (
                      <li
                        key={l.id}
                        className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-3 py-2.5"
                      >
                        <Badge tone="navy">{l.relation}</Badge>
                        <span className="text-[14.5px] font-medium">{l.full_name}</span>
                        {l.details && (
                          <span className="text-[13px] text-ink-muted">{l.details}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null,
          ]}
        </Section>
      ) : (
        <div
          className="space-y-3 border-t border-line pt-5"
          aria-busy
          aria-label={he.detail.loading}
        >
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
      )}

      <Section index={3} title={he.detail.sections.traits} icon={<Heart className="size-4" />}>
        {[
          has(c.character_description) ? (
            <Item key="char" label={f.character} value={c.character_description} wide />
          ) : null,
          has(c.desired_home_style) ? (
            <Item key="home" label={f.homeStyle} value={c.desired_home_style} wide />
          ) : null,
          has(c.special_requirements) ? (
            <Item key="req" label={f.specialRequirements} value={c.special_requirements} wide />
          ) : null,
          has(c.general_notes) ? (
            <Item key="notes" label={f.generalNotes} value={c.general_notes} wide />
          ) : null,
        ]}
      </Section>
    </div>
  )
}

export function CandidateDetailModal({ id, preview, onClose, onEdit, onDelete }: Props) {
  const detail = useCandidateDetail(id)
  const full = detail.data ?? undefined
  // Prefer fresh detail data; fall back to the list row for instant paint.
  const c: CandidateRow | null = full ?? preview
  const notFound = detail.isSuccess && detail.data === null

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        {c ? (
          <>
            <DialogHeader className="gap-1.5 bg-gradient-to-b from-cream-50 to-surface">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-2xl">{fullName(c)}</DialogTitle>
                <StatusBadge status={c.status} hideActive={false} />
              </div>
              <DialogDescription>
                {[
                  he.gender[c.gender],
                  c.age !== null ? `${he.table.age} ${c.age}` : null,
                  c.city,
                  c.institution,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <DetailSections c={c} full={full} />
              <div className="mt-6 border-t border-line pt-5">
                <h3 className="mb-3 text-[17px] font-bold text-navy-900">{he.resume.label}</h3>
                <ResumeActions candidate={c} variant="full" />
              </div>
            </DialogBody>
            <DialogFooter className="justify-between">
              <div className="flex flex-wrap gap-2">
                <EmailResumeButton candidate={c} />
                {c.resume && <DownloadResumeButton candidate={c} />}
              </div>
              <div className="flex gap-2">
                <Tooltip content={he.common.delete}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => onDelete(c)}
                    aria-label={he.form.deleteTitle(fullName(c))}
                  >
                    <Trash2 />
                  </Button>
                </Tooltip>
                <Button variant="secondary" onClick={onClose}>
                  {he.common.close}
                </Button>
                <Button variant="primary" disabled={!full} onClick={() => full && onEdit(full)}>
                  <Pencil />
                  {he.common.edit}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : notFound || detail.isError ? (
          <>
            <DialogHeader>
              <DialogTitle>{he.detail.notFound}</DialogTitle>
              <DialogDescription className="sr-only">{he.detail.notFound}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={onClose}>{he.common.close}</Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4 p-6" aria-busy>
            <DialogTitle className="sr-only">{he.detail.loading}</DialogTitle>
            <DialogDescription className="sr-only">{he.detail.loading}</DialogDescription>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
