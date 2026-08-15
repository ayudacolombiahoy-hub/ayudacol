export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { listarMisAcopios } from '@/lib/datos/acopios-org'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioAcopio from './FormularioAcopio'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && perfil.rol !== 'org') {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }
  const [acopios, municipios] = await Promise.all([
    listarMisAcopios(),
    listarMunicipios().then((ms) => ms.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))),
  ])
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('org.misAcopios')}</h1>
      <FormularioAcopio municipios={municipios} />
      {acopios.length === 0 ? <p className="text-sm text-gray-500">—</p> : (
        <div className="grid gap-3">
          {acopios.map((a) => (
            <article key={a.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="font-bold">{a.nombre} <span className="text-xs font-normal text-gray-500">· {a.estado}</span></p>
              <p className="text-sm text-gray-600">📍 {a.municipio_id} · {a.direccion}</p>
              {a.recibe?.length > 0 && <p className="mt-1 text-sm"><b>{t('org.recibe')}:</b> {a.recibe.join(', ')}</p>}
              {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('org.noNecesita')}:</b> {a.no_necesita.join(', ')}</p>}
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
