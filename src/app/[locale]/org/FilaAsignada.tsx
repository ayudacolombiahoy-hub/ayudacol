'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionOrg } from './acciones'

type S = {
  id: string; categoria: string; descripcion: string; municipio_id: string
  contacto_nombre: string; contacto_telefono: string
}

export default function FilaAsignada({ s }: { s: S }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [oculta, setOculta] = useState(false)
  if (oculta) return null
  function actuar(accion: 'resolver' | 'liberar') {
    start(async () => { const r = await accionOrg(s.id, accion); if (r.ok) setOculta(true) })
  }
  return (
    <article className="rounded-lg border border-purple-200 bg-purple-50 p-4">
      <p className="font-bold">{t(`categorias.${s.categoria}`)}</p>
      <p className="text-sm text-gray-700">{s.descripcion}</p>
      <p className="mt-1 text-xs text-gray-600">📍 {s.municipio_id} · {t('panel.contacto')}: <b>{s.contacto_nombre} — {s.contacto_telefono}</b></p>
      <div className="mt-3 flex gap-2">
        <button disabled={pending} onClick={() => actuar('resolver')}
          className="rounded bg-green-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">{t('org.resolver')}</button>
        <button disabled={pending} onClick={() => actuar('liberar')}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">{t('org.liberar')}</button>
      </div>
    </article>
  )
}
