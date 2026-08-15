const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function esNecesidad(item) {
  return item?.tipo === 'necesita'
}

// Quita teléfonos colombianos (celular 3XXXXXXXXX, con/sin +57 y separadores; y el ícono 📞).
export function limpiarTelefonos(texto) {
  if (!texto) return ''
  let t = String(texto).replace(/📞/g, ' ')
  t = t.replace(/(?:\+?57[\s.-]*)?\b3\d{2}[\s.-]*\d{3}[\s.-]*\d{4}\b/g, ' ')
  t = t.replace(/\b\d{3}[\s.-]\d{2}[\s.-]\d{2}\b/g, ' ')
  return t.replace(/\s{2,}/g, ' ').trim()
}

// Orden: específico antes que genérico. Primer match gana.
const REGLAS_CATEGORIA = [
  ['agua', /\bagua\b/],
  ['alimentos', /aliment|comida|mercado|desayun|almuerz|viver|hambre|leche|nutric/],
  ['remocion_escombros', /escombro|remoci|lodo|barro|despej/],
  ['materiales_construccion', /techo|cemento|arena|gravilla|ladrill|bloque|varill|reconstru|material|drywall|mdf|teja|obra/],
  ['albergue', /arriend|vivienda|alojamiento|refugio|dormir|evacu|hosped|alberg|apartament|habitaci/],
  ['salud', /medic|salud|panal|medicament|valoraci|psicolog|enferm|herida|discapac/],
  ['rescate', /rescate|atrapad|desaparecid|sepultad/],
]

export function mapearCategoria(descripcion) {
  const d = norm(descripcion)
  for (const [cat, re] of REGLAS_CATEGORIA) if (re.test(d)) return { categoria: cat, confianza: 'alta' }
  return { categoria: 'otro', confianza: 'baja' }
}

export function inferirUrgencia(descripcion) {
  const d = norm(descripcion)
  return /urgente|urgencia|peligro|riesgo|rescate|inmediat|grave/.test(d) ? 'alta' : 'media'
}

// Los 19 municipios de Caldas que existen en el catálogo (0003/0005). Clave = nombre normalizado.
export const MUNICIPIOS_CALDAS = {
  manizales: '17001', chinchina: '17174', villamaria: '17873', neira: '17486',
  palestina: '17524', anserma: '17042', aguadas: '17013', aranzazu: '17050',
  'la dorada': '17380', manzanares: '17433', marmato: '17442', marquetalia: '17444',
  pensilvania: '17541', riosucio: '17614', salamina: '17653', samana: '17662',
  'san jose': '17665', supia: '17777', viterbo: '17877',
}

// Barrios/veredas conocidos y variantes de escritura → municipio contenedor.
const ALIAS = {
  'villa maria': 'villamaria',
  fatima: 'manizales', 'las americas': 'manizales', 'la enea': 'manizales',
  'la sultana': 'manizales', chipre: 'manizales', palogrande: 'manizales',
  'pueblo rico': 'neira',
}

const capitalizar = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase())

export function mapearMunicipio(ubicacion) {
  const u = norm(ubicacion)
  if (!u) return null
  for (const [nombre, codigo] of Object.entries(MUNICIPIOS_CALDAS)) {
    if (new RegExp('\\b' + nombre.replace(/ /g, '\\s+') + '\\b').test(u)) {
      return { municipio_id: codigo, nombre: capitalizar(nombre) }
    }
  }
  for (const [alias, muni] of Object.entries(ALIAS)) {
    if (new RegExp('\\b' + alias.replace(/ /g, '\\s+') + '\\b').test(u)) {
      return { municipio_id: MUNICIPIOS_CALDAS[muni], nombre: capitalizar(muni) }
    }
  }
  return null
}

// Sector/barrio sin dirección exacta: corta en el primer token de dirección detallada.
export function sectorDe(ubicacion) {
  if (!ubicacion) return ''
  let s = String(ubicacion)
  const m = s.match(/\b(calle|cll|carrera|cra|kra|kr|avenida|av|diagonal|transversal|manzana|mz|numero|número|no\.)\b|#/i)
  if (m) s = s.slice(0, m.index)
  s = s.replace(/\b(apto|apartamento|piso|torre|casa|int|interior)\b.*$/i, '')
  s = s.replace(/[#°]/g, ' ').replace(/\b\d{1,4}[a-z]?\b/gi, ' ')
  return s.replace(/[-,]/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

const MESES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6,
  agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

// Parsea "15 de agosto de 2026 a las 1:47 p. m." → ISO en UTC (hora de Colombia = UTC-5).
export function parsearFechaEs(texto) {
  if (!texto) return null
  const t = norm(texto)
  const m = t.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})(?:\s+a\s+las\s+(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?))?/)
  if (!m) return null
  const mes = MESES[m[2]]
  if (mes == null) return null
  let hora = m[4] ? +m[4] : 12
  const min = m[5] ? +m[5] : 0
  if (m[6]) { const pm = /p/.test(m[6]); if (pm && hora < 12) hora += 12; if (!pm && hora === 12) hora = 0 }
  return new Date(Date.UTC(+m[3], mes, +m[1], hora + 5, min)).toISOString()
}

export function dentroDeVentana(fechaISO, dias, ahoraISO) {
  if (!fechaISO) return false
  const f = new Date(fechaISO).getTime()
  const ahora = new Date(ahoraISO).getTime()
  if (Number.isNaN(f) || Number.isNaN(ahora)) return false
  return f <= ahora + 60_000 && f >= ahora - dias * 86_400_000
}
