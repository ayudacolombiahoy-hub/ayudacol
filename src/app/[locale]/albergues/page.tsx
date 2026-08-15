export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarAlbergues } from '@/lib/datos/albergues'
import { listarMunicipios } from '@/lib/datos/consultas'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { Link } from '@/i18n/navegacion'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'
import TarjetaAlbergue from '@/componentes/listas/TarjetaAlbergue'

export default async function Pagina({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ municipio?: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations('albergues')
  const tMaps = await getTranslations('maps')
  const [albergues, municipios, perfil] = await Promise.all([
    listarAlbergues(f),
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
          <Link href="/panel/albergues" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
            {t('gestionar')}
          </Link>
        )}
      </div>
      <p className="mb-4 text-sm text-gray-600">{t('intro')}</p>
      <BarraFiltros municipios={opcMuni} />
      {albergues.length === 0 ? (
        <Vacio mensaje={t('sinAlbergues')} />
      ) : (
        <div className="grid gap-3">
          {albergues.map((a) => {
            const libres = a.capacidad != null ? Math.max(0, a.capacidad - a.ocupacion) : null
            return (
              <TarjetaAlbergue
                key={a.id}
                a={a}
                municipioTexto={mapaMuni.get(a.municipio_id)}
                textoEstado={t(a.estado)}
                textoCupos={libres !== null ? t('cupos', { libres, total: a.capacidad }) : null}
                textoVerMapa={tMaps('verUbicacion')}
                textoComoLlegar={tMaps('comoLlegar')}
              />
            )
          })}
        </div>
      )}
    </main>
  )
}
