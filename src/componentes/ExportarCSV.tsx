'use client'

export type FilaCSV = Record<string, string | number>

// Escapa una celda para CSV (RFC 4180): entre comillas si contiene coma,
// comilla, punto y coma o salto de línea; las comillas internas se duplican.
function celdaCSV(valor: string | number): string {
  const s = String(valor)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function generarCSV(filas: FilaCSV[]): string {
  if (filas.length === 0) return ''
  const columnas = Object.keys(filas[0])
  const encabezado = columnas.map(celdaCSV).join(',')
  const cuerpo = filas.map((fila) => columnas.map((c) => celdaCSV(fila[c])).join(',')).join('\n')
  return `${encabezado}\n${cuerpo}`
}

// Genera un CSV en el navegador a partir de un arreglo de objetos y dispara
// su descarga (Blob + enlace temporal con URL.createObjectURL). No requiere
// ninguna librería externa.
export default function ExportarCSV({
  filas, nombreArchivo = 'estadisticas.csv', etiqueta = 'Descargar CSV',
}: { filas: FilaCSV[]; nombreArchivo?: string; etiqueta?: string }) {
  function descargar() {
    if (filas.length === 0) return
    // BOM UTF-8 para que Excel muestre bien tildes/eñes.
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + generarCSV(filas)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombreArchivo
    document.body.appendChild(enlace)
    enlace.click()
    document.body.removeChild(enlace)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={descargar}
      disabled={filas.length === 0}
      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      ⬇️ {etiqueta}
    </button>
  )
}
