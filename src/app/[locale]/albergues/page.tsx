export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarAlbergues } from '@/lib/datos/albergues'
import { listarMunicipios } from '@/lib/datos/consultas'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { Link } from '@/i18n/navegacion'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'

const COLOR_ESTADO: Record<string, string> = {
  abierto: 'bg-green-100 text-green-800',
  lleno: 'bg-amber-100 text-amber-800',
  cerrado: 'bg-gray-200 text-gray-700',
}

export default async function Pagina({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ municipio?: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations('albergues')
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
              <article key={a.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h2 className="font-bold">{a.nombre}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[a.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                    {t(a.estado)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">📍 {mapaMuni.get(a.municipio_id) ?? a.municipio_id} · {a.direccion}</p>
                {libres !== null && (
                  <p className="mt-1 text-sm font-semibold text-gray-700">{t('cupos', { libres, total: a.capacidad })}</p>
                )}
                {a.contacto_publico && <p className="mt-1 text-sm text-gray-600">☎️ {a.contacto_publico}</p>}
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
