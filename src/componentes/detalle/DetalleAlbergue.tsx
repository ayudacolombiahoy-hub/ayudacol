import { useTranslations } from 'next-intl'
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

export default function DetalleAlbergue({ item, municipio }: { item: Albergue; municipio?: string }) {
  const t = useTranslations('albergues')
  const td = useTranslations('detalle')
  const tMaps = useTranslations('maps')
  const libres = item.capacidad != null ? Math.max(0, item.capacidad - item.ocupacion) : null
  return (
    <div className="p-5 sm:p-6">
      <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
        <h1 className="text-xl font-bold">{item.nombre}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[item.estado] ?? 'bg-gray-100 text-gray-600'}`}>{t(item.estado)}</span>
      </div>
      <p className="text-sm text-gray-600">📍 {[municipio, item.direccion].filter(Boolean).join(' · ')}</p>
      {item.capacidad != null && libres !== null && (
        <p className="mt-2 text-sm font-semibold text-gray-700">{td('cupos', { libres, total: item.capacidad })}</p>
      )}
      {item.contacto_publico && <p className="mt-1 text-sm text-gray-600">☎️ {item.contacto_publico}</p>}
      <BotonesMaps direccion={item.direccion} municipioTexto={municipio} lat={item.lat} lng={item.lng} textoVer={tMaps('verUbicacion')} textoComoLlegar={tMaps('comoLlegar')} />
    </div>
  )
}
