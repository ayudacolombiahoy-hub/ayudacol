// Verifica el estado del esquema en Supabase (tablas, vistas, RLS, semillas).
// Uso: node scripts/verificar-bd.mjs
import { config } from 'dotenv'
import pg from 'pg'

config({ path: '.env.local' })

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  const objs = await client.query(
    "select table_type, table_name from information_schema.tables where table_schema='public' order by table_type, table_name"
  )
  const tablas = objs.rows.filter((r) => r.table_type === 'BASE TABLE').map((r) => r.table_name)
  const vistas = objs.rows.filter((r) => r.table_type === 'VIEW').map((r) => r.table_name)
  console.log(`TABLAS (${tablas.length}): ${tablas.join(', ')}`)
  console.log(`VISTAS (${vistas.length}): ${vistas.join(', ')}`)

  const rls = await client.query(
    "select count(*)::int as n from pg_tables t join pg_class c on c.relname=t.tablename where t.schemaname='public' and c.relrowsecurity"
  )
  console.log(`Tablas con RLS activo: ${rls.rows[0].n}`)

  const pol = await client.query(
    "select count(*)::int as n from pg_policies where schemaname='public'"
  )
  console.log(`Políticas RLS: ${pol.rows[0].n}`)

  const muni = await client.query('select count(*)::int as n from municipios')
  console.log(`Municipios sembrados: ${muni.rows[0].n}`)
} finally {
  await client.end()
}
