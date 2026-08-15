import { setRequestLocale, getTranslations } from 'next-intl/server'

const LINEAS = [
  { numero: '123', clave: 'linea123' as const },
  { numero: '132', clave: 'cruzRoja' as const },
  { numero: '144', clave: 'defensaCivil' as const },
  { numero: '119', clave: 'bomberos' as const },
  { numero: '123', clave: 'policia' as const },
]

export default async function Emergencia({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('emergencia')

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-extrabold">{t('titulo')}</h1>
      <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-800">
        🚨 {t('aviso')}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {LINEAS.map(({ numero, clave }) => (
          <article
            key={clave}
            className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-gray-600">{t(clave)}</p>
              <p className="text-3xl font-extrabold tabular-nums text-gray-900">{numero}</p>
            </div>
            <a
              href={`tel:${numero}`}
              className="shrink-0 rounded-lg bg-red-600 px-5 py-2.5 font-bold text-white hover:bg-red-700"
            >
              📞 {t('llamar')}
            </a>
          </article>
        ))}
      </div>
    </main>
  )
}
