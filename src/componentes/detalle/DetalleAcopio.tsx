import { useTranslations } from 'next-intl'
import BotonesMaps from '@/componentes/BotonesMaps'

type Acopio = {
  id: string; nombre: string; municipio_id: string; direccion: string
  horarios: string | null; contacto_publico: string | null
  recibe: string[]; no_necesita: string[]; lat: number | null; lng: number | null
}

export default function DetalleAcopio({ item, municipio }: { item: Acopio; municipio?: string }) {
  const t = useTranslations('listas')
  const tMaps = useTranslations('maps')
  return (
    <div className="p-5 sm:p-6">
      <h1 className="mb-2 pr-8 text-xl font-bold">{item.nombre}</h1>
      <p className="text-sm text-gray-600">📍 {[municipio, item.direccion].filter(Boolean).join(' · ')}</p>
      {item.horarios && <p className="mt-1 text-sm text-gray-600">🕓 {item.horarios}</p>}
      {item.contacto_publico && <p className="mt-1 text-sm text-gray-600">☎️ {item.contacto_publico}</p>}
      {item.recibe?.length > 0 && <p className="mt-3 text-sm"><b>{t('recibe')}:</b> {item.recibe.join(', ')}</p>}
      {item.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('noNecesita')}:</b> {item.no_necesita.join(', ')}</p>}
      <BotonesMaps direccion={item.direccion} municipioTexto={municipio} lat={item.lat} lng={item.lng} textoVer={tMaps('verUbicacion')} textoComoLlegar={tMaps('comoLlegar')} />
    </div>
  )
}
