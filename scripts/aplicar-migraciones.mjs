// Aplica las migraciones SQL a Supabase usando SUPABASE_DB_URL (.env.local).
// Uso:
//   node scripts/aplicar-migraciones.mjs           → aplica 0001, 0002, 0003 en orden
//   node scripts/aplicar-migraciones.mjs 0002 0003 → aplica solo esas (para reintentos)
//
// Cada archivo se envía como un único query: Postgres lo ejecuta en una
// transacción implícita, así que si un archivo falla, ese archivo revierte
// completo (los anteriores ya quedaron aplicados).
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import pg from 'pg'

config({ path: '.env.local' })

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('❌ Falta SUPABASE_DB_URL en .env.local')
  process.exit(1)
}

const TODAS = [
  'supabase/migrations/0001_esquema.sql',
  'supabase/migrations/0002_seguridad.sql',
  'supabase/migrations/0003_municipios.sql',
  'supabase/migrations/0004_organizaciones.sql',
  'supabase/migrations/0005_mas_municipios.sql',
]

// Permite pasar sufijos (p. ej. "0002") para reintentar migraciones puntuales.
const filtros = process.argv.slice(2)
const migraciones = filtros.length
  ? TODAS.filter((f) => filtros.some((n) => f.includes(n)))
  : TODAS

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  for (const archivo of migraciones) {
    const sql = readFileSync(archivo, 'utf8')
    process.stdout.write(`Aplicando ${archivo} ... `)
    await client.query(sql)
    console.log('OK')
  }
  console.log(`\n✅ Migraciones aplicadas: ${migraciones.length}`)
} catch (e) {
  console.error(`\n❌ Error: ${e.message}`)
  if (e.hint) console.error(`   hint: ${e.hint}`)
  if (e.position) console.error(`   posición: ${e.position}`)
  process.exitCode = 1
} finally {
  await client.end()
}
