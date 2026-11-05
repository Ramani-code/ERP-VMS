/*
 * A small, dependency-free PDF writer for report tables (A4 landscape, Helvetica, several pages).
 * Standard PDF fonts only cover Latin characters, so anything else is written as "?".
 */

export interface PdfTable {
  title: string
  subtitle: string
  headers: string[]
  rows: string[][]
}

const PAGE_W = 842
const PAGE_H = 595
const MARGIN = 28
const TABLE_TOP = 96
const BOTTOM = 40
const ROW_H = 15
const HEAD_H = 18
const FONT = 7.5

/** Text inside a PDF string: printable ASCII only, with brackets and backslashes escaped. */
const pdfText = (s: string) => s.replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, (c) => `\\${c}`)

function columnWidths(headers: string[], rows: string[][], total: number): number[] {
  const weights = headers.map((h, i) => {
    const longest = rows.reduce((max, r) => Math.max(max, (r[i] ?? '').length), h.length)
    return Math.min(Math.max(longest, 5), 26)
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => (total * w) / sum)
}

function fit(text: string, widthPt: number): string {
  const maxChars = Math.max(1, Math.floor((widthPt - 6) / (FONT * 0.5)))
  const clean = text.replace(/\s+/g, ' ')
  return clean.length <= maxChars ? clean : `${clean.slice(0, Math.max(1, maxChars - 1))}.`
}

export function buildTablePdf(table: PdfTable): Blob {
  const total = PAGE_W - MARGIN * 2
  const widths = columnWidths(table.headers, table.rows, total)
  const perPage = Math.max(1, Math.floor((PAGE_H - TABLE_TOP - BOTTOM - HEAD_H) / ROW_H))
  const chunks: string[][][] = []
  for (let i = 0; i < table.rows.length; i += perPage) chunks.push(table.rows.slice(i, i + perPage))
  if (chunks.length === 0) chunks.push([])

  const stamp = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  const text = (x: number, y: number, s: string, size: number, font: 'F1' | 'F2', gray = 0.1) =>
    `BT /${font} ${size} Tf ${gray} g ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(s)}) Tj ET`

  const pageContents = chunks.map((chunk, pageNo) => {
    const ops: string[] = []
    ops.push(text(MARGIN, PAGE_H - 36, table.title, 14, 'F2'))
    ops.push(text(MARGIN, PAGE_H - 52, table.subtitle, 8.5, 'F1', 0.35))

    let y = PAGE_H - TABLE_TOP
    ops.push(`0.86 0.91 0.98 rg ${MARGIN} ${(y - HEAD_H).toFixed(2)} ${total} ${HEAD_H} re f`)
    let x = MARGIN
    table.headers.forEach((h, i) => {
      ops.push(text(x + 3, y - 12, fit(h, widths[i]), FONT, 'F2'))
      x += widths[i]
    })
    y -= HEAD_H

    chunk.forEach((row, ri) => {
      if (ri % 2 === 1) ops.push(`0.97 0.98 0.99 rg ${MARGIN} ${(y - ROW_H).toFixed(2)} ${total} ${ROW_H} re f`)
      let cx = MARGIN
      widths.forEach((w, i) => {
        ops.push(text(cx + 3, y - 10.5, fit(row[i] ?? '', w), FONT, 'F1'))
        cx += w
      })
      y -= ROW_H
    })
    ops.push(`0.75 0.8 0.85 RG 0.5 w ${MARGIN} ${(y).toFixed(2)} m ${PAGE_W - MARGIN} ${(y).toFixed(2)} l S`)

    if (table.rows.length === 0) ops.push(text(MARGIN, PAGE_H - TABLE_TOP - HEAD_H - 16, 'No records for these filters.', 9, 'F1', 0.35))
    ops.push(text(MARGIN, 18, `Generated ${stamp}`, 7.5, 'F1', 0.45))
    ops.push(text(PAGE_W - MARGIN - 80, 18, `Page ${pageNo + 1} of ${chunks.length}`, 7.5, 'F1', 0.45))
    return ops.join('\n')
  })

  // Object 1: catalog, 2: pages, 3: Helvetica, 4: Helvetica-Bold, then a page and content stream per page.
  const pageObjNums = pageContents.map((_, i) => 5 + i * 2)
  const objects: string[] = []
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageContents.length} >>`
  objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  pageContents.forEach((content, i) => {
    const pageNum = pageObjNums[i]
    objects[pageNum - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNum + 1} 0 R >>`
    objects[pageNum] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  })

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((o) => { out += `${String(o).padStart(10, '0')} 00000 n \n` })
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  const bytes = new Uint8Array(new ArrayBuffer(out.length))
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff
  return new Blob([bytes], { type: 'application/pdf' })
}
