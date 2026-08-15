// Siembra datos de DEMOSTRACIÓN para ver la plataforma poblada.
// Todo queda marcado con "[DEMO]" y se borra con: node scripts/limpiar-demo.mjs
// Uso: node scripts/sembrar-demo.mjs
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const M = '[DEMO]'
const tel = (n) => `+57 300 000 ${String(1000 + n).slice(-4)}`

// ---- Necesidades: (categoria, urgencia, municipio, estado) ----
const NEC = [
  ['agua', 'alta', '27001', 'verificada', 45, 'Barrio sin agua potable tras el sismo, familias con niños'],
  ['alimentos', 'alta', '27361', 'verificada', 30, 'Comunidad aislada necesita mercados y agua'],
  ['albergue', 'media', '17001', 'verificada', 12, 'Familias evacuadas necesitan alojamiento temporal'],
  ['remocion_escombros', 'alta', '17001', 'en_atencion', 3, 'Vivienda colapsada, se requiere maquinaria y personal'],
  ['materiales_construccion', 'media', '17174', 'verificada', 8, 'Techos dañados, se necesitan tejas y madera'],
  ['salud', 'alta', '66001', 'verificada', 20, 'Puesto de salud saturado, faltan medicamentos básicos'],
  ['albergue', 'alta', '66170', 'sin_verificar', 15, 'Edificio evacuado por daño estructural'],
  ['alimentos', 'media', '63001', 'verificada', 25, 'Comedor comunitario necesita insumos'],
  ['materiales_construccion', 'media', '63130', 'verificada', 6, 'Muros agrietados en varias casas'],
  ['agua', 'alta', '76001', 'verificada', 60, 'Sector sin suministro de agua'],
  ['albergue', 'media', '76364', 'sin_verificar', 10, 'Familias en la calle tras evacuación'],
  ['remocion_escombros', 'alta', '76001', 'resuelta', 4, 'Escombros retirados de vía principal'],
  ['salud', 'media', '27205', 'verificada', 9, 'Brigada de salud requerida en zona rural'],
  ['alimentos', 'alta', '17486', 'verificada', 18, 'Vereda incomunicada necesita alimentos'],
  ['rescate', 'alta', '27075', 'verificada', 2, 'Personas atrapadas reportadas por comunidad'],
  ['materiales_construccion', 'baja', '66682', 'sin_verificar', 5, 'Reparaciones menores en viviendas'],
  ['albergue', 'alta', '63470', 'verificada', 22, 'Colegio habilitado como albergue, faltan colchonetas'],
  ['agua', 'media', '76520', 'resuelta', 14, 'Se restableció el suministro de agua'],
]

// ---- Organizaciones (aprobadas) ----
const ORGS = [
  { nombre: `Cruz Roja Seccional ${M}`, tipo: 'ong', estado: 'aprobada', descripcion: 'Atención humanitaria (demo)' },
  { nombre: `Bomberos Voluntarios ${M}`, tipo: 'bomberos', estado: 'aprobada', descripcion: 'Rescate y remoción (demo)' },
]

// ---- Voluntarios ----
const VOL = [
  { hab: ['medico'], muni: '17001' },
  { hab: ['remocion_escombros', 'construccion'], muni: '27001' },
  { hab: ['psicologo'], muni: '66001' },
  { hab: ['logistica'], muni: '63001' },
  { hab: ['construccion'], muni: '76001' },
  { hab: ['transporte'], muni: '17174' },
]

async function main() {
  // Necesidades
  const filasNec = NEC.map(([categoria, urgencia, municipio_id, estado, personas, desc], i) => ({
    categoria, urgencia, municipio_id, estado,
    personas_afectadas: personas,
    descripcion: `${M} ${desc}`,
    contacto_nombre: `Contacto Demo ${i + 1}`,
    contacto_telefono: tel(i),
    origen: i % 5 === 0 ? 'whatsapp' : 'web',
    verificada_en: estado === 'verificada' || estado === 'en_atencion' || estado === 'resuelta' ? new Date().toISOString() : null,
  }))
  const { error: e1, count: c1 } = await db.from('solicitudes_ayuda').insert(filasNec, { count: 'exact' })
  if (e1) throw new Error('necesidades: ' + e1.message)
  console.log(`✅ ${c1 ?? filasNec.length} necesidades`)

  // Organizaciones (y capturar sus ids para los acopios)
  const { data: orgs, error: e2 } = await db.from('organizaciones').insert(ORGS).select('id')
  if (e2) throw new Error('organizaciones: ' + e2.message)
  console.log(`✅ ${orgs.length} organizaciones`)

  // Acopios (referencian una organización)
  const ACO = [
    { org: orgs[0].id, nombre: `Acopio Central Manizales ${M}`, direccion: 'Cra 23 # 20-10', municipio_id: '17001', horarios: '8am-6pm', recibe: ['agua', 'alimentos', 'cobijas'], no_necesita: ['ropa usada'], estado: 'activo' },
    { org: orgs[0].id, nombre: `Punto Pereira ${M}`, direccion: 'Av 30 de Agosto # 40', municipio_id: '66001', horarios: '9am-5pm', recibe: ['agua', 'kits de aseo'], no_necesita: [], estado: 'activo' },
    { org: orgs[1].id, nombre: `Acopio Armenia ${M}`, direccion: 'Cll 20 # 14', municipio_id: '63001', horarios: '8am-4pm', recibe: ['alimentos no perecederos'], no_necesita: ['ropa'], estado: 'lleno' },
    { org: orgs[1].id, nombre: `Acopio Cali ${M}`, direccion: 'Cra 1 # 5-50', municipio_id: '76001', horarios: '24h', recibe: ['agua', 'medicamentos'], no_necesita: [], estado: 'activo' },
    { org: orgs[0].id, nombre: `Acopio Quibdó ${M}`, direccion: 'Malecón', municipio_id: '27001', horarios: '7am-7pm', recibe: ['agua potable', 'alimentos'], no_necesita: [], estado: 'activo' },
  ].map((a) => ({
    organizacion_id: a.org, nombre: a.nombre, direccion: a.direccion, municipio_id: a.municipio_id,
    horarios: a.horarios, recibe: a.recibe, no_necesita: a.no_necesita, estado: a.estado,
  }))
  const { error: e3 } = await db.from('centros_acopio').insert(ACO)
  if (e3) throw new Error('acopios: ' + e3.message)
  console.log(`✅ ${ACO.length} centros de acopio`)

  // Voluntarios
  const filasVol = VOL.map((v, i) => ({
    nombre: `${M} Voluntario ${i + 1}`,
    habilidades: v.hab,
    disponibilidad: 'Fines de semana',
    municipio_id: v.muni,
    contacto_telefono: tel(100 + i),
    estado: 'disponible',
  }))
  const { error: e4 } = await db.from('voluntarios').insert(filasVol)
  if (e4) throw new Error('voluntarios: ' + e4.message)
  console.log(`✅ ${filasVol.length} voluntarios`)

  console.log('\n🌱 Datos de demo sembrados. Bórralos con: node scripts/limpiar-demo.mjs')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
