import { getTranslations, setRequestLocale } from 'next-intl/server'
import SelectorIdioma from '@/componentes/selector-idioma'

export default async function Inicio({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('inicio')
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex justify-end">
        <SelectorIdioma />
      </div>
      <h1 className="mt-8 text-3xl font-extrabold">{t('titulo')}</h1>
      <p className="mt-3 text-lg text-gray-600">{t('subtitulo')}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <span className="rounded-lg bg-red-100 px-4 py-2 font-bold text-red-900">
          🆘 {t('pedirAyuda')}
        </span>
        <span className="rounded-lg bg-green-100 px-4 py-2 font-bold text-green-900">
          🤝 {t('quieroAyudar')}
        </span>
        <span className="rounded-lg bg-blue-100 px-4 py-2 font-bold text-blue-900">
          💵 {t('donarDesdeEEUU')}
        </span>
      </div>
    </main>
  )
}
