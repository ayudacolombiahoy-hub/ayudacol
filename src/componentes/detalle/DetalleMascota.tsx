import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import VisorFoto from './VisorFoto'

type Mascota = {
  id: string; tipo_reporte: string; especie: string; nombre: string | null
  descripcion: string; municipio_id: string | null; ultima_ubicacion: string | null
  foto_url: string | null; estado: string
  contacto_nombre: string; contacto_telefono: string; creada_en: string
}

export default function DetalleMascota({ item, municipio }: { item: Mascota; municipio?: string }) {
  const t = useTranslations('mascotas')
  const td = useTranslations('detalle')
  const locale = useLocale() as 'es' | 'en'
  const ubicacion = [municipio, item.ultima_ubicacion].filter(Boolean).join(' · ')
  const soloDigitos = item.contacto_telefono.replace(/\D/g, '')
  const titulo = [t(`especie_${item.especie}`), item.nombre].filter(Boolean).join(' · ')

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
        <span className="text-xl font-bold">🐾 {titulo}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.tipo_reporte === 'perdida' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
          {t(`tipo_${item.tipo_reporte}`)}
        </span>
        {item.estado === 'reunida' && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">{t('estado_reunida')}</span>
        )}
      </div>
      {item.foto_url && (
        <VisorFoto
          fotos={[item.foto_url]}
          alt={titulo}
          etiquetaAnterior={td('fotoAnterior')}
          etiquetaSiguiente={td('fotoSiguiente')}
          etiquetaAmpliar={td('verFoto')}
          etiquetaCerrar={td('cerrar')}
        />
      )}
      <p className="mt-3 whitespace-pre-line text-gray-800">{item.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
        {ubicacion && <span>📍 {ubicacion}</span>}
        <span>🕓 {tiempoRelativo(item.creada_en, locale)}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <span className="text-gray-700">{t('contacto')}: <b>{item.contacto_nombre}</b></span>
        <a href={`https://wa.me/${soloDigitos}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-bold text-white hover:brightness-95">💬 {t('whatsapp')}</a>
        <a href={`tel:${item.contacto_telefono}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">📞 {t('llamar')}</a>
      </div>
    </div>
  )
}
