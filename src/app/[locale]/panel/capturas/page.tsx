export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect, Link } from '@/i18n/navegacion'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { listarMunicipios } from '@/lib/datos/consultas'
import CargadorCapturas from './CargadorCapturas'

export default async function PanelCapturas({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && !ROLES_PANEL.includes(perfil.rol)) {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }

  const municipios = (await listarMunicipios()).map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t('capturas.titulo')}</h1>
        <Link href="/panel" className="text-sm text-blue-600 underline">{t('capturas.volverPanel')}</Link>
      </div>
      <CargadorCapturas municipios={municipios} />
    </main>
  )
}
