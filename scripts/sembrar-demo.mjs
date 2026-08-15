// Siembra un demo GRANDE y realista: >=50 necesidades ACTIVAS por municipio.
// La marca de demo va en campos PRIVADOS (contacto_nombre / voluntario.nombre /
// organizacion.descripcion), nunca en la descripción pública. Re-ejecutable.
// Uso: node scripts/sembrar-demo.mjs            (52 activas + 3 resueltas por municipio)
//      node scripts/sembrar-demo.mjs 30         (30 activas + 3 resueltas por municipio)
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const ACTIVAS_POR_MUNI = Number(process.argv[2]) || 52
const RESUELTAS_POR_MUNI = 3
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const nOf = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n)
const tel = () => `+57 3${Math.floor(10 + Math.random() * 89)} ${Math.floor(1000000 + Math.random() * 8999999)}`

const CATS = ['alimentos', 'agua', 'albergue', 'materiales_construccion', 'remocion_escombros', 'salud', 'rescate', 'otro']
const URG = ['alta', 'alta', 'media', 'media', 'media', 'baja']
const ACTIVOS = ['sin_verificar', 'verificada', 'verificada', 'verificada', 'en_atencion', 'por_reconfirmar']
const HAB = ['medico', 'psicologo', 'remocion_escombros', 'logistica', 'transporte', 'construccion', 'otro']
const DESC = {
  alimentos: ['Familias sin alimentos, se necesitan mercados y agua', 'Comedor comunitario requiere insumos', 'Vereda incomunicada necesita alimentos no perecederos'],
  agua: ['Falta agua potable en el sector tras el sismo', 'Tanques dañados, comunidad sin suministro', 'Se requiere agua embotellada con urgencia'],
  albergue: ['Familias evacuadas necesitan alojamiento temporal', 'Colegio habilitado como albergue, faltan colchonetas', 'Damnificados a la intemperie requieren carpas'],
  materiales_construccion: ['Techos dañados, se necesitan tejas y madera', 'Muros agrietados, se requieren materiales', 'Viviendas afectadas necesitan cemento y varilla'],
  remocion_escombros: ['Vivienda colapsada, se requiere maquinaria y personal', 'Escombros bloquean la vía, se necesita remoción', 'Deslizamiento cubrió casas, apoyo urgente'],
  salud: ['Puesto de salud saturado, faltan medicamentos', 'Se requiere brigada médica en zona rural', 'Personas heridas necesitan atención'],
  rescate: ['Reporte de personas atrapadas, se solicita rescate', 'Familia incomunicada por derrumbe', 'Búsqueda de personas desaparecidas'],
  otro: ['Necesidad reportada por la comunidad afectada', 'Requerimiento general de apoyo humanitario', 'Situación de emergencia en el sector'],
}

async function limpiar() {
  const { data: orgsDemo } = await db.from('organizaciones').select('id').or('descripcion.like.DEMO%,nombre.like.%[DEMO]%')
  if (orgsDemo?.length) await db.from('centros_acopio').delete().in('organizacion_id', orgsDemo.map((o) => o.id))
  await db.from('centros_acopio').delete().like('nombre', '%[DEMO]%')
  await db.from('organizaciones').delete().like('descripcion', 'DEMO%')
  await db.from('organizaciones').delete().like('nombre', '%[DEMO]%')
  await db.from('solicitudes_ayuda').delete().like('contacto_nombre', 'Demo %')
  await db.from('solicitudes_ayuda').delete().like('descripcion', '[DEMO]%')
  await db.from('voluntarios').delete().like('nombre', 'Demo %')
  await db.from('voluntarios').delete().like('nombre', '[DEMO]%')
}

async function insertarPorLotes(tabla, filas, lote = 500) {
  for (let i = 0; i < filas.length; i += lote) {
    const { error } = await db.from(tabla).insert(filas.slice(i, i + lote))
    if (error) throw new Error(`${tabla}: ${error.message}`)
    process.stdout.write(`\r  ${tabla}: ${Math.min(i + lote, filas.length)}/${filas.length}   `)
  }
  process.stdout.write('\n')
}

