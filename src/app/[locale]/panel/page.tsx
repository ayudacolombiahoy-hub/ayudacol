export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { listarCola } from '@/lib/datos/moderacion'
import BotonSalir from '@/componentes/BotonSalir'
import FilaSolicitud from './FilaSolicitud'

export default async function Panel({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && !ROLES_PANEL.includes(perfil.rol)) {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }

  const cola = await listarCola()

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t('panel.titulo')}</h1>
        <BotonSalir />
      </div>
      {cola.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('panel.sinPendientes')}</p>
      ) : (
        <div className="grid gap-3">
          {cola.map((s) => <FilaSolicitud key={s.id} s={s} />)}
        </div>
      )}
    </main>
  )
}
