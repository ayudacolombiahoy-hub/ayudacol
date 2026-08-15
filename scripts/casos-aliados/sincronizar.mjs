// Sincroniza casos_aliados desde el API de mimanizales.info.
// Uso: node scripts/casos-aliados/sincronizar.mjs [--dry-run]
// Descarta contacto/pago vía mapearCaso. Una sola llamada al API por corrida.
import { config } from 'dotenv'
import pg from 'pg'
import { mapearCaso } from './mapeo.mjs'

config({ path: '.env.local' })

const API = 'https://n8n.srv1571385.hstgr.cloud/webhook/mimanizales/necesidades'
const dryRun = process.argv.includes('--dry-run')

let items
try {
  const r = await fetch(API, { headers: { Accept: 'application/json' } })
  const j = await r.json()
  items = j.items || []
} catch (e) {
  console.error('❌ No se pudo leer el API:', e.message)
  process.exit(1)
}
if (!items.length) { console.error('❌ El API no devolvió casos; no se toca la base.'); process.exit(1) }

const filas = items.map(mapearCaso).filter((f) => f.case_id)
console.log(`ℹ️  ${filas.length} casos recibidos del API`)
if (dryRun) { console.log('🧪 dry-run: no se escribió nada'); process.exit(0) }

const url = process.env.SUPABASE_DB_URL
if (!url) { console.error('❌ Falta SUPABASE_DB_URL en .env.local'); process.exit(1) }

const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
} catch (e) {
  console.error('❌ No se pudo conectar a la base:', e.message)
  process.exit(1)
}
let n = 0
try {
  for (const f of filas) {
    await client.query(
      `insert into casos_aliados
         (case_id, titulo, resumen_corto, municipio, sector, prioridad, grupos_objetivo,
          tipos_necesidad, necesidades_detalle, imagen_url, url_origen, estado, finalizado,
          fecha_verificacion, orden, sincronizado_en)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
       on conflict (case_id) do update set
         titulo = excluded.titulo, resumen_corto = excluded.resumen_corto,
         municipio = excluded.municipio, sector = excluded.sector,
         prioridad = excluded.prioridad, grupos_objetivo = excluded.grupos_objetivo,
         tipos_necesidad = excluded.tipos_necesidad, necesidades_detalle = excluded.necesidades_detalle,
         imagen_url = excluded.imagen_url, url_origen = excluded.url_origen,
         estado = excluded.estado, finalizado = excluded.finalizado,
         fecha_verificacion = excluded.fecha_verificacion, orden = excluded.orden,
         sincronizado_en = now()`,
      [f.case_id, f.titulo, f.resumen_corto, f.municipio, f.sector, f.prioridad, f.grupos_objetivo,
       f.tipos_necesidad, f.necesidades_detalle, f.imagen_url, f.url_origen, f.estado, f.finalizado,
       f.fecha_verificacion, f.orden],
    )
    n++
  }
  const ids = filas.map((f) => f.case_id)
  const aus = await client.query(
    `update casos_aliados set estado = 'AUSENTE', sincronizado_en = now() where not (case_id = any($1))`,
    [ids],
  )
  console.log(`✅ sincronizados: ${n} | marcados ausentes: ${aus.rowCount}`)
} finally {
  await client.end()
}
