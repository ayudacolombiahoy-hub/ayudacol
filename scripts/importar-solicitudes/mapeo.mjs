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
