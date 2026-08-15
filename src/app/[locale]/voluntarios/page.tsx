export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarVoluntarios, listarMunicipios } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'
import TarjetaVoluntario from '@/componentes/listas/TarjetaVoluntario'

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('listas.tituloVoluntarios')}</h1>
        <Link href="/reportar/voluntario" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">
          🤝 {t('acciones.ofrecerVoluntariado')}
        </Link>
      </div>
      <BarraFiltros municipios={opcMuni} />
      {voluntarios.length === 0 ? (
        <div>
          <Vacio />
          <p className="mt-4 text-center">
            <Link href="/reportar/voluntario" className="font-semibold text-green-700 hover:underline">🤝 {t('acciones.ofrecerVoluntariado')}</Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {voluntarios.map((v) => (
            <TarjetaVoluntario
              key={v.id}
              v={v}
              habilidadesTexto={(v.habilidades ?? []).map((h: string) => t(`habilidades.${h}`)).join(', ')}
              municipioTexto={mapaMuni.get(v.municipio_id)}
            />
          ))}
        </div>
      )}
    </main>
  )
}
