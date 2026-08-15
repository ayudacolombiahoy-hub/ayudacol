// Carga el CSV revisado a solicitudes_ayuda como sin_verificar/whatsapp.
// Uso: node scripts/importar-solicitudes/cargar.mjs <revisadas.csv> [--dry-run]
// --dry-run: solo valida y cuenta, no conecta a la base.
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { CAMPOS_CARGA, validarFilaCarga } from './mapeo.mjs'
import { deCSV } from './csv.mjs'

config({ path: '.env.local' })

// Guarda de privacidad: el insert lista columnas a mano; si CAMPOS_CARGA cambia
// (p. ej. alguien agrega un campo privado), abortamos antes de tocar la base.
const CAMPOS_ESPERADOS = ['categoria', 'urgencia', 'municipio_id', 'descripcion', 'detalle_ubicacion', 'personas_afectadas', 'contacto_nombre', 'contacto_telefono']
if (JSON.stringify(CAMPOS_CARGA) !== JSON.stringify(CAMPOS_ESPERADOS)) {
  console.error('❌ CAMPOS_CARGA cambió sin actualizar el insert de cargar.mjs')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const entrada = args.find((a) => !a.startsWith('--'))
if (!entrada) { console.error('❌ Falta el CSV. Uso: cargar.mjs <revisadas.csv> [--dry-run]'); process.exit(1) }

const filas = deCSV(readFileSync(entrada, 'utf8'))
const validas = []
let invalidas = 0
for (const [i, fila] of filas.entries()) {
  const v = validarFilaCarga(fila)
  if (!v.ok) { invalidas++; console.warn(`  ⚠️  fila ${i + 2} omitida (${v.errores.join(', ')})`); continue }
  validas.push(fila)
}

if (dryRun) {
  console.log(`🧪 dry-run: ${validas.length} válidas, ${invalidas} inválidas (no se insertó nada)`)
  process.exit(0)
}

const url = process.env.SUPABASE_DB_URL
if (!url) { console.error('❌ Falta SUPABASE_DB_URL en .env.local'); process.exit(1) }

const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
} catch (e) {
  console.error('❌ No se pudo conectar a la base:', e.message)
  process.exit(1)
}
let insertadas = 0, duplicadas = 0
try {
  for (const fila of validas) {
    const dup = await client.query(
      'select 1 from solicitudes_ayuda where contacto_telefono = $1 and descripcion = $2 limit 1',
      [fila.contacto_telefono, fila.descripcion],
    )
    if (dup.rowCount) { duplicadas++; continue }
    await client.query(
      `insert into solicitudes_ayuda
         (categoria, urgencia, municipio_id, descripcion, detalle_ubicacion,
          personas_afectadas, contacto_nombre, contacto_telefono, estado, origen)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'sin_verificar','whatsapp')`,
      [
        fila.categoria, fila.urgencia, fila.municipio_id, fila.descripcion,
        fila.detalle_ubicacion || null,
        fila.personas_afectadas ? Number(fila.personas_afectadas) : null,
        fila.contacto_nombre, fila.contacto_telefono,
      ],
    )
    insertadas++
  }
} finally {
  await client.end()
}
console.log(`✅ insertadas: ${insertadas} | duplicadas omitidas: ${duplicadas} | inválidas: ${invalidas}`)
