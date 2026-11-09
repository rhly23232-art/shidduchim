import { readText, unzip } from './unzip'

export type SheetCell = string | number | null
export interface Sheet {
  name: string
  rows: SheetCell[][]
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** Built-in + custom number formats that are dates. */
function dateStyleSet(stylesXml: string | null): Set<number> {
  const set = new Set<number>()
  if (!stylesXml) return set
  const doc = new DOMParser().parseFromString(stylesXml, 'application/xml')
  const custom = new Map<number, string>()
  for (const f of Array.from(doc.getElementsByTagNameNS(NS_MAIN, 'numFmt')))
    custom.set(Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '')
  const xfs = doc.getElementsByTagNameNS(NS_MAIN, 'cellXfs')[0]
  if (!xfs) return set
  Array.from(xfs.getElementsByTagNameNS(NS_MAIN, 'xf')).forEach((xf, i) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0)
    const code = custom.get(id) ?? ''
    const builtinDate = (id >= 14 && id <= 22) || (id >= 45 && id <= 47)
    const customDate = !!code && /[dy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, ''))
    if (builtinDate || customDate) set.add(i)
  })
  return set
}

/** Excel serial day → yyyy-mm-dd (1900 date system). */
export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Reads the first worksheet of an .xlsx file (Excel, Google Sheets, LibreOffice exports). */
export async function readXlsx(file: Blob): Promise<Sheet> {
  const zip = await unzip(file)
  const wb = await readText(zip, 'xl/workbook.xml')
  if (!wb) throw new Error('not an Excel workbook')
  const wbDoc = new DOMParser().parseFromString(wb, 'application/xml')
  const first = wbDoc.getElementsByTagNameNS(NS_MAIN, 'sheet')[0]
  const sheetName = first?.getAttribute('name') ?? ''
  const rid =
    first?.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id',
    ) ?? first?.getAttribute('r:id')
  let target = 'worksheets/sheet1.xml'
  const rels = await readText(zip, 'xl/_rels/workbook.xml.rels')
  if (rels && rid) {
    const relDoc = new DOMParser().parseFromString(rels, 'application/xml')
    for (const r of Array.from(relDoc.getElementsByTagName('Relationship'))) {
      if (r.getAttribute('Id') === rid) target = r.getAttribute('Target') ?? target
    }
  }
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
  const sheetXml = (await readText(zip, path)) ?? (await readText(zip, 'xl/worksheets/sheet1.xml'))
  if (!sheetXml) throw new Error('empty workbook')

  const shared: string[] = []
  const ss = await readText(zip, 'xl/sharedStrings.xml')
  if (ss) {
    const doc = new DOMParser().parseFromString(ss, 'application/xml')
    for (const si of Array.from(doc.getElementsByTagNameNS(NS_MAIN, 'si'))) {
      // rich text: concatenate every <t>, skipping phonetic runs
      const ts = Array.from(si.getElementsByTagNameNS(NS_MAIN, 't')).filter(
        (t) => t.parentElement?.localName !== 'rPh',
      )
      shared.push(ts.map((t) => t.textContent ?? '').join(''))
    }
  }
  const dateStyles = dateStyleSet(await readText(zip, 'xl/styles.xml'))

  const doc = new DOMParser().parseFromString(sheetXml, 'application/xml')
  const rows: SheetCell[][] = []
  for (const row of Array.from(doc.getElementsByTagNameNS(NS_MAIN, 'row'))) {
    const rIndex = Number(row.getAttribute('r') ?? rows.length + 1) - 1
    const out: SheetCell[] = []
    let next = 0
    for (const c of Array.from(row.getElementsByTagNameNS(NS_MAIN, 'c'))) {
      const ref = c.getAttribute('r')
      const ci = ref ? colIndex(ref) : next
      next = ci + 1
      const t = c.getAttribute('t')
      const v = c.getElementsByTagNameNS(NS_MAIN, 'v')[0]?.textContent ?? null
      let value: SheetCell = null
      if (t === 's') value = v !== null ? (shared[Number(v)] ?? null) : null
      else if (t === 'inlineStr')
        value = Array.from(c.getElementsByTagNameNS(NS_MAIN, 't'))
          .map((x) => x.textContent ?? '')
          .join('')
      else if (t === 'str' || t === 'e') value = v
      else if (t === 'b') value = v === '1' ? 'TRUE' : 'FALSE'
      else if (v !== null) {
        const num = Number(v)
        const style = Number(c.getAttribute('s') ?? -1)
        value = dateStyles.has(style) ? (excelSerialToIso(num) ?? num) : num
      }
      out[ci] = value
    }
    rows[rIndex] = Array.from(out, (x) => (x === undefined ? null : x))
  }
  return { name: sheetName, rows: Array.from(rows, (r) => r ?? []) }
}

/** RFC 4180 CSV with delimiter detection (, ; tab) and UTF-8 / Windows-1255 decoding. */
export async function readCsv(file: Blob): Promise<Sheet> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text = new TextDecoder('utf-8').decode(bytes)
  // Old Hebrew Excel saves CSV as Windows-1255: invalid UTF-8 shows replacement chars.
  if (text.includes('�')) text = new TextDecoder('windows-1255').decode(bytes)
  text = text.replace(/^\uFEFF/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = (['\t', ';', ','] as const)
    .map((d) => [d, firstLine.split(d).length] as const)
    .sort((a, b) => b[1] - a[1])[0]![0]
  const rows: SheetCell[][] = []
  let row: SheetCell[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return { name: '', rows: rows.map((r) => r.map((x) => (x === '' ? null : x))) }
}

export async function readSpreadsheet(file: File): Promise<Sheet> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') return readCsv(file)
  if (ext === 'xlsx' || ext === 'xlsm') return readXlsx(file)
  throw new Error('unsupported')
}
