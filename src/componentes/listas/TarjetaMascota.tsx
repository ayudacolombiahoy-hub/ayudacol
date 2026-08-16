import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import { Link } from '@/i18n/navegacion'

type Mascota = {
  id: string; tipo_reporte: string; especie: string; nombre: string | null
  descripcion: string; municipio_id: string | null; ultima_ubicacion: string | null
  fotos: string[] | null; estado: string
  contacto_nombre: string; contacto_telefono: string; creada_en: string
}

const COLOR_TIPO: Record<string, string> = {
  perdida: 'bg-amber-100 text-amber-800',
  encontrada: 'bg-green-100 text-green-800',
}

export default function TarjetaMascota({ m, municipio }: { m: Mascota; municipio?: string }) {
  const t = useTranslations('mascotas')
  const locale = useLocale() as 'es' | 'en'
  const ubicacion = [municipio, m.ultima_ubicacion].filter(Boolean).join(' · ')
  const soloDigitos = m.contacto_telefono.replace(/\D/g, '')
  const titulo = [t(`especie_${m.especie}`), m.nombre].filter(Boolean).join(' · ')

  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/mascotas/${m.id}`} aria-label={titulo} className="absolute inset-0 z-[1] rounded-lg" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold">🐾 {titulo}</span>
        <div className="flex flex-shrink-0 gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_TIPO[m.tipo_reporte] ?? 'bg-gray-100 text-gray-600'}`}>
            {t(`tipo_${m.tipo_reporte}`)}
          </span>
          {m.estado === 'reunida' && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
              {t('estado_reunida')}
            </span>
          )}
        </div>
      </div>
      {m.fotos?.[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.fotos[0]} alt={titulo} className="mb-2 h-40 w-full rounded-lg object-cover" />
      )}
      <p className="text-sm text-gray-700">{m.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {ubicacion && <span>📍 {ubicacion}</span>}
        <span>🕓 {tiempoRelativo(m.creada_en, locale)}</span>
      </div>
      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm">
        <span className="text-gray-700">{t('contacto')}: <b>{m.contacto_nombre}</b></span>
        <a
          href={`https://wa.me/${soloDigitos}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:brightness-95"
        >
          💬 {t('whatsapp')}
        </a>
        <a
          href={`tel:${m.contacto_telefono}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          📞 {t('llamar')}
        </a>
      </div>
    </article>
  )
}
