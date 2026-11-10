import { describe, expect, it } from 'vitest'
import { buildDocx } from '@/lib/files/docx'
import { excelSerialToIso, readCsv, readXlsx } from '@/lib/files/readSheet'
import { readText, unzip } from '@/lib/files/unzip'
import { buildXlsx } from '@/lib/files/xlsx'
import { zip } from '@/lib/files/zip'

describe('zip / unzip', () => {
  it('round-trips text and binary entries with Hebrew names', async () => {
    const bin = new Uint8Array([0, 1, 2, 250, 255])
    const blob = zip(
      [
        { name: 'קובץ.txt', data: 'שלום' },
        { name: 'dir/b.bin', data: bin },
      ],
      'application/zip',
    )
    const files = await unzip(blob)
    expect([...files.keys()]).toEqual(['קובץ.txt', 'dir/b.bin'])
    expect(await readText(files, 'קובץ.txt')).toBe('שלום')
    expect([...(await files.get('dir/b.bin')!())]).toEqual([...bin])
  })
  it('rejects non-zip input', async () => {
    await expect(unzip(new Blob(['hello']))).rejects.toThrow()
  })
})

describe('xlsx', () => {
  it('writes a workbook that reads back with numbers, Hebrew and special characters', async () => {
    const blob = buildXlsx(
      'מועמדים',
      ['שם', 'גיל', 'הערות'],
      [
        ['יוסף כהן', 23, 'a & b <c> "d"'],
        ['=1+1', null, 'שורה\nשנייה'],
      ],
    )
    const sheet = await readXlsx(blob)
    expect(sheet.name).toBe('מועמדים')
    expect(sheet.rows[0]).toEqual(['שם', 'גיל', 'הערות'])
    expect(sheet.rows[1]).toEqual(['יוסף כהן', 23, 'a & b <c> "d"'])
    // formulas are stored as plain text, never evaluated
    expect(sheet.rows[2]![0]).toBe('=1+1')
    expect(sheet.rows[2]![2]).toBe('שורה\nשנייה')
  })
  it('converts Excel date serials', () => {
    expect(excelSerialToIso(37301)).toBe('2002-02-14')
    expect(excelSerialToIso(0)).toBeNull()
  })
})

describe('csv', () => {
  it('parses quoted fields, semicolons and a BOM', async () => {
    const csv = '﻿שם;עיר\n"כהן; יוסף";"בני ""ברק"""\n'
    const s = await readCsv(new Blob([csv]))
    expect(s.rows).toEqual([
      ['שם', 'עיר'],
      ['כהן; יוסף', 'בני "ברק"'],
    ])
  })
  it('decodes old Hebrew Windows-1255 files', async () => {
    // "שם,עיר" in Windows-1255
    const bytes = new Uint8Array([0xf9, 0xed, 0x2c, 0xf2, 0xe9, 0xf8, 0x0a])
    const s = await readCsv(new Blob([bytes]))
    expect(s.rows[0]).toEqual(['שם', 'עיר'])
  })
})

describe('docx', () => {
  it('produces a valid Word package with RTL text', async () => {
    const blob = buildDocx([
      { kind: 'title', text: 'רזומה' },
      { kind: 'field', label: 'שם', value: 'יוסף & <כהן>' },
    ])
    const files = await unzip(blob)
    const doc = (await readText(files, 'word/document.xml'))!
    expect(doc).toContain('<w:bidi/>')
    expect(doc).toContain('יוסף &amp; &lt;כהן&gt;')
    expect(files.has('[Content_Types].xml')).toBe(true)
  })
})
