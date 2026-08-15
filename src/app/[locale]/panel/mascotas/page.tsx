export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { listarColaMascotas } from '@/lib/datos/mascotas'
import { listarMunicipios } from '@/lib/datos/consultas'
import FilaMascota from './FilaMascota'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && !ROLES_PANEL.includes(perfil.rol)) {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }

  const [cola, municipiosRaw] = await Promise.all([listarColaMascotas(), listarMunicipios()])
  const mapaMuni = new Map(municipiosRaw.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('mascotas.gestionar')}</h1>
      {cola.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('mascotas.sinCola')}</p>
      ) : (
        <div className="grid gap-3">
          {cola.map((m) => <FilaMascota key={m.id} m={m} municipio={mapaMuni.get(m.municipio_id)} />)}
        </div>
      )}
    </main>
  )
}
