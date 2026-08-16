import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import VisorFoto from './VisorFoto'

type Desaparecido = {
  id: string; nombre: string; edad: number | null; descripcion: string
  municipio_id: string | null; ultima_ubicacion: string | null
  fotos: string[] | null; estado: string; creada_en: string
}

const COLOR_ESTADO: Record<string, string> = {
  buscando: 'bg-amber-100 text-amber-800',
  encontrada: 'bg-green-100 text-green-800',
}

export default function DetalleDesaparecido({ item, municipio }: { item: Desaparecido; municipio?: string }) {
  const t = useTranslations()
  const td = useTranslations('detalle')
  const locale = useLocale() as 'es' | 'en'
  const ubicacion = [municipio, item.ultima_ubicacion].filter(Boolean).join(' · ')

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
        <span className="text-xl font-bold">{item.nombre}</span>
        {item.edad != null && <span className="text-gray-500">{t('desaparecidos.aniosAbrev', { n: item.edad })}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[item.estado] ?? 'bg-gray-100 text-gray-600'}`}>
          {t(`desaparecidos.${item.estado}`)}
        </span>
      </div>
      {item.fotos?.length ? (
        <VisorFoto fotos={item.fotos} alt={item.nombre} etiquetaAnterior={td('fotoAnterior')} etiquetaSiguiente={td('fotoSiguiente')} etiquetaAmpliar={td('verFoto')} etiquetaCerrar={td('cerrar')} />
      ) : null}
      <p className="mt-3 whitespace-pre-line text-gray-800">{item.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
        {ubicacion && <span>📍 {ubicacion}</span>}
        <span>🕓 {tiempoRelativo(item.creada_en, locale)}</span>
      </div>
    </div>
  )
}
