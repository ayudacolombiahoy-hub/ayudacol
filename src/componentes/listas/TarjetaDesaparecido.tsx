import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import { Link } from '@/i18n/navegacion'

type Desaparecido = {
  id: string; nombre: string; edad: number | null; descripcion: string
  municipio_id: string | null; ultima_ubicacion: string | null
  fotos: string[] | null; estado: string; creada_en: string
}

const COLOR_ESTADO: Record<string, string> = {
  buscando: 'bg-amber-100 text-amber-800',
  encontrada: 'bg-green-100 text-green-800',
}

export default function TarjetaDesaparecido({ d, municipio }: { d: Desaparecido; municipio?: string }) {
  const t = useTranslations()
  const locale = useLocale() as 'es' | 'en'
  const ubicacion = [municipio, d.ultima_ubicacion].filter(Boolean).join(' · ')

  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/desaparecidos/${d.id}`} aria-label={d.nombre} className="absolute inset-0 z-[1] rounded-lg" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold">
          {d.nombre}
          {d.edad != null && <span className="font-normal text-gray-500"> · {t('desaparecidos.aniosAbrev', { n: d.edad })}</span>}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[d.estado] ?? 'bg-gray-100 text-gray-600'}`}>
          {t(`desaparecidos.${d.estado}`)}
        </span>
      </div>
      {d.fotos?.[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.fotos[0]} alt={d.nombre} className="mb-2 h-40 w-full rounded-lg object-cover" />
      )}
      <p className="text-sm text-gray-700">{d.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {ubicacion && <span>📍 {ubicacion}</span>}
        <span>🕓 {tiempoRelativo(d.creada_en, locale)}</span>
      </div>
    </article>
  )
}
