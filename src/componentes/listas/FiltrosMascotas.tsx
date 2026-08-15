'use client'
import { useRouter, usePathname } from '@/i18n/navegacion'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Opcion } from '@/componentes/formularios/SelectCatalogo'

const TIPOS = ['perdida', 'encontrada'] as const
const ESPECIES = ['perro', 'gato', 'ave', 'otro'] as const

export default function FiltrosMascotas({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations('mascotas')
  const tListas = useTranslations('listas')
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
      <select className={sel} defaultValue={params.get('tipo') ?? ''} onChange={(e) => cambiar('tipo', e.target.value)}>
        <option value="">{t('filtroTipo')}: {tListas('filtroTodos')}</option>
        {TIPOS.map((v) => <option key={v} value={v}>{t(`tipo_${v}`)}</option>)}
      </select>
      <select className={sel} defaultValue={params.get('especie') ?? ''} onChange={(e) => cambiar('especie', e.target.value)}>
        <option value="">{t('filtroEspecie')}: {tListas('filtroTodos')}</option>
        {ESPECIES.map((v) => <option key={v} value={v}>{t(`especie_${v}`)}</option>)}
      </select>
      <select className={sel} defaultValue={params.get('municipio') ?? ''} onChange={(e) => cambiar('municipio', e.target.value)}>
        <option value="">{tListas('filtroMunicipio')}: {tListas('filtroTodos')}</option>
        {municipios.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
      </select>
    </div>
  )
}
