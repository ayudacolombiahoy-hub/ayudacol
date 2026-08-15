// Siembra un conjunto GRANDE de datos de DEMOSTRACIÓN, repartido por todos los
// municipios del catálogo. Todo queda marcado con "[DEMO]".
// Re-ejecutable: primero borra la demo anterior y luego siembra fresca.
// Uso: node scripts/sembrar-demo.mjs   (opcional: node scripts/sembrar-demo.mjs 120)
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const M = '[DEMO]'
const N_NECESIDADES = Number(process.argv[2]) || 90
const tel = () => `+57 3${Math.floor(10 + Math.random() * 89)} ${Math.floor(1000000 + Math.random() * 8999999)}`
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const nOf = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n)

const CATS = ['alimentos', 'agua', 'albergue', 'materiales_construccion', 'remocion_escombros', 'salud', 'rescate', 'otro']
const URG = ['alta', 'alta', 'media', 'media', 'media', 'baja'] // sesgo hacia media/alta
const EST = ['verificada', 'verificada', 'verificada', 'sin_verificar', 'sin_verificar', 'en_atencion', 'resuelta', 'por_reconfirmar']
const HAB = ['medico', 'psicologo', 'remocion_escombros', 'logistica', 'transporte', 'construccion', 'otro']
const TIPOS_ORG = ['ong', 'alcaldia', 'bomberos', 'iglesia', 'empresa', 'comunitaria']
const DESC = {
  alimentos: 'Se necesitan mercados y alimentos no perecederos para las familias',
  agua: 'Falta agua potable en el sector tras el sismo',
  albergue: 'Familias evacuadas necesitan alojamiento temporal',
  materiales_construccion: 'Se requieren materiales (tejas, madera, cemento) para reparar viviendas',
  remocion_escombros: 'Se necesita remoción de escombros y maquinaria',
  salud: 'Atención médica y medicamentos requeridos en la zona',
  rescate: 'Reporte de personas atrapadas, se solicita apoyo de rescate',
  otro: 'Necesidad reportada por la comunidad afectada',
}

async function limpiar() {
  await db.from('centros_acopio').delete().like('nombre', '%[DEMO]%')
  await db.from('organizaciones').delete().like('nombre', '%[DEMO]%')
  await db.from('solicitudes_ayuda').delete().like('descripcion', '[DEMO]%')
  await db.from('voluntarios').delete().like('nombre', '[DEMO]%')
}

async function main() {
  await limpiar()

  const { data: munis, error: em } = await db.from('municipios').select('codigo_dane, departamento')
  if (em) throw new Error('municipios: ' + em.message)
  if (!munis?.length) throw new Error('No hay municipios en el catálogo.')

  // Pool ponderado: capitales de departamento aparecen más veces.
  const CAPITALES = ['17001', '66001', '63001', '76001', '27001']
  const pool = [...munis.map((m) => m.codigo_dane), ...CAPITALES, ...CAPITALES, ...CAPITALES]

  // --- Necesidades ---
  const nec = Array.from({ length: N_NECESIDADES }, (_, i) => {
    const categoria = pick(CATS)
    const estado = pick(EST)
    return {
      categoria,
      urgencia: pick(URG),
      municipio_id: pick(pool),
      estado,
      personas_afectadas: Math.floor(1 + Math.random() * 80),
      descripcion: `${M} ${DESC[categoria]}`,
      contacto_nombre: `Contacto Demo ${i + 1}`,
      contacto_telefono: tel(),
      origen: Math.random() < 0.2 ? 'whatsapp' : 'web',
      verificada_en: ['verificada', 'en_atencion', 'resuelta'].includes(estado) ? new Date().toISOString() : null,
    }
  })
  const { error: e1 } = await db.from('solicitudes_ayuda').insert(nec)
  if (e1) throw new Error('necesidades: ' + e1.message)
  console.log(`✅ ${nec.length} necesidades`)

  // --- Organizaciones ---
  const orgsData = [
    { nombre: `Cruz Roja Seccional ${M}`, tipo: 'ong' },
    { nombre: `Bomberos Voluntarios ${M}`, tipo: 'bomberos' },
    { nombre: `Fundación Café y Vida ${M}`, tipo: 'ong' },
    { nombre: `Parroquia San José ${M}`, tipo: 'iglesia' },
  ].map((o) => ({ ...o, estado: 'aprobada', descripcion: 'Organización de demostración' }))
  const { data: orgs, error: e2 } = await db.from('organizaciones').insert(orgsData).select('id')
  if (e2) throw new Error('organizaciones: ' + e2.message)
  console.log(`✅ ${orgs.length} organizaciones`)

  // --- Centros de acopio ---
  const RECIBE = ['agua', 'alimentos', 'cobijas', 'kits de aseo', 'medicamentos', 'pañales', 'agua potable']
  const NONEC = ['ropa usada', 'juguetes', 'muebles', '']
  const aco = Array.from({ length: 18 }, (_, i) => ({
    organizacion_id: pick(orgs).id,
    nombre: `Centro de acopio ${i + 1} ${M}`,
    direccion: `Cra ${1 + i} # ${10 + i}-${20 + i}`,
    municipio_id: pick(pool),
    horarios: pick(['8am-6pm', '9am-5pm', '24h', '7am-7pm']),
    recibe: nOf(RECIBE, 2 + Math.floor(Math.random() * 3)),
    no_necesita: Math.random() < 0.5 ? [pick(NONEC)].filter(Boolean) : [],
    estado: pick(['activo', 'activo', 'activo', 'lleno', 'cerrado']),
  }))
  const { error: e3 } = await db.from('centros_acopio').insert(aco)
  if (e3) throw new Error('acopios: ' + e3.message)
  console.log(`✅ ${aco.length} centros de acopio`)

  // --- Voluntarios ---
  const vol = Array.from({ length: 28 }, (_, i) => ({
    nombre: `${M} Voluntario ${i + 1}`,
    habilidades: nOf(HAB, 1 + Math.floor(Math.random() * 2)),
    disponibilidad: pick(['Fines de semana', 'Tiempo completo', 'Tardes', 'Por turnos']),
    municipio_id: pick(pool),
    contacto_telefono: tel(),
    estado: 'disponible',
  }))
  const { error: e4 } = await db.from('voluntarios').insert(vol)
  if (e4) throw new Error('voluntarios: ' + e4.message)
  console.log(`✅ ${vol.length} voluntarios`)

  console.log('\n🌱 Demo sembrada. Bórrala con: node scripts/limpiar-demo.mjs')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
