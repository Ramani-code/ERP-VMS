/*
 * Excel workbook written as "XML Spreadsheet 2003", which Excel opens directly and which supports several sheets.
 * No library is needed. Values are written as text so names, plates and times keep their exact form.
 */

export interface SheetData {
  name: string
  headers: string[]
  rows: string[][]
}

/** Characters XML cannot hold. */
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
const esc = (s: string) =>
  clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function rowXml(values: string[], header = false): string {
  const cells = values
    .map((v) => `<Cell${header ? ' ss:StyleID="hdr"' : ''}><Data ss:Type="String">${esc(v ?? '')}</Data></Cell>`)
    .join('')
  return `<Row>${cells}</Row>`
}

/** Sheet names are limited to 31 characters and may not contain : \ / ? * [ ]. */
const sheetName = (s: string) => esc(s.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31))

export function buildWorkbook(sheets: SheetData[]): Blob {
  const worksheets = sheets.map((s) =>
    `<Worksheet ss:Name="${sheetName(s.name)}"><Table>` +
    rowXml(s.headers, true) +
    s.rows.map((r) => rowXml(r)).join('') +
    `</Table></Worksheet>`
  )
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n` +
    `<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DCE8FA" ss:Pattern="Solid"/></Style></Styles>\n` +
    worksheets.join('\n') +
    `\n</Workbook>`
  return new Blob([xml], { type: 'application/vnd.ms-excel' })
}
