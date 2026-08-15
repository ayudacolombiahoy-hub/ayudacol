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
            <article key={n.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">{es ? n.titulo_es : n.titulo_en}</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{es ? n.contenido_es : n.contenido_en}</p>
              <p className="mt-3 text-xs text-gray-500">🕓 {tiempoRelativo(n.creada_en, localeActual)}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
