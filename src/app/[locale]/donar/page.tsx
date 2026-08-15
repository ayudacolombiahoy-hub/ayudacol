export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarCampanas } from '@/lib/datos/campanas'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { Link } from '@/i18n/navegacion'

export default async function Donar({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('donar')
  const es = locale === 'es'
  const [campanas, perfil] = await Promise.all([listarCampanas(), obtenerPerfil()])
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('titulo')}</h1>
        {perfil?.rol === 'admin' && <Link href="/admin/campanas" className="text-sm font-semibold text-blue-700">{t('gestionar')} →</Link>}
      </div>
      <p className="mb-2 text-gray-600">{t('intro')}</p>
      <p className="mb-6">
        <Link href="/donar/exterior" className="text-sm font-semibold text-blue-700 hover:underline">
          {t('verExterior')}
        </Link>
      </p>
      {campanas.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('sin')}</p>
      ) : (
        <div className="grid gap-4">
          {campanas.map((c) => (
            <article key={c.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">✓ {t('verificada')}</span>
                <span className="text-xs text-gray-500">{c.organizacion}</span>
              </div>
              <h2 className="text-lg font-bold">{es ? c.titulo_es : c.titulo_en}</h2>
              <p className="mt-1 text-sm text-gray-700">{es ? c.descripcion_es : c.descripcion_en}</p>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-lg bg-blue-700 px-5 py-2.5 font-bold text-white hover:bg-blue-800">💵 {t('boton')}</a>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
