const norm = (s: unknown): string =>
  (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function limpiarTelefonos(texto: string): string {
  if (!texto) return ''
  let t = String(texto).replace(/📞/g, ' ')
  const patrones = [
    /(?:\+?57[\s.-]*)?\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g,
    /\b\d{3}[\s.-]\d{2}[\s.-]\d{2}\b/g,
    /\b\d{3}[\s.-]\d{4}\b/g,
    /(?:\+?57[\s.-]*)?\b\d{7,10}\b/g,
  ]
  for (const re of patrones) t = t.replace(re, ' ')
  return t.replace(/\s{2,}/g, ' ').trim()
}

export type Categoria =
  | 'alimentos' | 'agua' | 'albergue' | 'materiales_construccion'
  | 'remocion_escombros' | 'salud' | 'rescate' | 'animales' | 'otro'

const REGLAS_CATEGORIA: [Categoria, RegExp][] = [
  ['agua', /\bagua\b/],
  ['alimentos', /aliment|comida|mercado|desayun|almuerz|viver|hambre|leche|nutric/],
  ['remocion_escombros', /escombro|remoci|lodo|barro|despej/],
  ['materiales_construccion', /techo|cemento|arena|gravilla|ladrill|bloque|varill|reconstru|drywall|mdf|teja/],
  ['albergue', /arriend|vivienda|alojamiento|refugio|dormir|evacu|hosped|alberg|apartament|habitaci/],
  ['salud', /medic|salud|panal|medicament|valoraci|psicolog|enferm|herida|discapac/],
  ['rescate', /rescate|atrapad|desaparecid|sepultad/],
]

export function mapearCategoria(descripcion: string): { categoria: Categoria; confianza: 'alta' | 'baja' } {
  const d = norm(descripcion)
  for (const [cat, re] of REGLAS_CATEGORIA) if (re.test(d)) return { categoria: cat, confianza: 'alta' }
  return { categoria: 'otro', confianza: 'baja' }
}

export function inferirUrgencia(descripcion: string): 'alta' | 'media' {
  const d = norm(descripcion)
  return /urgente|urgencia|peligro|riesgo|rescate|inmediat|grave/.test(d) ? 'alta' : 'media'
}

const MUNICIPIOS_CALDAS: Record<string, string> = {
  manizales: '17001', chinchina: '17174', villamaria: '17873', neira: '17486',
  palestina: '17524', anserma: '17042', aguadas: '17013', aranzazu: '17050',
  'la dorada': '17380', manzanares: '17433', marmato: '17442', marquetalia: '17444',
  pensilvania: '17541', riosucio: '17614', salamina: '17653', samana: '17662',
  'san jose': '17665', supia: '17777', viterbo: '17877',
}

const ALIAS: Record<string, string> = {
  'villa maria': 'villamaria',
  fatima: 'manizales', 'las americas': 'manizales', 'la enea': 'manizales',
  'la sultana': 'manizales', chipre: 'manizales', palogrande: 'manizales',
  milan: 'manizales', morrogacho: 'manizales', 'bellas artes': 'manizales',
  'la palma': 'manizales', arrayanes: 'manizales', nogales: 'manizales',
  arboleda: 'manizales', 'el bosque': 'manizales', 'el caribe': 'manizales',
  saez: 'manizales', uribe: 'manizales', 'la estrella': 'manizales',
  villakempis: 'manizales', 'bosques del norte': 'manizales', 'santa sofia': 'manizales',
  '20 de julio': 'manizales', 'el carmen': 'manizales', 'del carmen': 'manizales',
  tablazo: 'manizales', samaria: 'manizales', 'la carola': 'manizales',
  'bajo andes': 'manizales', 'alta suiza': 'manizales', galan: 'manizales',
  'parque medico': 'manizales', 'avenida centro': 'manizales', cable: 'manizales',
  'av santander': 'manizales', 'avenida santander': 'manizales', 'ondas del otun': 'manizales',
  'pueblo rico': 'neira',
}

const NOMBRE_MUNICIPIO: Record<string, string> = {
  manizales: 'Manizales', chinchina: 'Chinchiná', villamaria: 'Villa María', neira: 'Neira',
  palestina: 'Palestina', anserma: 'Anserma', aguadas: 'Aguadas', aranzazu: 'Aránzazu',
  'la dorada': 'La Dorada', manzanares: 'Manzanares', marmato: 'Marmato', marquetalia: 'Marquetalia',
  pensilvania: 'Pensilvania', riosucio: 'Riosucio', salamina: 'Salamina', samana: 'Samaná',
  'san jose': 'San José', supia: 'Supía', viterbo: 'Viterbo',
}

export function mapearMunicipio(ubicacion: string): { municipio_id: string; nombre: string } | null {
  const u = norm(ubicacion)
  if (!u) return null
  for (const [nombre, codigo] of Object.entries(MUNICIPIOS_CALDAS)) {
    if (new RegExp('\\b' + nombre.replace(/ /g, '\\s+') + '\\b').test(u)) {
      return { municipio_id: codigo, nombre: NOMBRE_MUNICIPIO[nombre] }
    }
  }
  for (const [alias, muni] of Object.entries(ALIAS)) {
    if (new RegExp('\\b' + alias.replace(/ /g, '\\s+') + '\\b').test(u)) {
      return { municipio_id: MUNICIPIOS_CALDAS[muni], nombre: NOMBRE_MUNICIPIO[muni] }
    }
  }
  return null
}

export function sectorDe(ubicacion: string): string {
  if (!ubicacion) return ''
  let s = String(ubicacion)
  const m = s.match(/\b(calle|cll|carrera|cra|kra|kr|avenida|av|diagonal|transversal|manzana|mz|numero|número|no\.)\b|#/i)
  const teniaDireccion = !!m
  if (m) s = s.slice(0, m.index)
  s = s.replace(/\b(apto|apartamento|piso|torre|casa|int|interior)\b.*$/i, '')
  if (teniaDireccion) s = s.replace(/[#°]/g, ' ').replace(/\b\d{1,4}[a-z]?\b/gi, ' ')
  return s.replace(/[-,]/g, ' ').replace(/\s{2,}/g, ' ').trim()
}
