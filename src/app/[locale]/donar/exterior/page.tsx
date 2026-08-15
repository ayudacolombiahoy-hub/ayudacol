import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navegacion'

export default async function DonarExterior({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('exterior')

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-extrabold">{t('titulo')}</h1>
      <p className="mt-4 text-gray-700">{t('intro')}</p>
      <ul className="mt-6 grid gap-3">
        {(['punto1', 'punto2', 'punto3', 'punto4'] as const).map((clave) => (
          <li key={clave} className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800 shadow-sm">
            {t(clave)}
          </li>
        ))}
      </ul>
      <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">{t('notaFiscal')}</p>
      <Link href="/donar" className="mt-6 inline-block rounded-lg bg-blue-700 px-5 py-2.5 font-bold text-white hover:bg-blue-800">
        💵 {t('verCampanas')}
      </Link>
    </main>
  )
}
