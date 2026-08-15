export type EntradaMaps = {
  direccion: string
  municipioTexto?: string
  lat?: number | null
  lng?: number | null
}

export type EnlacesMaps = { ver: string; comoLlegar: string }

function consulta(e: EntradaMaps): string {
  if (
    typeof e.lat === 'number' && Number.isFinite(e.lat) &&
    typeof e.lng === 'number' && Number.isFinite(e.lng)
  ) {
    return `${e.lat},${e.lng}`
  }
  return [e.direccion, e.municipioTexto, 'Colombia']
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

// Construye enlaces de Google Maps (formato documentado ?api=1), sin API key.
// "ver" centra el pin sobre la dirección; "comoLlegar" abre la ruta hacia ella.
export function enlacesMaps(e: EntradaMaps): EnlacesMaps {
  const query = encodeURIComponent(consulta(e))
  return {
    ver: `https://www.google.com/maps/search/?api=1&query=${query}`,
    comoLlegar: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
  }
}
