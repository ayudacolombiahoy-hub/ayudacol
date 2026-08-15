import { Link } from '@/i18n/navegacion'
import BotonesMaps from '@/componentes/BotonesMaps'

type Albergue = {
  id: string; nombre: string; municipio_id: string; direccion: string
  capacidad: number | null; ocupacion: number; contacto_publico: string | null
  estado: string; lat?: number | null; lng?: number | null
}

const COLOR_ESTADO: Record<string, string> = {
  abierto: 'bg-green-100 text-green-800',
  lleno: 'bg-amber-100 text-amber-800',
  cerrado: 'bg-gray-200 text-gray-700',
}

export default function TarjetaAlbergue({
  a, municipioTexto, textoEstado, textoCupos, textoVerMapa, textoComoLlegar,
}: {
  a: Albergue; municipioTexto?: string
  textoEstado: string; textoCupos: string | null; textoVerMapa: string; textoComoLlegar: string
}) {
  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/albergues/${a.id}`} aria-label={a.nombre} className="absolute inset-0 z-[1] rounded-lg" />
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-bold">{a.nombre}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[a.estado] ?? 'bg-gray-100 text-gray-600'}`}>{textoEstado}</span>
      </div>
      <p className="text-sm text-gray-600">📍 {municipioTexto ?? a.municipio_id} · {a.direccion}</p>
      {textoCupos && <p className="mt-1 text-sm font-semibold text-gray-700">{textoCupos}</p>}
      {a.contacto_publico && <p className="mt-1 text-sm text-gray-600">☎️ {a.contacto_publico}</p>}
      <div className="relative z-10">
        <BotonesMaps direccion={a.direccion} municipioTexto={municipioTexto} lat={a.lat} lng={a.lng} textoVer={textoVerMapa} textoComoLlegar={textoComoLlegar} />
      </div>
    </article>
  )
}
