// Borra todos los datos de DEMOSTRACIÓN (esquema viejo "[DEMO]" y nuevo "Demo"/"DEMO").
// Uso: node scripts/limpiar-demo.mjs
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Hijos de orgs demo (acopios, albergues, refugios) ANTES que las orgs (FK).
  const { data: orgsDemo } = await db
    .from('organizaciones')
    .select('id')
    .or('descripcion.like.DEMO%,nombre.like.%[DEMO]%')
  if (orgsDemo?.length) {
    const ids = orgsDemo.map((o) => o.id)
    const r = await db.from('centros_acopio').delete().in('organizacion_id', ids)
    console.log('acopios (por org):', r.error ? r.error.message : 'ok')
    const al = await db.from('albergues').delete().in('organizacion_id', ids)
    console.log('albergues (por org):', al.error ? al.error.message : 'ok')
    const rf = await db.from('refugios_animales').delete().in('organizacion_id', ids)
    console.log('refugios (por org):', rf.error ? rf.error.message : 'ok')
  }
  const a = await db.from('centros_acopio').delete().like('nombre', '%[DEMO]%')
  console.log('acopios (nombre viejo):', a.error ? a.error.message : 'ok')

  const o1 = await db.from('organizaciones').delete().like('descripcion', 'DEMO%')
  console.log('orgs (descripción):', o1.error ? o1.error.message : 'ok')
  const o2 = await db.from('organizaciones').delete().like('nombre', '%[DEMO]%')
  console.log('orgs (nombre viejo):', o2.error ? o2.error.message : 'ok')

  const s1 = await db.from('solicitudes_ayuda').delete().like('contacto_nombre', 'Demo %')
  console.log('necesidades (contacto):', s1.error ? s1.error.message : 'ok')
  const s2 = await db.from('solicitudes_ayuda').delete().like('descripcion', '[DEMO]%')
  console.log('necesidades (desc viejo):', s2.error ? s2.error.message : 'ok')

  const v1 = await db.from('voluntarios').delete().like('nombre', 'Demo %')
  console.log('voluntarios (nuevo):', v1.error ? v1.error.message : 'ok')
  const v2 = await db.from('voluntarios').delete().like('nombre', '[DEMO]%')
  console.log('voluntarios (viejo):', v2.error ? v2.error.message : 'ok')

  // Secciones sensibles con marca VISIBLE "[EJEMPLO]" (desaparecidos, mascotas, novedades).
  const d1 = await db.from('personas_desaparecidas').delete().like('nombre', '[EJEMPLO]%')
  console.log('desaparecidos (ejemplo):', d1.error ? d1.error.message : 'ok')
  const m1 = await db.from('mascotas').delete().like('descripcion', '[EJEMPLO]%')
  console.log('mascotas (ejemplo):', m1.error ? m1.error.message : 'ok')
  const n1 = await db.from('novedades').delete().like('titulo_es', '[EJEMPLO]%')
  console.log('novedades (ejemplo):', n1.error ? n1.error.message : 'ok')

  console.log('\n🧹 Datos de demo eliminados.')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
