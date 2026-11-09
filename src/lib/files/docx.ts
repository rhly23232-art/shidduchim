import { xmlEscape, zip } from './zip'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export type DocBlock =
  | { kind: 'title'; text: string }
  | { kind: 'subtitle'; text: string }
  | { kind: 'heading'; text: string }
  /** label + value; an empty value prints a line to write on */
  | { kind: 'field'; label: string; value?: string }
  /** free text area; empty prints `lines` writing lines */
  | { kind: 'area'; label?: string; value?: string; lines?: number }
  | { kind: 'spacer' }

const RTL_RUN = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
  `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${opts.bold ? '<w:b/><w:bCs/>' : ''}${
    opts.color ? `<w:color w:val="${opts.color}"/>` : ''
  }<w:sz w:val="${opts.size ?? 24}"/><w:szCs w:val="${opts.size ?? 24}"/><w:rtl/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`

const para = (
  runs: string,
  opts: { after?: number; before?: number; align?: 'center'; border?: boolean } = {},
) =>
  `<w:p><w:pPr><w:bidi/>${opts.align ? `<w:jc w:val="${opts.align}"/>` : ''}${
    opts.border
      ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFC3CA"/></w:pBdr>'
      : ''
  }<w:spacing w:before="${opts.before ?? 0}" w:after="${opts.after ?? 120}"/></w:pPr>${runs}</w:p>`

/** Multi-line values become separate paragraphs. */
const textParas = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => para(RTL_RUN(line), { after: 60 }))
    .join('')

function blockXml(b: DocBlock): string {
  switch (b.kind) {
    case 'title':
      return para(RTL_RUN(b.text, { bold: true, size: 40, color: '202124' }), {
        align: 'center',
        after: 80,
      })
    case 'subtitle':
      return para(RTL_RUN(b.text, { size: 22, color: '6B6F76' }), { align: 'center', after: 360 })
    case 'heading':
      return para(RTL_RUN(b.text, { bold: true, size: 28, color: '3A57A8' }), {
        before: 280,
        after: 160,
        border: true,
      })
    case 'field':
      return b.value?.trim()
        ? para(RTL_RUN(`${b.label}: `, { bold: true }) + RTL_RUN(b.value.trim()), { after: 100 })
        : para(
            RTL_RUN(`${b.label}: `, { bold: true }) + RTL_RUN('_'.repeat(48), { color: 'A0A4AB' }),
            { after: 160 },
          )
    case 'area': {
      const label = b.label ? para(RTL_RUN(b.label, { bold: true }), { after: 60 }) : ''
      if (b.value?.trim()) return label + textParas(b.value.trim())
      // Separate underscore lines: bordered empty paragraphs get merged into one by Word.
      const lines = Array.from({ length: b.lines ?? 3 }, () =>
        para(RTL_RUN('_'.repeat(68), { color: 'A0A4AB' }), { after: 200 }),
      ).join('')
      return label + lines
    }
    case 'spacer':
      return para(RTL_RUN(' '))
  }
}

/** Right-to-left Word document (A4, Arial) built from simple blocks. */
export function buildDocx(blocks: DocBlock[]): Blob {
  const body = blocks.map(blockXml).join('')
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`
  return zip(
    [
      {
        name: '[Content_Types].xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      },
      {
        name: '_rels/.rels',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      },
      { name: 'word/document.xml', data: document },
    ],
    DOCX_MIME,
  )
}
