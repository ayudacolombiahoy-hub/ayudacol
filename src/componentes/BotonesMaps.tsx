import { enlacesMaps } from '@/lib/geo/maps'

// Dos enlaces a Google Maps para una dirección. Es un server component
// (solo anclas), por eso recibe los textos ya traducidos por props.
export default function BotonesMaps({
  direccion,
  municipioTexto,
  lat,
  lng,
  textoVer,
  textoComoLlegar,
}: {
  direccion: string
  municipioTexto?: string
  lat?: number | null
  lng?: number | null
  textoVer: string
  textoComoLlegar: string
}) {
  if (!direccion?.trim()) return null
  const { ver, comoLlegar } = enlacesMaps({ direccion, municipioTexto, lat, lng })
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        href={ver}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        📍 {textoVer}
      </a>
      <a
        href={comoLlegar}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
      >
        🧭 {textoComoLlegar}
      </a>
    </div>
  )
}
