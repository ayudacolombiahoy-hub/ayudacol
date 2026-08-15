export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { listarAlbergues } from '@/lib/datos/albergues'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioAlbergue from './FormularioAlbergue'
import FilaAlbergue from './FilaAlbergue'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && !ROLES_PANEL.includes(perfil.rol)) {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }

  const [albergues, municipiosRaw] = await Promise.all([listarAlbergues(), listarMunicipios()])
  const municipios = municipiosRaw.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  const mapaMuni = new Map(municipiosRaw.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('albergues.gestionar')}</h1>
      <FormularioAlbergue municipios={municipios} />
      {albergues.length === 0 ? (
        <p className="text-sm text-gray-500">—</p>
      ) : (
        <div className="grid gap-3">
          {albergues.map((a) => (
            <FilaAlbergue key={a.id} a={a} municipio={mapaMuni.get(a.municipio_id)} />
          ))}
        </div>
      )}
    </main>
  )
}
