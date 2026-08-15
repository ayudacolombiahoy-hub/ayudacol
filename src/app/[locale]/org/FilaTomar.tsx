'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionOrg } from './acciones'

type S = { id: string; categoria: string; descripcion: string; urgencia: string; municipio_id: string }

export default function FilaTomar({ s }: { s: S }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [oculta, setOculta] = useState(false)
  if (oculta) return null
  const borde = s.urgencia === 'alta' ? 'border-l-red-500' : s.urgencia === 'media' ? 'border-l-amber-500' : 'border-l-gray-300'
  return (
    <article className={`rounded-lg border border-gray-200 border-l-4 ${borde} bg-white p-4`}>
      <p className="font-bold">{t(`categorias.${s.categoria}`)}</p>
      <p className="text-sm text-gray-700">{s.descripcion}</p>
      <p className="mt-1 text-xs text-gray-500">📍 {s.municipio_id}</p>
      <button disabled={pending} onClick={() => start(async () => { const r = await accionOrg(s.id, 'tomar'); if (r.ok) setOculta(true) })}
        className="mt-3 rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
        {t('org.tomar')}
      </button>
    </article>
  )
}
