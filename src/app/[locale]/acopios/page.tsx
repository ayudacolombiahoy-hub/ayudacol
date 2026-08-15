export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarAcopios, listarMunicipios } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'
import BotonesMaps from '@/componentes/BotonesMaps'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'

export default async function Pagina({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ municipio?: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations('listas')
  const tRoot = await getTranslations()
  const tMaps = await getTranslations('maps')
  const [acopios, municipios, perfil] = await Promise.all([listarAcopios(f), listarMunicipios(), obtenerPerfil()])
  const esEquipo = !!perfil && ROLES_PANEL.includes(perfil.rol)
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('tituloAcopios')}</h1>
        <div className="flex flex-wrap gap-2">
          {esEquipo && (
            <Link href="/panel/acopios" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
              {tRoot('acopiosPublico.gestionar')}
            </Link>
          )}
          <Link href="/acopios/proponer" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">
            📦 {tRoot('org.nuevoAcopio')}
          </Link>
        </div>
      </div>
      <BarraFiltros municipios={opcMuni} />
      {acopios.length === 0 ? (
        <div>
          <Vacio />
          <p className="mt-4 text-center">
            <Link href="/acopios/proponer" className="font-semibold text-slate-700 hover:underline">📦 {tRoot('org.nuevoAcopio')}</Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {acopios.map((a) => (
            <article key={a.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-bold">{a.nombre}</h2>
              <p className="text-sm text-gray-600">📍 {mapaMuni.get(a.municipio_id) ?? a.municipio_id} · {a.direccion}</p>
              {a.horarios && <p className="text-sm text-gray-600">🕓 {a.horarios}</p>}
              {a.recibe?.length > 0 && <p className="mt-2 text-sm"><b>{t('recibe')}:</b> {a.recibe.join(', ')}</p>}
              {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('noNecesita')}:</b> {a.no_necesita.join(', ')}</p>}
              <BotonesMaps
                direccion={a.direccion}
                municipioTexto={mapaMuni.get(a.municipio_id)}
                lat={a.lat}
                lng={a.lng}
                textoVer={tMaps('verUbicacion')}
                textoComoLlegar={tMaps('comoLlegar')}
              />
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
