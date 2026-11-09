import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { NativeSelect } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  guessMapping,
  mergeIntoExisting,
  parseRows,
  TARGETS,
  TEMPLATE_HEADERS,
  type GenderMode,
  type ParsedRow,
  type Target,
} from '@/features/import/mapping'
import { useCandidateIndex, useRefreshAll } from '@/hooks/useWorkspace'
import { dataApi } from '@/lib/api'
import { payloadOf } from '@/lib/candidatePayload'
import { readSpreadsheet, type Sheet, type SheetCell } from '@/lib/files/readSheet'
import { saveFile } from '@/lib/files/save'
import { buildXlsx } from '@/lib/files/xlsx'
import { he } from '@/lib/strings.he'
import { cn, errorMessage } from '@/lib/utils'

const t = he.importer
type Step = 0 | 1 | 2 | 3
type DupPolicy = 'skip' | 'update' | 'add'

const cellText = (v: SheetCell | undefined) => (v === null || v === undefined ? '' : String(v))

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label={t.title}>
      {t.steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1 text-body-sm font-medium',
              i === step
                ? 'bg-accent text-accent-foreground'
                : i < step
                  ? 'text-foreground'
                  : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'tabular grid size-5 place-items-center rounded-full text-caption',
                i < step ? 'bg-primary text-primary-foreground' : 'border border-input',
              )}
              aria-hidden
            >
              {i < step ? '✓' : i + 1}
            </span>
            {label}
          </span>
          {i < t.steps.length - 1 && <span className="h-px w-4 bg-border" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}

interface Outcome {
  added: number
  updated: number
  skipped: number
  failed: { line: number; error: string }[]
}

