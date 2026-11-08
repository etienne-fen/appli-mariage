// Shared helpers for the admin Excel exports. exceljs is loaded on demand so it
// never weighs on the guests' pages.

export async function newWorkbook() {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Appli mariage'
  wb.created = new Date()
  return wb
}

export function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E4A2E' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
}

export function exportedOn() {
  return `Export du ${new Date().toLocaleString('fr-FR')}`
}

export async function downloadWorkbook(wb, baseName) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName}-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
