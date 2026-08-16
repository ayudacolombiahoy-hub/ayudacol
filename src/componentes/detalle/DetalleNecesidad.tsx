import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import VisorFoto from './VisorFoto'
import BotonesMaps from '@/componentes/BotonesMaps'
import { clasificarContacto, hrefContacto } from '@/lib/contacto'

type Necesidad = {
  id: string; categoria: string; descripcion: string; urgencia: string
  estado: string; municipio_id: string; personas_afectadas: number | null
  detalle_ubicacion: string | null; lat: number | null; lng: number | null
  creada_en: string; fotos?: string[] | null
  contacto_nombre?: string | null; contacto_telefono?: string | null
}

const BORDE: Record<string, string> = {
  alta: 'border-l-red-500', media: 'border-l-amber-500', baja: 'border-l-gray-300',
}

export default function DetalleNecesidad({ item, municipio }: { item: Necesidad; municipio?: string }) {
  const t = useTranslations()
  const td = useTranslations('detalle')
  const tMaps = useTranslations('maps')
  const locale = useLocale() as 'es' | 'en'
  const fotos = item.fotos ?? []
  const direccion = [item.detalle_ubicacion, municipio].filter(Boolean).join(', ')

  return (
    <div className={`border-l-4 ${BORDE[item.urgencia] ?? 'border-l-gray-300'} p-5 sm:p-6`}>
      <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
        <span className="text-xl font-bold">{t(`categorias.${item.categoria}`)}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{t(`urgencias.${item.urgencia}`)}</span>
      </div>
      {fotos.length > 0 && (
        <VisorFoto fotos={fotos} alt={t(`categorias.${item.categoria}`)} etiquetaAnterior={td('fotoAnterior')} etiquetaSiguiente={td('fotoSiguiente')} etiquetaAmpliar={td('verFoto')} etiquetaCerrar={td('cerrar')} />
      )}
      <p className="mt-3 whitespace-pre-line text-gray-800">{item.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
        <span>📍 {[municipio, item.detalle_ubicacion].filter(Boolean).join(' · ')}</span>
        {item.personas_afectadas != null && <span>👥 {td('personasAfectadas', { n: item.personas_afectadas })}</span>}
        <span>🕓 {tiempoRelativo(item.creada_en, locale)}</span>
      </div>
      {direccion && (
        <BotonesMaps direccion={direccion} municipioTexto={municipio} lat={item.lat} lng={item.lng} textoVer={tMaps('verUbicacion')} textoComoLlegar={tMaps('comoLlegar')} />
      )}
      {item.contacto_telefono && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          {item.contacto_nombre && <span className="text-gray-700">{td('contacto')}: <b>{item.contacto_nombre}</b></span>}
          {(() => {
            const v = item.contacto_telefono!
            const tipo = clasificarContacto(v)
            if (tipo === 'telefono') return (
              <>
                <a href={`https://wa.me/${v.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-bold text-white hover:brightness-95">💬 {td('whatsapp')}</a>
                <a href={`tel:${v}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">📞 {td('llamar')}</a>
              </>
            )
            const etiqueta = tipo === 'instagram' ? 'Instagram' : tipo === 'facebook' ? 'Facebook' : td('verContacto')
            const icono = tipo === 'instagram' ? '📷' : tipo === 'facebook' ? '📘' : '🔗'
            return <a href={hrefContacto(v)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">{icono} {etiqueta}</a>
          })()}
        </div>
      )}
    </div>
  )
}
