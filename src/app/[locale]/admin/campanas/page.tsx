export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { listarCampanas } from '@/lib/datos/campanas'
import FormularioCampana from './FormularioCampana'
import FilaCampana from './FilaCampana'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('donar')
  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && perfil.rol !== 'admin') {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">403</p></main>
  }
  const campanas = await listarCampanas()
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('adminTitulo')}</h1>
      <FormularioCampana />
      {campanas.length === 0 ? (
        <p className="text-gray-500">{t('sin')}</p>
      ) : (
        <div className="grid gap-2">
          {campanas.map((c) => <FilaCampana key={c.id} c={c} />)}
        </div>
      )}
    </main>
  )
}
