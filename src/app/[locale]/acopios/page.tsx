export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarAcopios, listarMunicipios } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ municipio?: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations('listas')
  const tRoot = await getTranslations()
  const [acopios, municipios] = await Promise.all([listarAcopios(f), listarMunicipios()])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('tituloAcopios')}</h1>
        <Link href="/org/acopios" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          📦 {tRoot('org.nuevoAcopio')}
        </Link>
      </div>
      <p className="mb-4 text-xs text-gray-500">{tRoot('org.acopioSoloOrgs')}</p>
      <BarraFiltros municipios={opcMuni} />
      {acopios.length === 0 ? (
        <div>
          <Vacio />
          <p className="mt-4 text-center">
            <Link href="/org/acopios" className="font-semibold text-slate-700 hover:underline">📦 {tRoot('org.nuevoAcopio')}</Link>
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
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
