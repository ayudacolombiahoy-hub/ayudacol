export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { listarNovedades } from '@/lib/datos/novedades'
import FormularioNovedad from './FormularioNovedad'
import FilaNovedad from './FilaNovedad'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('novedades')
  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && perfil.rol !== 'admin') {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">403</p></main>
  }
  const novedades = await listarNovedades()
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('adminTitulo')}</h1>
      <FormularioNovedad />
      {novedades.length === 0 ? (
        <p className="text-gray-500">{t('sin')}</p>
      ) : (
        <div className="grid gap-2">
          {novedades.map((n) => <FilaNovedad key={n.id} n={n} />)}
        </div>
      )}
    </main>
  )
}
