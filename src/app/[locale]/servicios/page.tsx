export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarServicios, listarMunicipios } from '@/lib/datos/consultas'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ municipio?: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations()
  const [servicios, municipios] = await Promise.all([listarServicios(f), listarMunicipios()])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-extrabold">{t('listas.tituloServicios')}</h1>
      <BarraFiltros municipios={opcMuni} />
      {servicios.length === 0 ? <Vacio /> : (
        <div className="grid gap-3">
          {servicios.map((s) => (
            <article key={s.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="font-semibold">{t(`tiposServicio.${s.tipo}`)}</p>
              <p className="text-sm text-gray-700">{s.descripcion}</p>
              <p className="mt-1 text-xs text-gray-500">📍 {mapaMuni.get(s.municipio_id) ?? s.municipio_id}{s.capacidad ? ` · ${s.capacidad}` : ''}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
