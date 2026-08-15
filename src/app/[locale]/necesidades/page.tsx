export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarNecesidades, listarMunicipios } from '@/lib/datos/consultas'
import { CATEGORIAS } from '@/lib/validacion/esquemas'
import TarjetaNecesidad from '@/componentes/listas/TarjetaNecesidad'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ municipio?: string; categoria?: string; estado?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations()
  const [necesidades, municipios] = await Promise.all([listarNecesidades(f), listarMunicipios()])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  const opcCat = CATEGORIAS.map((c) => ({ valor: c, texto: t(`categorias.${c}`) }))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-extrabold">{t('listas.tituloNecesidades')}</h1>
      <BarraFiltros municipios={opcMuni} categorias={opcCat} />
      {necesidades.length === 0 ? <Vacio /> : (
        <div className="grid gap-3">
          {necesidades.map((n) => <TarjetaNecesidad key={n.id} n={n} municipio={mapaMuni.get(n.municipio_id)} />)}
        </div>
      )}
    </main>
  )
}
