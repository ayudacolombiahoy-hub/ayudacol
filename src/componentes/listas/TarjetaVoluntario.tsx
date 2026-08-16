import { Link } from '@/i18n/navegacion'

type Voluntario = { id: string; habilidades: string[] | null; descripcion?: string | null; disponibilidad: string | null; municipio_id: string; fotos?: string[] | null }

export default function TarjetaVoluntario({ v, habilidadesTexto, municipioTexto }: { v: Voluntario; habilidadesTexto: string; municipioTexto?: string }) {
  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/voluntarios/${v.id}`} aria-label={habilidadesTexto || 'Voluntario'} className="absolute inset-0 z-[1] rounded-lg" />
      {v.fotos?.[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.fotos[0]} alt="" className="mb-2 h-32 w-full rounded-lg object-cover" />
      )}
      <p className="text-sm">🛠️ {habilidadesTexto}</p>
      {v.descripcion && <p className="mt-1 line-clamp-2 text-sm text-gray-700">{v.descripcion}</p>}
      <p className="mt-1 text-xs text-gray-500">📍 {municipioTexto ?? v.municipio_id}{v.disponibilidad ? ` · ${v.disponibilidad}` : ''}</p>
    </article>
  )
}
