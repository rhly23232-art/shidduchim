import { toast } from 'sonner'
import { edaDetail, edaOf, hasEda } from '@/lib/eda'
import { edaLabel } from './EdaFilter'
import { hostErrorCode, isHosted, saveViaHost } from '@/lib/hostBridge'
import { he } from '@/lib/strings.he'
import type { CandidateRow, TabKey } from '@/lib/types'
import { errorMessage } from '@/lib/utils'

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Exports the currently filtered rows. UTF-8 BOM so Excel shows Hebrew correctly. */
export async function exportCandidatesCsv(rows: CandidateRow[], gender: TabKey) {
  const inst =
    gender === 'male'
      ? he.table.yeshiva
      : gender === 'female'
        ? he.table.seminary
        : he.table.institutionAll
  const header = [
    he.table.fullName,
    he.table.type,
    he.table.age,
    he.detail.fields.hebrewBirthDate,
    inst,
    he.table.occupation,
    he.table.city,
    he.detail.fields.region,
    he.detail.fields.community,
    he.detail.fields.height,
    he.detail.fields.status,
    he.table.notes,
  ]
  const lines = rows.map((r) =>
    [
      `${r.first_name} ${r.last_name}`,
      he.gender[r.gender],
      r.age,
      r.hebrew_birth_date,
      r.institution,
      r.occupation,
      r.city,
      r.region,
      hasEda(r) ? edaLabel(edaOf(r), edaDetail(r)) : null,
      r.height_cm,
      he.status[r.status],
      r.general_notes,
    ]
      .map(cell)
      .join(','),
  )
  const csv = '﻿' + [header.map(cell).join(','), ...lines].join('\r\n')
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${gender === 'male' ? 'בחורים' : gender === 'female' ? 'בחורות' : 'כל-המועמדים'}-${date}.csv`
  try {
    if (isHosted() && (await saveViaHost(filename, csv))) {
      toast.success(he.exportCsv.done, { description: filename })
      return
    }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    toast.success(he.exportCsv.done, { description: filename })
  } catch (e) {
    if (hostErrorCode(e) === 'declined') return
    toast.error(he.exportCsv.failed, { description: errorMessage(e) })
  }
}
