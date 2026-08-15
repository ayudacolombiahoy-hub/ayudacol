export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { listarVerificadasParaTomar, listarMisAsignadas } from '@/lib/datos/org'
import { Link } from '@/i18n/navegacion'
import FilaTomar from './FilaTomar'
import FilaAsignada from './FilaAsignada'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && perfil.rol !== 'org') {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }
  const [paraTomar, asignadas] = await Promise.all([listarVerificadasParaTomar(), listarMisAsignadas()])
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t('org.titulo')}</h1>
        <Link href="/org/acopios" className="text-sm font-semibold text-blue-700">{t('org.misAcopios')} →</Link>
      </div>
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-bold uppercase text-gray-500">{t('org.misAsignadas')}</h2>
        {asignadas.length === 0 ? <p className="text-sm text-gray-500">{t('org.sinAsignadas')}</p> : (
          <div className="grid gap-3">{asignadas.map((s) => <FilaAsignada key={s.id} s={s} />)}</div>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase text-gray-500">{t('org.paraTomar')}</h2>
        {paraTomar.length === 0 ? <p className="text-sm text-gray-500">{t('org.sinVerificadas')}</p> : (
          <div className="grid gap-3">{paraTomar.map((s) => <FilaTomar key={s.id} s={s} />)}</div>
        )}
      </section>
    </main>
  )
}
