export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { listarOrganizaciones } from '@/lib/datos/admin'
import FilaOrg from './FilaOrg'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin')
  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && perfil.rol !== 'admin') {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">403</p></main>
  }
  const orgs = await listarOrganizaciones()
  const pendientes = orgs.filter((o) => o.estado === 'pendiente')
  const aprobadas = orgs.filter((o) => o.estado === 'aprobada')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('titulo')}</h1>
      {orgs.length === 0 && <p className="text-gray-500">{t('sinOrgs')}</p>}
      {pendientes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase text-gray-500">{t('pendientes')}</h2>
          <div className="grid gap-2">{pendientes.map((o) => <FilaOrg key={o.id} o={o} />)}</div>
        </section>
      )}
      {aprobadas.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase text-gray-500">{t('aprobadas')}</h2>
          <div className="grid gap-2">{aprobadas.map((o) => <FilaOrg key={o.id} o={o} />)}</div>
        </section>
      )}
    </main>
  )
}
