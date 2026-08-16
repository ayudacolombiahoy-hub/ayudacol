import { Link } from '@/i18n/navegacion'
import BotonesMaps from '@/componentes/BotonesMaps'

type Acopio = {
  id: string; nombre: string; municipio_id: string; direccion: string
  horarios: string | null; recibe: string[]; no_necesita: string[]
  lat: number | null; lng: number | null; foto_url?: string | null
}

export default function TarjetaAcopio({
  a, municipioTexto, textoRecibe, textoNoNecesita, textoVerMapa, textoComoLlegar,
}: {
  a: Acopio; municipioTexto?: string
  textoRecibe: string; textoNoNecesita: string; textoVerMapa: string; textoComoLlegar: string
}) {
  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/acopios/${a.id}`} aria-label={a.nombre} className="absolute inset-0 z-[1] rounded-lg" />
      {a.foto_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.foto_url} alt="" className="mb-2 h-32 w-full rounded-lg object-cover" />
      )}
      <h2 className="font-bold">{a.nombre}</h2>
      <p className="text-sm text-gray-600">📍 {municipioTexto ?? a.municipio_id} · {a.direccion}</p>
      {a.horarios && <p className="text-sm text-gray-600">🕓 {a.horarios}</p>}
      {a.recibe?.length > 0 && <p className="mt-2 text-sm"><b>{textoRecibe}:</b> {a.recibe.join(', ')}</p>}
      {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{textoNoNecesita}:</b> {a.no_necesita.join(', ')}</p>}
      <div className="relative z-10">
        <BotonesMaps direccion={a.direccion} municipioTexto={municipioTexto} lat={a.lat} lng={a.lng} textoVer={textoVerMapa} textoComoLlegar={textoComoLlegar} />
      </div>
    </article>
  )
}
