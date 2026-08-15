const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function esNecesidad(item) {
  return item?.tipo === 'necesita'
}

// Quita teléfonos colombianos (celular 3XXXXXXXXX, fijos, con/sin +57 y separadores; y el ícono 📞).
export function limpiarTelefonos(texto) {
  if (!texto) return ''
  let t = String(texto).replace(/📞/g, ' ')
  const patrones = [
    /(?:\+?57[\s.-]*)?\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g, // 3-3-4 (celular/fijo con separadores)
    /\b\d{3}[\s.-]\d{2}[\s.-]\d{2}\b/g,                  // 3-2-2 (fijo)
    /\b\d{3}[\s.-]\d{4}\b/g,                             // 3-4 (fijo local 7 díg con separador)
    /(?:\+?57[\s.-]*)?\b\d{7,10}\b/g,                    // corrida contigua de 7–10 dígitos
  ]
  for (const re of patrones) t = t.replace(re, ' ')
  return t.replace(/\s{2,}/g, ' ').trim()
}

// Orden: específico antes que genérico. Primer match gana.
const REGLAS_CATEGORIA = [
  ['agua', /\bagua\b/],
  ['alimentos', /aliment|comida|mercado|desayun|almuerz|viver|hambre|leche|nutric/],
  ['remocion_escombros', /escombro|remoci|lodo|barro|despej/],
  ['materiales_construccion', /techo|cemento|arena|gravilla|ladrill|bloque|varill|reconstru|drywall|mdf|teja/],
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

// Nombre para mostrar (con tildes/espacios) — separado de la clave de búsqueda normalizada.
const NOMBRE_MUNICIPIO = {
  manizales: 'Manizales', chinchina: 'Chinchiná', villamaria: 'Villa María', neira: 'Neira',
  palestina: 'Palestina', anserma: 'Anserma', aguadas: 'Aguadas', aranzazu: 'Aránzazu',
  'la dorada': 'La Dorada', manzanares: 'Manzanares', marmato: 'Marmato', marquetalia: 'Marquetalia',
  pensilvania: 'Pensilvania', riosucio: 'Riosucio', salamina: 'Salamina', samana: 'Samaná',
  'san jose': 'San José', supia: 'Supía', viterbo: 'Viterbo',
}

// Match de mejor esfuerzo por palabra clave: puede confundir nombres de lugar ambiguos
// (p. ej. un barrio "San José") con el municipio del mismo nombre; se apoya en la revisión humana.
export function mapearMunicipio(ubicacion) {
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

// Sector/barrio sin dirección exacta: corta en el primer token de dirección detallada.
export function sectorDe(ubicacion) {
  if (!ubicacion) return ''
  let s = String(ubicacion)
  const m = s.match(/\b(calle|cll|carrera|cra|kra|kr|avenida|av|diagonal|transversal|manzana|mz|numero|número|no\.)\b|#/i)
  const teniaDireccion = !!m
  if (m) s = s.slice(0, m.index)
  s = s.replace(/\b(apto|apartamento|piso|torre|casa|int|interior)\b.*$/i, '')
  if (teniaDireccion) s = s.replace(/[#°]/g, ' ').replace(/\b\d{1,4}[a-z]?\b/gi, ' ')
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

export const COLUMNAS_CSV = [
  'revisar', 'categoria', 'urgencia', 'municipio_id', 'municipio_nombre',
  'descripcion', 'detalle_ubicacion', 'personas_afectadas',
  'contacto_nombre', 'contacto_telefono', 'direccion_exacta_privada',
  'fecha_fuente', 'descripcion_original',
]

// Columnas que sí se insertan en solicitudes_ayuda.
export const CAMPOS_CARGA = [
  'categoria', 'urgencia', 'municipio_id', 'descripcion', 'detalle_ubicacion',
  'personas_afectadas', 'contacto_nombre', 'contacto_telefono',
]

// Debe coincidir exactamente con CATEGORIAS/URGENCIAS de src/lib/validacion/esquemas.ts.
const CATEGORIAS = ['alimentos', 'agua', 'albergue', 'materiales_construccion', 'remocion_escombros', 'salud', 'rescate', 'animales', 'otro']
const URGENCIAS = ['alta', 'media', 'baja']

export function filaParaRevisar(item, { dias = 14, ahoraISO }) {
  if (!esNecesidad(item)) return { incluir: false, motivo: 'no_es_necesidad' }
  const fechaISO = parsearFechaEs(item.fecha_texto)
  if (!dentroDeVentana(fechaISO, dias, ahoraISO)) return { incluir: false, motivo: 'fuera_de_ventana' }

  const desc = String(item.descripcion ?? '').trim()
  const descLimpia = limpiarTelefonos(desc)
  const { categoria, confianza } = mapearCategoria(desc)
  const muni = mapearMunicipio(item.ubicacion)
  const sector = sectorDe(item.ubicacion) || (muni ? muni.nombre : '')
  const telefono = String(item.telefono ?? '').replace(/\D/g, '')

  const banderas = []
  if (confianza === 'baja') banderas.push('categoria_incierta')
  if (!muni) banderas.push('municipio_sin_mapear')
  if (descLimpia.length < 10) banderas.push('descripcion_corta')
  if (!telefono) banderas.push('sin_telefono')
  if (/\d/.test(sector) || /\b(calle|carrera|cra|apto|piso|barrio)\b/i.test(sector)) banderas.push('posible_direccion')

  return {
    incluir: true,
    fila: {
      revisar: banderas.join(' '),
      categoria,
      urgencia: inferirUrgencia(desc),
      municipio_id: muni ? muni.municipio_id : '',
      municipio_nombre: muni ? muni.nombre : '',
      descripcion: descLimpia,
      detalle_ubicacion: sector,
      personas_afectadas: '',
      contacto_nombre: String(item.nombre ?? '').trim(),
      contacto_telefono: telefono,
      direccion_exacta_privada: String(item.ubicacion ?? '').trim(),
      fecha_fuente: fechaISO,
      descripcion_original: desc,
    },
  }
}

// Réplica de esquemaNecesidad (src/lib/validacion/esquemas.ts) + checks de la tabla, sin importar TS.
export function validarFilaCarga(fila) {
  const e = []
  if (!CATEGORIAS.includes(fila.categoria)) e.push('categoria')
  if (!URGENCIAS.includes(fila.urgencia)) e.push('urgencia')
  const d = String(fila.descripcion ?? '').trim()
  if (d.length < 10 || d.length > 2000) e.push('descripcion')
  if (!String(fila.municipio_id ?? '').trim()) e.push('municipio_id')
  const nom = String(fila.contacto_nombre ?? '').trim()
  if (nom.length < 2 || nom.length > 120) e.push('contacto_nombre')
  const tel = String(fila.contacto_telefono ?? '').trim()
  if (tel.length < 7 || tel.length > 30) e.push('contacto_telefono')
  const det = String(fila.detalle_ubicacion ?? '').trim()
  if (det.length > 500) e.push('detalle_ubicacion')
  const pa = String(fila.personas_afectadas ?? '').trim()
  if (pa && !(Number.isInteger(Number(pa)) && Number(pa) > 0 && Number(pa) <= 100000)) e.push('personas_afectadas')
  return e.length ? { ok: false, errores: e } : { ok: true }
}
