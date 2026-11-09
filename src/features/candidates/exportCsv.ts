import { toast } from 'sonner'
import { hostErrorCode, isHosted, saveViaHost } from '@/lib/hostBridge'
import { he } from '@/lib/strings.he'
import type { CandidateRow, Gender } from '@/lib/types'
import { errorMessage } from '@/lib/utils'

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Exports the currently filtered rows. UTF-8 BOM so Excel shows Hebrew correctly. */
export async function exportCandidatesCsv(rows: CandidateRow[], gender: Gender) {
  const inst = gender === 'male' ? he.table.yeshiva : he.table.seminary
  const header = [
    he.table.fullName,
    he.table.age,
    he.detail.fields.hebrewBirthDate,
    inst,
    he.detail.fields.institutionType,
    he.table.occupation,
    he.table.city,
    he.detail.fields.region,
    he.detail.fields.community,
    he.detail.fields.chassidut,
    he.detail.fields.height,
    he.detail.fields.status,
    he.table.notes,
  ]
  const lines = rows.map((r) =>
    [
      `${r.first_name} ${r.last_name}`,
      r.age,
      r.hebrew_birth_date,
      r.institution,
      r.institution_type,
      r.occupation,
      r.city,
      r.region,
      r.community,
      r.chassidut,
      r.height_cm,
      he.status[r.status],
      r.general_notes,
    ]
      .map(cell)
      .join(','),
  )
  const csv = '﻿' + [header.map(cell).join(','), ...lines].join('\r\n')
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${gender === 'male' ? 'בחורים' : 'בחורות'}-${date}.csv`
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