let cont = 0
function mkNec(muni, estado) {
  cont++
  const categoria = pick(CATS)
  return {
    categoria,
    urgencia: pick(URG),
    municipio_id: muni,
    estado,
    personas_afectadas: Math.floor(1 + Math.random() * 90),
    descripcion: pick(DESC[categoria]),
    contacto_nombre: `Demo ${cont}`, // marca PRIVADA (no aparece en vistas públicas)
    contacto_telefono: tel(),
    origen: Math.random() < 0.15 ? 'whatsapp' : 'web',
    verificada_en: ['verificada', 'en_atencion', 'resuelta'].includes(estado) ? new Date().toISOString() : null,
  }
}

async function main() {
  console.log('Limpiando demo anterior…')
  await limpiar()

  const { data: munis, error: em } = await db.from('municipios').select('codigo_dane')
  if (em) throw new Error('municipios: ' + em.message)
  console.log(`Municipios en catálogo: ${munis.length}. Generando ${ACTIVAS_POR_MUNI} activas + ${RESUELTAS_POR_MUNI} resueltas c/u…`)

  // Necesidades
  const nec = []
  for (const m of munis) {
    for (let k = 0; k < ACTIVAS_POR_MUNI; k++) nec.push(mkNec(m.codigo_dane, pick(ACTIVOS)))
    for (let k = 0; k < RESUELTAS_POR_MUNI; k++) nec.push(mkNec(m.codigo_dane, 'resuelta'))
  }
  await insertarPorLotes('solicitudes_ayuda', nec)
  console.log(`✅ ${nec.length} necesidades`)

  // Organizaciones (marca en descripción, privada)
  const orgsData = [
    { nombre: 'Cruz Roja Seccional', tipo: 'ong' },
    { nombre: 'Bomberos Voluntarios', tipo: 'bomberos' },
    { nombre: 'Fundación Café y Vida', tipo: 'ong' },
    { nombre: 'Defensa Civil', tipo: 'comunitaria' },
  ].map((o) => ({ ...o, estado: 'aprobada', descripcion: 'DEMO — organización de ejemplo' }))
  const { data: orgs, error: eo } = await db.from('organizaciones').insert(orgsData).select('id')
  if (eo) throw new Error('orgs: ' + eo.message)
  console.log(`✅ ${orgs.length} organizaciones`)

  // Acopios (nombre público realista; se limpian por su organización demo)
  const RECIBE = ['agua', 'alimentos', 'cobijas', 'kits de aseo', 'medicamentos', 'pañales', 'agua potable']
  const NONEC = ['ropa usada', 'juguetes', 'muebles']
  const poolMuni = munis.map((m) => m.codigo_dane)
  const aco = Array.from({ length: 40 }, (_, i) => ({
    organizacion_id: pick(orgs).id,
    nombre: `Centro de Acopio ${pick(['Norte', 'Sur', 'Centro', 'Oriente', 'Occidente'])} ${i + 1}`,
    direccion: `Cra ${1 + (i % 40)} # ${10 + i}-${20 + (i % 30)}`,
    municipio_id: pick(poolMuni),
    horarios: pick(['8am-6pm', '9am-5pm', '24h', '7am-7pm']),
    recibe: nOf(RECIBE, 2 + Math.floor(Math.random() * 3)),
    no_necesita: Math.random() < 0.5 ? [pick(NONEC)] : [],
    estado: pick(['activo', 'activo', 'activo', 'lleno', 'cerrado']),
  }))
  await insertarPorLotes('centros_acopio', aco)
  console.log(`✅ ${aco.length} centros de acopio`)

  // Voluntarios (nombre "Demo N" es privado, no aparece en la vista pública)
  const vol = Array.from({ length: 60 }, (_, i) => ({
    nombre: `Demo ${i + 1}`,
    habilidades: nOf(HAB, 1 + Math.floor(Math.random() * 2)),
    disponibilidad: pick(['Fines de semana', 'Tiempo completo', 'Tardes', 'Por turnos']),
    municipio_id: pick(poolMuni),
    contacto_telefono: tel(),
    estado: 'disponible',
  }))
  await insertarPorLotes('voluntarios', vol)
  console.log(`✅ ${vol.length} voluntarios`)

  console.log('\n🌱 Demo sembrada (marca solo en campos privados). Bórrala con: node scripts/limpiar-demo.mjs')
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1) })
