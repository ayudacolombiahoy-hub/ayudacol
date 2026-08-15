import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import { Link } from '@/i18n/navegacion'
import Sello from './Sello'

type Necesidad = {
  id: string; categoria: string; descripcion: string; urgencia: string
  estado: string; municipio_id: string; personas_afectadas: number | null
  creada_en: string; fotos?: string[] | null
}

export default function TarjetaNecesidad({ n, municipio }: { n: Necesidad; municipio?: string }) {
  const t = useTranslations()
  const locale = useLocale() as 'es' | 'en'
  const borde = n.urgencia === 'alta' ? 'border-l-red-500' : n.urgencia === 'media' ? 'border-l-amber-500' : 'border-l-gray-300'
  return (
    <article className={`relative rounded-lg border border-gray-200 border-l-4 ${borde} bg-white p-4 shadow-sm transition hover:shadow-md`}>
      <Link href={`/necesidades/${n.id}`} aria-label={t(`categorias.${n.categoria}`)} className="absolute inset-0 z-[1] rounded-lg" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold">{t(`categorias.${n.categoria}`)}</span>
        <Sello estado={n.estado} />
      </div>
      {n.fotos?.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={n.fotos[0]} alt="" className="mb-2 max-h-40 w-full rounded-lg object-cover" />
      ) : null}
      <p className="text-sm text-gray-700">{n.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>📍 {municipio ?? n.municipio_id}</span>
        {n.personas_afectadas != null && <span>👥 {t('listas.personas', { n: n.personas_afectadas })}</span>}
        <span>🕓 {tiempoRelativo(n.creada_en, locale)}</span>
      </div>
    </article>
  )
}
