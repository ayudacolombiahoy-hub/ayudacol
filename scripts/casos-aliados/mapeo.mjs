// Mapeo puro de un caso del API de mimanizales a una fila de casos_aliados.
// Descarta a propósito contacto y datos de pago (breb): no se guardan.

export function primeraImagen(item) {
  for (let i = 1; i <= 10; i++) {
    const u = item['imagen_' + i + '_url']
    if (u && String(u).trim()) return String(u).trim()
  }
  return ''
}

export function mapearCaso(item) {
  const caseId = String(item.case_id ?? '').trim()
  return {
    case_id: caseId,
    titulo: String(item.titulo ?? '').trim(),
    resumen_corto: item.resumen_corto ?? null,
    municipio: item.municipio ?? null,
    sector: item.sector ?? null,
    prioridad: item.prioridad ?? null,
    grupos_objetivo: item.grupos_objetivo ?? null,
    tipos_necesidad: item.tipos_necesidad ?? null,
    necesidades_detalle: item.necesidades_detalle ?? null,
    imagen_url: primeraImagen(item),
    url_origen: 'https://mimanizales.info/caso/?id=' + caseId,
    estado: item.estado ?? 'ACTIVO',
    finalizado: item.finalizado === true,
    fecha_verificacion: item.fecha_verificacion ?? null,
    orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : 100,
  }
}
