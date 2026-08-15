// Verifica invariantes del demo: (1) "DEMO" NO aparece en la vista pública,
// (2) cada municipio tiene >= 50 necesidades activas.
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// (1) Vista pública sin "DEMO" y sin datos de contacto
const { data: pub } = await anon.from('solicitudes_publicas').select('*').limit(1000)
const conDemo = (pub ?? []).filter((r) => JSON.stringify(r).toLowerCase().includes('demo')).length
const exponeContacto = (pub ?? []).some((r) => 'contacto_nombre' in r || 'contacto_telefono' in r)
console.log(`(1) filas públicas revisadas: ${pub?.length ?? 0}`)
console.log(`    con "demo" visible: ${conDemo}  ${conDemo === 0 ? '✅' : '❌'}`)
console.log(`    exponen contacto:   ${exponeContacto ? 'SÍ ❌' : 'no ✅'}`)

// (2) Activas por municipio (service_role para conteo global)
const ACTIVOS = ['sin_verificar', 'verificada', 'en_atencion', 'por_reconfirmar']
const { data: munis } = await admin.from('municipios').select('codigo_dane')
let minActivas = Infinity
let peor = null
let total = 0
for (const m of munis) {
  const { count } = await admin
    .from('solicitudes_ayuda')
    .select('*', { count: 'exact', head: true })
    .eq('municipio_id', m.codigo_dane)
    .in('estado', ACTIVOS)
  total += count ?? 0
  if ((count ?? 0) < minActivas) { minActivas = count ?? 0; peor = m.codigo_dane }
}
console.log(`(2) municipios: ${munis.length}, total activas: ${total}`)
console.log(`    mínimo activas por municipio: ${minActivas} (municipio ${peor})  ${minActivas >= 50 ? '✅ >=50' : '❌ <50'}`)
