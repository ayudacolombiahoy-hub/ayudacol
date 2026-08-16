export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations, getLocale } from 'next-intl/server'
import { listarNovedades } from '@/lib/datos/novedades'
import { tiempoRelativo } from '@/lib/formato'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('novedades')
  const localeActual = (await getLocale()) as 'es' | 'en'
  const es = localeActual === 'es'
  const novedades = await listarNovedades()
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-extrabold">{t('titulo')}</h1>
      <p className="mb-6 text-gray-600">{t('intro')}</p>
      {novedades.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('sin')}</p>
      ) : (
        <div className="grid gap-4">
          {novedades.map((n) => (
            <article key={n.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {n.fotos?.length > 0 && (
                <div className="flex flex-col">
                  {n.fotos.map((url: string) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" className="w-full object-contain" />
                  ))}
                </div>
              )}
              <div className="p-5">
                <h2 className="text-lg font-bold">{es ? n.titulo_es : n.titulo_en}</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{es ? n.contenido_es : n.contenido_en}</p>
                {n.enlace && (
                  <a href={n.enlace} target="_blank" rel="noopener noreferrer"
                    className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                    {(es ? n.enlace_texto_es : n.enlace_texto_en) || t('verMas')} →
                  </a>
                )}
                <p className="mt-3 text-xs text-gray-500">🕓 {tiempoRelativo(n.creada_en, localeActual)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
