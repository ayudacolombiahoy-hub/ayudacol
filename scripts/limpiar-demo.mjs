// Borra todos los datos marcados con "[DEMO]". Uso: node scripts/limpiar-demo.mjs
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Acopios antes que organizaciones (FK). Filas de demo por marca "[DEMO]".
  const a = await db.from('centros_acopio').delete().like('nombre', '%[DEMO]%')
  console.log('centros_acopio:', a.error ? a.error.message : 'ok')
  const o = await db.from('organizaciones').delete().like('nombre', '%[DEMO]%')
  console.log('organizaciones:', o.error ? o.error.message : 'ok')
  const s = await db.from('solicitudes_ayuda').delete().like('descripcion', '[DEMO]%')
  console.log('solicitudes_ayuda:', s.error ? s.error.message : 'ok')
  const v = await db.from('voluntarios').delete().like('nombre', '[DEMO]%')
  console.log('voluntarios:', v.error ? v.error.message : 'ok')
  console.log('\n🧹 Datos de demo eliminados.')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
