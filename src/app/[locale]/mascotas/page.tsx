export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarMascotas } from '@/lib/datos/mascotas'
import { listarMunicipios } from '@/lib/datos/consultas'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { Link } from '@/i18n/navegacion'
import TarjetaMascota from '@/componentes/listas/TarjetaMascota'
import FiltrosMascotas from '@/componentes/listas/FiltrosMascotas'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ municipio?: string; tipo?: string; especie?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations('mascotas')
  const [mascotas, municipios, perfil] = await Promise.all([
    listarMascotas(f),
    listarMunicipios(),
    obtenerPerfil(),
  ])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  const esEquipo = !!perfil && ROLES_PANEL.includes(perfil.rol)

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('titulo')}</h1>
        {esEquipo && (
          <Link href="/panel/mascotas" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
            {t('gestionar')}
          </Link>
        )}
      </div>
      <p className="mb-4 text-sm text-gray-600">{t('intro')}</p>
      <div className="mb-4">
        <Link href="/reportar/mascota" className="inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">
          🐾 {t('reportar')}
        </Link>
      </div>
      <FiltrosMascotas municipios={opcMuni} />
      {mascotas.length === 0 ? (
        <div>
          <Vacio mensaje={t('sin')} />
          <p className="mt-4 text-center">
            <Link href="/reportar/mascota" className="font-semibold text-blue-700 hover:underline">🐾 {t('reportar')}</Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {mascotas.map((m) => (
            <TarjetaMascota key={m.id} m={m} municipio={mapaMuni.get(m.municipio_id)} />
          ))}
        </div>
      )}
    </main>
  )
}
