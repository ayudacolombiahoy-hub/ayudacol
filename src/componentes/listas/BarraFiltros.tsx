'use client'
import { useRouter, usePathname } from '@/i18n/navegacion'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Opcion } from '@/componentes/formularios/SelectCatalogo'

export default function BarraFiltros({
  municipios, categorias,
}: { municipios: Opcion[]; categorias?: Opcion[] }) {
  const t = useTranslations('listas')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function cambiar(clave: string, valor: string) {
    const p = new URLSearchParams(params.toString())
    if (valor) p.set(clave, valor); else p.delete(clave)
    router.replace(`${pathname}?${p.toString()}`)
  }

  const sel = 'rounded-lg border border-gray-300 px-3 py-2 text-sm'
  return (
    <div className="mb-5 flex flex-wrap gap-3">
      <select className={sel} defaultValue={params.get('municipio') ?? ''} onChange={(e) => cambiar('municipio', e.target.value)}>
        <option value="">{t('filtroMunicipio')}: {t('filtroTodos')}</option>
        {municipios.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
      </select>
      {categorias && (
        <select className={sel} defaultValue={params.get('categoria') ?? ''} onChange={(e) => cambiar('categoria', e.target.value)}>
          <option value="">{t('filtroCategoria')}: {t('filtroTodos')}</option>
          {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
        </select>
      )}
    </div>
  )
}
