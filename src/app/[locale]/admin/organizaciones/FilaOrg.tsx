'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionAprobar } from './acciones'

type Org = { id: string; nombre: string; tipo: string; estado: string; descripcion: string | null }

export default function FilaOrg({ o }: { o: Org }) {
  const t = useTranslations('admin')
  const [pending, start] = useTransition()
  const [estado, setEstado] = useState(o.estado)
  return (
    <article className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <p className="font-bold">{o.nombre} <span className="text-xs font-normal text-gray-500">· {o.tipo}</span></p>
        {o.descripcion && <p className="text-sm text-gray-600">{o.descripcion}</p>}
      </div>
      {estado === 'aprobada' ? (
        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">✓ {t('aprobada')}</span>
      ) : (
        <button disabled={pending} onClick={() => start(async () => { const r = await accionAprobar(o.id); if (r.ok) setEstado('aprobada') })}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
          {t('aprobar')}
        </button>
      )}
    </article>
  )
}
