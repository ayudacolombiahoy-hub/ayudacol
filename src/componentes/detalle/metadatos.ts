import type { Metadata } from 'next'

// Metadatos OpenGraph para compartir una publicación (título + descripción + foto).
// Recibe un item con al menos { descripcion } y opcionalmente { foto_url, nombre }.
export function metadatosDe(item: unknown): Metadata {
  if (!item || typeof item !== 'object') return {}
  const it = item as { descripcion?: string; nombre?: string | null; foto_url?: string | null }
  const desc = (it.descripcion ?? '').slice(0, 160)
  const titulo = it.nombre?.trim() || desc.slice(0, 60) || 'AyudaCol'
  return {
    title: titulo,
    description: desc || undefined,
    openGraph: {
      title: titulo,
      description: desc || undefined,
      images: it.foto_url ? [{ url: it.foto_url }] : undefined,
    },
  }
}
