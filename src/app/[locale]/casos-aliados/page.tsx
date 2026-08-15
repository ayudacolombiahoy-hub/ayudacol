export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarCasosAliados } from '@/lib/datos/casos-aliados'
import { Miniatura } from './Miniatura'

const COLOR_PRIORIDAD: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800',
  MEDIA: 'bg-amber-100 text-amber-800',
  BAJA: 'bg-gray-100 text-gray-700',
}

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('casosAliados')
  const casos = await listarCasosAliados()

  const etiqueta = (grupo: 'grupos' | 'tipos' | 'prioridad', codigo: string) =>
    t.has(`${grupo}.${codigo}`) ? t(`${grupo}.${codigo}`) : codigo
  const codigos = (s: string | null) => (s ?? '').split('|').filter(Boolean)

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-extrabold">{t('titulo')}</h1>
      <p className="mb-1 text-gray-600">{t('intro')}</p>
      <p className="mb-6 text-sm text-gray-500">
        {t('atribucion')}{' '}
        <a
          href="https://mimanizales.info"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline"
        >
          MiManizales.info
        </a>
      </p>

      {casos.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('sinCasos')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {casos.map((c) => (
            <article
              key={c.case_id}
              className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              {c.imagen_url ? <Miniatura src={c.imagen_url} /> : null}
              <div className="flex flex-1 flex-col p-4">
                {c.prioridad ? (
                  <span
                    className={`mb-2 w-fit rounded-full px-2 py-0.5 text-xs font-bold ${
                      COLOR_PRIORIDAD[c.prioridad] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {etiqueta('prioridad', c.prioridad)}
                  </span>
                ) : null}
                <h2 className="text-base font-bold">{c.titulo}</h2>
                {c.municipio || c.sector ? (
                  <p className="mt-1 text-xs text-gray-500">
                    📍 {[c.sector, c.municipio].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                {codigos(c.tipos_necesidad).length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {codigos(c.tipos_necesidad).map((code) => (
                      <span key={code} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {etiqueta('tipos', code)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {c.necesidades_detalle ? (
                  <p className="mt-2 text-sm text-gray-700">{c.necesidades_detalle}</p>
                ) : null}
                {c.resumen_corto ? (
                  <p className="mt-1 line-clamp-3 text-sm text-gray-600">{c.resumen_corto}</p>
                ) : null}
                <a
                  href={c.url_origen}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {t('verCaso')}
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
