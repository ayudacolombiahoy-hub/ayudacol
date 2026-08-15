// Siembra demo ADITIVA para las secciones nuevas (no toca las necesidades existentes):
// albergues, refugios animales, personas desaparecidas, mascotas, novedades y
// necesidades de categoría 'animales'.
//
// Convención de marca (para poder limpiar):
//   - albergues/refugios: se atan a una organización demo (descripcion 'DEMO —'); invisible al público.
//   - personas desaparecidas / mascotas / novedades: marca VISIBLE "[EJEMPLO]" (casos sensibles en sitio en vivo).
//   - necesidades 'animales': contacto_nombre 'Demo N' (privado), igual que el resto del demo.
// Re-ejecutable (limpia SU propio demo antes de sembrar). Borra todo con: node scripts/limpiar-demo.mjs
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const EJ = '[EJEMPLO]'
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const nInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1))
const tel = () => `+57 3${nInt(10, 29)} ${nInt(1000000, 9999999)}`

const ALBERGUES = 50
const REFUGIOS = 24
const DESAPARECIDOS = 30
const MASCOTAS = 40
const ANIM_POR_MUNI = 2

async function insertar(tabla, filas) {
  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await db.from(tabla).insert(filas.slice(i, i + 500))
    if (error) throw new Error(`${tabla}: ${error.message}`)
  }
  console.log(`✅ ${filas.length} → ${tabla}`)
}

