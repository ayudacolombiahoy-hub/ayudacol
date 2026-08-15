export const dynamic = 'force-dynamic'

import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navegacion'
import { resumenPorDepartamento, contadoresDesdeResumen } from '@/lib/datos/agregados'
import Visualizador from '@/componentes/visualizador/Visualizador'
import EnVivo from '@/componentes/EnVivo'

export default async function Inicio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('inicio')
  const tv = await getTranslations('viz')
  const resumen = await resumenPorDepartamento()
  const total = contadoresDesdeResumen(resumen)

  return (
    <main className="mx-auto max-w-5xl p-6">
      <EnVivo />
      <h1 className="text-3xl font-extrabold">{t('titulo')}</h1>
      <p className="mt-2 text-lg text-gray-600">{t('subtitulo')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/reportar/necesidad" className="rounded-lg bg-red-100 px-4 py-2 font-bold text-red-900">🆘 {t('pedirAyuda')}</Link>
        <Link href="/reportar/voluntario" className="rounded-lg bg-green-100 px-4 py-2 font-bold text-green-900">🤝 {t('quieroAyudar')}</Link>
        <Link href="/donar" className="rounded-lg bg-blue-100 px-4 py-2 font-bold text-blue-900">🗺️ {t('donarDesdeEEUU')}</Link>
      </div>
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase text-gray-500">{tv('titulo')}</h2>
        <Visualizador resumen={resumen} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Contador n={total.activas} etiqueta={tv('activas')} />
          <Contador n={total.urgentes} etiqueta={tv('urgentes')} color="text-red-600" />
          <Contador n={total.acopios} etiqueta={tv('acopios')} color="text-green-600" />
          <Contador n={total.resueltas} etiqueta={tv('resueltas')} color="text-lime-600" />
        </div>
      </div>
    </main>
  )
}

function Contador({ n, etiqueta, color = 'text-gray-900' }: { n: number; etiqueta: string; color?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
      <div className={`text-3xl font-extrabold tabular-nums ${color}`}>{n}</div>
      <div className="text-xs text-gray-500">{etiqueta}</div>
    </div>
  )
}