/** Import an existing candidate list from Excel / CSV: upload → map columns → check → import. */
export default function ImportPage() {
  const { rows: existing } = useCandidateIndex()
  const refresh = useRefreshAll()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>(0)
  const [fileName, setFileName] = useState('')
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [reading, setReading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [hasHeader, setHasHeader] = useState(true)
  const [mapping, setMapping] = useState<Target[]>([])
  const [genderMode, setGenderMode] = useState<GenderMode>('column')
  const [dupPolicy, setDupPolicy] = useState<DupPolicy>('skip')
  const [showAll, setShowAll] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const width = useMemo(
    () => (sheet ? Math.max(0, ...sheet.rows.slice(0, 50).map((r) => r.length)) : 0),
    [sheet],
  )
  const headers = useMemo(
    () =>
      Array.from({ length: width }, (_, i) =>
        hasHeader ? cellText(sheet?.rows[0]?.[i]).trim() : `עמודה ${i + 1}`,
      ),
    [sheet, width, hasHeader],
  )
  const dataRows = useMemo(
    () => (sheet ? sheet.rows.slice(hasHeader ? 1 : 0) : []),
    [sheet, hasHeader],
  )

  const load = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'xls') return toast.error(t.oldXls, { duration: 10000 })
    if (!['xlsx', 'xlsm', 'csv', 'tsv', 'txt'].includes(ext ?? '')) return toast.error(t.badType)
    setReading(true)
    try {
      const s = await readSpreadsheet(file)
      const nonEmpty = s.rows.filter((r) => r.some((c) => cellText(c).trim()))
      if (nonEmpty.length === 0) throw new Error(t.emptyFile)
      // drop leading empty rows
      const firstIdx = s.rows.findIndex((r) => r.some((c) => cellText(c).trim()))
      const trimmed = { ...s, rows: s.rows.slice(firstIdx) }
      setSheet(trimmed)
      setFileName(file.name)
      const w = Math.max(...trimmed.rows.slice(0, 50).map((r) => r.length))
      setMapping(guessMapping(Array.from({ length: w }, (_, i) => cellText(trimmed.rows[0]?.[i]))))
      setHasHeader(true)
      setGenderMode('column')
      setStep(1)
    } catch (e) {
      toast.error(t.readFailed, { description: errorMessage(e) })
    } finally {
      setReading(false)
    }
  }

  const toggleHeader = (v: boolean) => {
    setHasHeader(v)
    setMapping(
      v
        ? guessMapping(headers.map((_, i) => cellText(sheet?.rows[0]?.[i])))
        : headers.map(() => 'notes_extra' as Target),
    )
  }

  const hasName = mapping.includes('full_name') || mapping.includes('first_name')
  const genderOk = genderMode !== 'column' || mapping.includes('gender')

  const parsed = useMemo<ParsedRow[]>(
    () =>
      step >= 2
        ? parseRows(dataRows, hasHeader ? 2 : 1, { headers, mapping, genderMode }, existing)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when entering the check step
    [step, dataRows, mapping, genderMode, hasHeader],
  )
  const errorsN = parsed.filter((r) => r.errors.length).length
  const dupN = parsed.filter((r) => !r.errors.length && r.duplicateOf).length
  const inFileN = parsed.filter(
    (r) => !r.errors.length && !r.duplicateOf && r.duplicateInFile,
  ).length
  const newN = parsed.filter((r) => !r.errors.length && !r.duplicateOf && !r.duplicateInFile).length
  const warnN = parsed.filter((r) => !r.errors.length && r.warnings.length).length
  const toImport = newN + (dupPolicy === 'skip' ? 0 : dupN)

  const run = async () => {
    const work = parsed.filter(
      (r) => r.payload && !r.duplicateInFile && (!r.duplicateOf || dupPolicy !== 'skip'),
    )
    const res: Outcome = {
      added: 0,
      updated: 0,
      skipped: parsed.length - work.length - errorsN,
      failed: [],
    }
    setStep(3)
    setProgress({ done: 0, total: work.length })
    for (let i = 0; i < work.length; i++) {
      const r = work[i]!
      try {
        if (r.duplicateOf && dupPolicy === 'update') {
          const full = await dataApi.getCandidate(r.duplicateOf.id)
          if (!full) throw new Error(he.detail.notFound)
          await dataApi.saveCandidate(
            mergeIntoExisting(payloadOf(full, full.id, full.updated_at), r.payload!),
          )
          res.updated++
        } else {
          await dataApi.saveCandidate(r.payload!)
          res.added++
        }
      } catch (e) {
        res.failed.push({ line: r.line, error: errorMessage(e) })
      }
      setProgress({ done: i + 1, total: work.length })
    }
    await refresh()
    setOutcome(res)
    setProgress(null)
  }

  const reset = () => {
    setStep(0)
    setSheet(null)
    setOutcome(null)
    setShowAll(false)
    setDupPolicy('skip')
  }

  const downloadTemplate = async () => {
    try {
      await saveFile(t.templateFile, buildXlsx('מועמדים', TEMPLATE_HEADERS, []))
    } catch (e) {
      toast.error(he.exportCsv.failed, { description: errorMessage(e) })
    }
  }

  const visible = showAll ? parsed : parsed.slice(0, 50)

  return (
    <main id="main" className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body text-muted-foreground">{t.subtitle}</p>
        <Stepper step={step} />
      </div>

      {/* ---------------- 0. file ---------------- */}
      {step === 0 && (
        <Card>
          <CardContent className="space-y-6 pt-5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f) void load(f)
              }}
              disabled={reading}
              aria-busy={reading}
              className={cn(
                'flex w-full flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                dragOver ? 'border-brand bg-accent' : 'border-input hover:bg-secondary',
              )}
            >
              <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
                <FileSpreadsheet className="size-6" aria-hidden />
              </span>
              <span className="text-h4 text-foreground">{reading ? t.reading : t.drop}</span>
              <span className="text-body-sm text-muted-foreground">{t.dropHint}</span>
              <span className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-button text-primary-foreground">
                <Upload className="size-4" aria-hidden />
                {t.choose}
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv,.tsv,.txt,.xls"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void load(f)
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-body-sm text-muted-foreground">{t.templateHint}</p>
              <Button size="sm" onClick={() => void downloadTemplate()}>
                <Download />
                {t.template}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- 1. mapping ---------------- */}
      {step === 1 && sheet && (
        <Card>
          <CardHeader>
            <CardTitle>{t.mappingTitle}</CardTitle>
            <p className="text-body-sm text-muted-foreground">
              <span dir="auto">{t.file(fileName, dataRows.length)}</span> · {t.mappingHint}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Checkbox checked={hasHeader} onChange={toggleHeader} label={t.hasHeader}>
              {t.hasHeader}
            </Checkbox>
            <div className="flex flex-col gap-2">
              <span className="text-label text-foreground" id="gender-mode">
                {t.genderMode}
              </span>
              <ChoiceGroup
                className="grid-cols-1 sm:grid-cols-3"
                label={t.genderMode}
                value={genderMode}
                onChange={(v) => v && setGenderMode(v)}
                options={[
                  { value: 'column', label: t.genderColumn },
                  { value: 'male', label: t.allMale },
                  { value: 'female', label: t.allFemale },
                ]}
              />
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-table">
                <caption className="sr-only">{t.mappingTitle}</caption>
                <thead>
                  <tr>
                    {[t.column, t.sample, t.target].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="h-10 border-b border-border px-4 text-start text-body-sm font-medium text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h, i) => {
                    const samples = dataRows
                      .map((r) => cellText(r[i]).trim())
                      .filter(Boolean)
                      .slice(0, 2)
                      .join(' · ')
                    return (
                      <tr key={i} className="align-middle">
                        <td className="border-b border-border px-4 py-2 font-medium" dir="auto">
                          {h || `עמודה ${i + 1}`}
                        </td>
                        <td
                          className="max-w-[16rem] truncate border-b border-border px-4 py-2 text-body-sm text-muted-foreground"
                          dir="auto"
                        >
                          {samples || '—'}
                        </td>
                        <td className="w-56 border-b border-border px-4 py-2">
                          <NativeSelect
                            aria-label={`${t.target}: ${h || `עמודה ${i + 1}`}`}
                            value={mapping[i] ?? 'ignore'}
                            onChange={(e) => {
                              const v = e.target.value as Target
                              setMapping((m) =>
                                m.map((x, j) =>
                                  j === i
                                    ? v
                                    : x === v &&
                                        !['ignore', 'notes_extra', 'general_notes'].includes(v)
                                      ? 'notes_extra'
                                      : x,
                                ),
                              )
                            }}
                            className="h-9"
                          >
                            {(Object.keys(TARGETS) as Target[]).map((k) => (
                              <option key={k} value={k}>
                                {TARGETS[k]}
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {(!hasName || !genderOk) && (
              <Alert tone="warning">
                {!hasName && <p>{t.needName}</p>}
                {!genderOk && <p>{t.needGender}</p>}
              </Alert>
            )}
            <div className="flex justify-between gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={reset}>
                <ArrowRight />
                {t.back}
              </Button>
              <Button variant="primary" disabled={!hasName || !genderOk} onClick={() => setStep(2)}>
                {t.next}
                <ArrowLeft />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- 2. check ---------------- */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.checkTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [t.ready, newN, 'success'],
                [t.duplicates, dupN, 'neutral'],
                [t.inFile, inFileN, 'neutral'],
                [t.errors, errorsN, errorsN ? 'destructive' : 'neutral'],
              ].map(([label, n, tone]) => (
                <div key={label as string} className="rounded-md border border-border p-4">
                  <dt className="text-body-sm text-muted-foreground">{label}</dt>
                  <dd
                    className={cn(
                      'tabular mt-1 text-h2',
                      tone === 'success' && 'text-success',
                      tone === 'destructive' && 'text-destructive',
                    )}
                  >
                    {n as number}
                  </dd>
                </div>
              ))}
            </dl>

            {dupN > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-label text-foreground">{t.dupPolicy}</span>
                <ChoiceGroup
                  className="grid-cols-1 sm:grid-cols-3"
                  label={t.dupPolicy}
                  value={dupPolicy}
                  onChange={(v) => v && setDupPolicy(v)}
                  options={[
                    { value: 'skip', label: t.dupSkip },
                    { value: 'update', label: t.dupUpdate },
                    { value: 'add', label: t.dupAdd },
                  ]}
                />
                <p className="text-caption text-muted-foreground">{t.dupHint}</p>
              </div>
            )}
            {warnN > 0 && <Alert tone="info">{t.warningsNote(warnN)}</Alert>}

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-table">
                <caption className="sr-only">{t.checkTitle}</caption>
                <thead>
                  <tr>
                    {[t.row, t.name, t.result].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="h-10 border-b border-border px-4 text-start text-body-sm font-medium text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.line} className="align-top">
                      <td className="tabular w-16 border-b border-border px-4 py-2 text-muted-foreground">
                        {r.line}
                      </td>
                      <td className="border-b border-border px-4 py-2 font-medium">
                        {r.name || '—'}
                      </td>
                      <td className="border-b border-border px-4 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {r.errors.length ? (
                            <Badge tone="destructive">{t.stError}</Badge>
                          ) : r.duplicateOf ? (
                            <Badge tone="neutral">{t.stDup}</Badge>
                          ) : r.duplicateInFile ? (
                            <Badge tone="neutral">{t.stDupFile(r.duplicateInFile)}</Badge>
                          ) : (
                            <Badge tone="success">{t.stReady}</Badge>
                          )}
                          {[...r.errors, ...r.warnings].map((m) => (
                            <span key={m} className="text-body-sm text-muted-foreground">
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.length > visible.length && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
                {t.showAll(parsed.length)}
              </Button>
            )}

            <div className="flex justify-between gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowRight />
                {t.back}
              </Button>
              <Button variant="primary" disabled={toImport === 0} onClick={() => void run()}>
                <Upload />
                {toImport ? t.importN(toImport) : t.nothing}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- 3. import ---------------- */}
      {step === 3 && (
        <Card>
          <CardContent className="space-y-6 pt-5">
            {progress && (
              <div className="space-y-3" role="status" aria-live="polite">
                <p className="tabular text-body text-foreground">
                  {t.importing(progress.done, progress.total)}
                </p>
                <Progress
                  value={progress.total ? (progress.done / progress.total) * 100 : 100}
                  label={t.importing(progress.done, progress.total)}
                />
              </div>
            )}
            {outcome && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-6 text-success" aria-hidden />
                  <h2 className="text-h2 text-foreground">{t.doneTitle}</h2>
                </div>
                <p className="tabular text-body-lg text-foreground" role="status">
                  {[
                    t.added(outcome.added),
                    outcome.updated ? t.updated(outcome.updated) : null,
                    outcome.skipped ? t.skipped(outcome.skipped) : null,
                    outcome.failed.length ? t.failed(outcome.failed.length) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {outcome.failed.length > 0 && (
                  <Alert tone="destructive" icon={<AlertTriangle className="mt-0.5 size-4" />}>
                    <ul className="space-y-1">
                      {outcome.failed.slice(0, 20).map((f) => (
                        <li key={f.line}>{t.failedRow(f.line, f.error)}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button variant="primary" asChild>
                    <Link to="/candidates?tab=all">{t.toTable}</Link>
                  </Button>
                  <Button onClick={reset}>
                    <RotateCcw />
                    {t.another}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
