// Normaliza el JSON crudo extraído de redayudamanizales.com a un CSV revisable.
// Uso: node scripts/importar-solicitudes/normalizar.mjs <crudos.json> [--dias 14] [--ahora ISO] [--salida archivo.csv]
import { readFileSync, writeFileSync } from 'node:fs'
import { COLUMNAS_CSV, filaParaRevisar } from './mapeo.mjs'
import { aCSV } from './csv.mjs'

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const entrada = args.find((a) => !a.startsWith('--') && (args.indexOf(a) === 0 || !args[args.indexOf(a) - 1]?.startsWith('--')))

if (!entrada) { console.error('❌ Falta el JSON crudo. Uso: normalizar.mjs <crudos.json> [--dias N]'); process.exit(1) }

const dias = Number(flag('--dias') ?? 14)
const ahoraISO = flag('--ahora') ?? new Date().toISOString()
const salida = flag('--salida') ?? 'solicitudes-para-revisar.csv'

const crudos = JSON.parse(readFileSync(entrada, 'utf8'))
const conteo = { total: crudos.length, no_necesidad: 0, fuera_ventana: 0, incluidas: 0 }
const filas = []
for (const item of crudos) {
  const r = filaParaRevisar(item, { dias, ahoraISO })
  if (!r.incluir) { conteo[r.motivo === 'no_es_necesidad' ? 'no_necesidad' : 'fuera_ventana']++; continue }
  filas.push(r.fila)
  conteo.incluidas++
}
// Orden: alta urgencia primero, luego más reciente.
const peso = { alta: 0, media: 1, baja: 2 }
filas.sort((a, b) => (peso[a.urgencia] - peso[b.urgencia]) || String(b.fecha_fuente).localeCompare(String(a.fecha_fuente)))

writeFileSync(salida, aCSV(filas, COLUMNAS_CSV))
const conBandera = filas.filter((f) => f.revisar).length
console.log(`✅ ${conteo.incluidas} filas → ${salida}`)
console.log(`   descartadas: ${conteo.no_necesidad} no-necesidad, ${conteo.fuera_ventana} fuera de ${dias} días`)
console.log(`   ⚠️  ${conBandera} filas con banderas para revisar (columna "revisar")`)