async function main() {
  const { data: munis, error: em } = await db.from('municipios').select('codigo_dane')
  if (em) throw new Error('municipios: ' + em.message)
  const poolMuni = munis.map((m) => m.codigo_dane)

  // Organización demo (reusar o crear) para atar albergues/refugios.
  let { data: orgs } = await db.from('organizaciones').select('id').or('descripcion.like.DEMO%,nombre.like.%[DEMO]%')
  if (!orgs || !orgs.length) {
    const { data: creada, error } = await db.from('organizaciones')
      .insert({ nombre: 'Coordinación (demo)', tipo: 'comunitaria', estado: 'aprobada', descripcion: 'DEMO — organización de ejemplo' })
      .select('id')
    if (error) throw new Error('org demo: ' + error.message)
    orgs = creada
  }
  const orgIds = orgs.map((o) => o.id)
  const orgId = () => pick(orgs).id

  // Limpieza previa del demo de este script (idempotente).
  console.log('Limpiando demo-extra anterior…')
  await db.from('albergues').delete().in('organizacion_id', orgIds)
  await db.from('refugios_animales').delete().in('organizacion_id', orgIds)
  await db.from('personas_desaparecidas').delete().like('nombre', `${EJ}%`)
  await db.from('mascotas').delete().like('descripcion', `${EJ}%`)
  await db.from('novedades').delete().like('titulo_es', `${EJ}%`)
  await db.from('solicitudes_ayuda').delete().eq('categoria', 'animales').like('contacto_nombre', 'Demo %')

  // ===== ALBERGUES =====
  const NOMB_ALB = ['Coliseo Municipal', 'Colegio San José', 'Polideportivo Central', 'Casa de la Cultura',
    'Coliseo Los Fundadores', 'Salón Comunal La Esperanza', 'I.E. Ciudadela del Norte', 'Coliseo Cubierto',
    'Parroquia San Antonio', 'Escuela El Progreso']
  const albergues = Array.from({ length: ALBERGUES }, (_, i) => {
    const capacidad = nInt(40, 400)
    const estado = pick(['abierto', 'abierto', 'abierto', 'lleno', 'cerrado'])
    return {
      organizacion_id: orgId(),
      nombre: `${pick(NOMB_ALB)} ${i + 1}`,
      municipio_id: pick(poolMuni),
      direccion: `Cra ${nInt(1, 40)} # ${nInt(10, 60)}-${nInt(10, 90)}`,
      capacidad,
      ocupacion: estado === 'lleno' ? capacidad : nInt(0, capacidad),
      contacto_publico: tel(),
      estado,
    }
  })
  await insertar('albergues', albergues)

  // ===== REFUGIOS ANIMALES =====
  const NOMB_REF = ['Refugio Patitas', 'Fundación Huellas', 'Albergue Animal San Roque',
    'Refugio Amigos Peludos', 'Centro de Rescate Animal', 'Refugio Esperanza Animal']
  const ESPECIES = ['Perros y gatos', 'Todo tipo de animales', 'Perros, gatos y aves',
    'Animales de granja', 'Mascotas pequeñas', 'Perros de gran tamaño']
  const refugios = Array.from({ length: REFUGIOS }, (_, i) => {
    const capacidad = nInt(15, 120)
    const estado = pick(['abierto', 'abierto', 'abierto', 'lleno', 'cerrado'])
    return {
      organizacion_id: orgId(),
      nombre: `${pick(NOMB_REF)} ${i + 1}`,
      municipio_id: pick(poolMuni),
      direccion: `Vía ${pick(['Norte', 'Sur', 'Rural'])} km ${nInt(1, 12)}`,
      capacidad,
      ocupacion: estado === 'lleno' ? capacidad : nInt(0, capacidad),
      especies: pick(ESPECIES),
      contacto_publico: tel(),
      estado,
    }
  })
  await insertar('refugios_animales', refugios)

  // ===== PERSONAS DESAPARECIDAS (marca VISIBLE [EJEMPLO]) =====
  const NOMBRES = ['Juan Ramírez', 'María Gómez', 'Carlos Herrera', 'Ana Torres', 'Luis Cardona',
    'Sofía Vargas', 'Pedro Ospina', 'Laura Restrepo', 'Andrés Muñoz', 'Diana Ríos', 'Jorge Salazar', 'Camila Ruiz']
  const RASGOS = ['camiseta azul y jean', 'chaqueta roja', 'contextura delgada, 1.70 m', 'cabello corto, gafas',
    'sudadera gris', 'estatura media, tez trigueña']
  const desaparecidos = Array.from({ length: DESAPARECIDOS }, () => ({
    nombre: `${EJ} ${pick(NOMBRES)}`,
    edad: nInt(6, 82),
    descripcion: `${EJ} Caso de demostración. Visto por última vez con ${pick(RASGOS)}, cerca del ${pick(['parque principal', 'río', 'barrio afectado', 'coliseo', 'centro de salud'])}.`,
    municipio_id: pick(poolMuni),
    ultima_ubicacion: `${pick(['Barrio', 'Vereda', 'Sector'])} ${pick(['El Carmen', 'La Esperanza', 'San José', 'Centro', 'Las Palmas'])}`,
    estado: 'buscando',
    contacto_nombre: 'Reportante (demo)',
    contacto_telefono: tel(),
  }))
  await insertar('personas_desaparecidas', desaparecidos)

  // ===== MASCOTAS (marca VISIBLE [EJEMPLO]) =====
  const PET = ['Toby', 'Luna', 'Max', 'Nina', 'Rocky', 'Kira', 'Simón', 'Canela', 'Pelusa', 'Coco']
  const RASGO_PET = ['tamaño mediano, collar rojo', 'pelaje café', 'blanco con manchas negras', 'orejas caídas',
    'pequeño y peludo', 'atigrado']
  const mascotas = Array.from({ length: MASCOTAS }, () => {
    const especie = pick(['perro', 'gato', 'ave', 'otro'])
    const tipo = pick(['perdida', 'encontrada'])
    return {
      tipo_reporte: tipo,
      especie,
      nombre: tipo === 'perdida' && Math.random() < 0.7 ? pick(PET) : null,
      descripcion: `${EJ} Caso de demostración. ${especie === 'perro' ? 'Perro' : especie === 'gato' ? 'Gato' : 'Animal'} ${pick(RASGO_PET)}. ${tipo === 'perdida' ? 'Se perdió' : 'Se encontró'} cerca del ${pick(['río', 'parque', 'barrio afectado', 'colegio'])}.`,
      municipio_id: pick(poolMuni),
      ultima_ubicacion: `${pick(['Barrio', 'Sector'])} ${pick(['El Carmen', 'Centro', 'La Esperanza', 'Las Palmas'])}`,
      estado: 'activo',
      contacto_nombre: 'Reportante (demo)',
      contacto_telefono: tel(),
    }
  })
  await insertar('mascotas', mascotas)

  // ===== NOVEDADES (marca VISIBLE [EJEMPLO]) =====
  const novedades = [
    { es: 'Nuevo albergue habilitado en Manizales', en: 'New shelter opened in Manizales', ces: 'Se habilitó un albergue temporal con capacidad para 200 personas en el coliseo municipal. Se reciben donaciones de colchonetas y kits de aseo.', cen: 'A temporary shelter for 200 people opened at the municipal coliseum. Donations of mats and hygiene kits are welcome.' },
    { es: 'Brigadas médicas en zonas rurales', en: 'Medical brigades in rural areas', ces: 'Equipos de salud recorren las veredas más afectadas. Reporta necesidades de medicamentos desde la plataforma.', cen: 'Health teams are visiting the most affected rural areas. Report medication needs through the platform.' },
    { es: 'Cómo verificamos la información', en: 'How we verify information', ces: 'Cada reporte es revisado por voluntarios antes de publicarse como verificado. Así evitamos información falsa.', cen: 'Every report is reviewed by volunteers before being published as verified, to prevent misinformation.' },
    { es: 'Puntos de acopio con mayor necesidad', en: 'Donation centers most in need', ces: 'Revisa el mapa para ver qué centros de acopio necesitan agua, alimentos y pañales hoy.', cen: 'Check the map to see which donation centers need water, food and diapers today.' },
    { es: 'Ayuda desde el exterior', en: 'Help from abroad', ces: 'Si estás fuera de Colombia, puedes apoyar campañas verificadas desde la sección Donar.', cen: 'If you are outside Colombia, you can support verified campaigns from the Donate section.' },
    { es: 'Reporta personas y mascotas', en: 'Report people and pets', ces: 'Habilitamos secciones para reportar personas desaparecidas y mascotas perdidas durante la emergencia.', cen: 'We enabled sections to report missing persons and lost pets during the emergency.' },
  ].map((n) => ({
    titulo_es: `${EJ} ${n.es}`, titulo_en: `${EJ} ${n.en}`,
    contenido_es: n.ces, contenido_en: n.cen, publicada: true,
  }))
  await insertar('novedades', novedades)

  // ===== NECESIDADES categoría 'animales' (marca privada Demo) =====
  const URG = ['alta', 'alta', 'media', 'media', 'baja']
  const ACTIVOS = ['sin_verificar', 'verificada', 'verificada', 'verificada', 'en_atencion', 'por_reconfirmar']
  const DESC_ANIM = [
    'Mascotas sin comida tras la evacuación, se necesita alimento para perros y gatos',
    'Animales heridos requieren atención veterinaria urgente',
    'Semovientes en zona rural sin agua ni forraje',
    'Se necesita transporte para reubicar animales de un refugio lleno',
    'Falta medicamento y suero para animales rescatados',
  ]
  let cont = 0
  const anim = []
  for (const m of poolMuni) {
    for (let k = 0; k < ANIM_POR_MUNI; k++) {
      cont++
      const estado = pick(ACTIVOS)
      anim.push({
        categoria: 'animales',
        urgencia: pick(URG),
        municipio_id: m,
        estado,
        personas_afectadas: nInt(1, 40),
        descripcion: pick(DESC_ANIM),
        contacto_nombre: `Demo A${cont}`,
        contacto_telefono: tel(),
        origen: Math.random() < 0.15 ? 'whatsapp' : 'web',
        verificada_en: ['verificada', 'en_atencion'].includes(estado) ? new Date().toISOString() : null,
      })
    }
  }
  await insertar('solicitudes_ayuda', anim)

  console.log('\n🌱 Demo-extra sembrada. Casos sensibles marcados "[EJEMPLO]". Borra todo con: node scripts/limpiar-demo.mjs')
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1) })
