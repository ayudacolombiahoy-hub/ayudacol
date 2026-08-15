export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarVoluntarios, listarMunicipios } from '@/lib/datos/consultas'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ municipio?: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations()
  const [voluntarios, municipios] = await Promise.all([listarVoluntarios(f), listarMunicipios()])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-extrabold">{t('listas.tituloVoluntarios')}</h1>
      <BarraFiltros municipios={opcMuni} />
      {voluntarios.length === 0 ? <Vacio /> : (
        <div className="grid gap-3">
          {voluntarios.map((v) => (
            <article key={v.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm">🛠️ {(v.habilidades ?? []).map((h: string) => t(`habilidades.${h}`)).join(', ')}</p>
              <p className="mt-1 text-xs text-gray-500">📍 {mapaMuni.get(v.municipio_id) ?? v.municipio_id}{v.disponibilidad ? ` · ${v.disponibilidad}` : ''}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
