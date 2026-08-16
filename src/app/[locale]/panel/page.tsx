export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect, Link } from '@/i18n/navegacion'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { listarCola } from '@/lib/datos/moderacion'
import { listarMunicipios } from '@/lib/datos/consultas'
import BotonSalir from '@/componentes/BotonSalir'
import FilaSolicitud from './FilaSolicitud'
import FormularioTranscripcion from './FormularioTranscripcion'

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
  const municipios = (await listarMunicipios()).map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t('panel.titulo')}</h1>
        <BotonSalir />
      </div>
      <FormularioTranscripcion municipios={municipios} />
      <Link href="/panel/capturas" className="mb-6 block rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800 hover:bg-blue-100">
        🖼️ {t('capturas.enlacePanel')}
      </Link>
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
