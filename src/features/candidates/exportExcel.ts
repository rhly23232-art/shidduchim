import { toast } from 'sonner'
import { buildXlsx } from '@/lib/files/xlsx'
import { saveFile, todayStamp } from '@/lib/files/save'
import { formatGregorian } from '@/lib/hebrewDate'
import { edaDetail, edaOf, hasEda } from '@/lib/eda'
import { he } from '@/lib/strings.he'
import type { CandidateRow, TabKey } from '@/lib/types'
import { errorMessage, fullName, hebrewCollator } from '@/lib/utils'
import { edaLabel } from './EdaFilter'

/**
 * Exports candidates to a real Excel workbook (.xlsx, right-to-left sheet).
 * `scope` names the file: the current table view, or every candidate.
 */
export async function exportCandidatesExcel(rows: CandidateRow[], scope: TabKey) {
  const inst =
    scope === 'male'
      ? he.table.yeshiva
      : scope === 'female'
        ? he.table.seminary
        : he.table.institutionAll
  const header = [
    he.table.fullName,
    he.table.type,
    he.table.age,
    he.detail.fields.hebrewBirthDate,
    he.detail.fields.gregorianBirthDate,
    he.table.city,
    he.detail.fields.region,
    he.detail.fields.community,
    inst,
    he.table.occupation,
    he.detail.fields.height,
    he.detail.fields.appearance,
    he.detail.fields.status,
    he.table.resume,
    he.table.notes,
  ]
  const sorted = [...rows].sort(
    (a, b) =>
      (a.gender === b.gender ? 0 : a.gender === 'male' ? -1 : 1) ||
      hebrewCollator.compare(fullName(a), fullName(b)),
  )
  const data = sorted.map((r) => [
    fullName(r),
    he.gender[r.gender],
    r.age,
    r.hebrew_birth_date,
    formatGregorian(r.birth_date),
    r.city,
    r.region,
    hasEda(r) ? edaLabel(edaOf(r), edaDetail(r)) : null,
    r.institution,
    r.occupation,
    r.height_cm,
    r.appearance,
    he.status[r.status],
    r.resume ? r.resume.file_name : he.resumeTable.none,
    r.general_notes,
  ])
  const name = scope === 'male' ? 'בחורים' : scope === 'female' ? 'בחורות' : 'כל-המועמדים'
  const filename = `${name}-${todayStamp()}.xlsx`
  try {
    const blob = buildXlsx(name.replace('-', ' '), header, data)
    if (await saveFile(filename, blob)) toast.success(he.exportCsv.done, { description: filename })
  } catch (e) {
    toast.error(he.exportCsv.failed, { description: errorMessage(e) })
  }
}
