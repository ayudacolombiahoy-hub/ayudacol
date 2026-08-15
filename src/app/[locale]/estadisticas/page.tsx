export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { estadisticasGlobales } from '@/lib/datos/estadisticas'
import EnVivo from '@/componentes/EnVivo'
import ExportarCSV from '@/componentes/ExportarCSV'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('stats')
  const tCategorias = await getTranslations('categorias')
  const tEstados = await getTranslations('estados')
  const stats = await estadisticasGlobales()
  const { contadores } = stats

  return (
    <main className="mx-auto max-w-5xl p-6">
      <EnVivo />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{t('titulo')}</h1>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
          {t('enVivo')} · {t('actualizado')}
        </span>
      </div>
      <p className="mb-6 text-sm text-gray-600">{t('intro')}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile n={contadores.activas} etiqueta={t('activas')} color="text-blue-700" />
        <Tile n={contadores.urgentes} etiqueta={t('urgentes')} color="text-red-600" />
        <Tile n={contadores.resueltas} etiqueta={t('resueltas')} color="text-green-700" />
        <Tile n={contadores.acopios} etiqueta={t('acopios')} />
        <Tile n={contadores.voluntarios} etiqueta={t('voluntarios')} />
        <Tile n={contadores.albergues} etiqueta={t('albergues')} />
      </div>

      <SeccionBarras
        titulo={t('porCategoria')}
        color="azul"
        filas={stats.porCategoria.map((c) => ({ clave: c.valor, etiqueta: tCategorias(c.valor), n: c.n }))}
      />
      <SeccionBarras
        titulo={t('porEstado')}
        color="ambar"
        filas={stats.porEstado.map((c) => ({ clave: c.valor, etiqueta: tEstados(c.valor), n: c.n }))}
      />
      <SeccionBarras
        titulo={t('porDepartamento')}
        color="azul"
        filas={stats.porDepartamento.map((d) => ({ clave: d.departamento, etiqueta: d.departamento, n: d.activas }))}
      />

      <div className="mt-8">
        <ExportarCSV filas={stats.porDepartamento} nombreArchivo="estadisticas-por-departamento.csv" etiqueta={t('exportar')} />
      </div>
    </main>
  )
}

function Tile({ n, etiqueta, color = 'text-gray-900' }: { n: number; etiqueta: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
      <div className={`text-4xl font-extrabold tabular-nums ${color}`}>{n}</div>
      <div className="mt-1 text-xs font-medium text-gray-500">{etiqueta}</div>
    </div>
  )
}

const COLOR_BARRA: Record<'azul' | 'ambar', string> = {
  azul: 'bg-blue-600',
  ambar: 'bg-amber-500',
}

function SeccionBarras({
  titulo, filas, color,
}: { titulo: string; filas: { clave: string; etiqueta: string; n: number }[]; color: 'azul' | 'ambar' }) {
  const max = Math.max(1, ...filas.map((f) => f.n))
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold uppercase text-gray-500">{titulo}</h2>
      {filas.length === 0 ? (
        <Vacio />
      ) : (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {filas.map((f) => (
            <div key={f.clave} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 truncate text-gray-700" title={f.etiqueta}>{f.etiqueta}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${COLOR_BARRA[color]}`}
                  style={{ width: `${Math.round((f.n / max) * 100)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-bold tabular-nums text-gray-800">{f.n}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
