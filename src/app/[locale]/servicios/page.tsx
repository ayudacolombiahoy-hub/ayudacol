export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarServicios, listarMunicipios } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'
import TarjetaServicio from '@/componentes/listas/TarjetaServicio'

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('listas.tituloServicios')}</h1>
        <Link href="/reportar/servicio" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          🔧 {t('acciones.ofrecerServicio')}
        </Link>
      </div>
      <BarraFiltros municipios={opcMuni} />
      {servicios.length === 0 ? (
        <div>
          <Vacio />
          <p className="mt-4 text-center">
            <Link href="/reportar/servicio" className="font-semibold text-blue-700 hover:underline">🔧 {t('acciones.ofrecerServicio')}</Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {servicios.map((s) => (
            <TarjetaServicio key={s.id} s={s} tipoTexto={t(`tiposServicio.${s.tipo}`)} municipioTexto={mapaMuni.get(s.municipio_id)} />
          ))}
        </div>
      )}
    </main>
  )
}
