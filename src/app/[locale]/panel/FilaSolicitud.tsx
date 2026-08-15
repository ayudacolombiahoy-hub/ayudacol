'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionModerar } from './acciones'
import type { AccionModeracion } from '@/lib/datos/moderacion'

type Solicitud = {
  id: string; categoria: string; descripcion: string; urgencia: string
  estado: string; municipio_id: string; origen: string
  contacto_nombre: string; contacto_telefono: string; creada_en: string
}

export default function FilaSolicitud({ s }: { s: Solicitud }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [oculta, setOculta] = useState(false)

  function moderar(accion: AccionModeracion) {
    start(async () => {
      const r = await accionModerar(s.id, accion)
      if (r.ok) setOculta(true)
    })
  }
  if (oculta) return null

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold">{t(`categorias.${s.categoria}`)}</span>
        <span className="text-xs text-gray-500">{t('panel.origen')}: {s.origen}</span>
      </div>
      <p className="text-sm text-gray-700">{s.descripcion}</p>
      <p className="mt-2 text-xs text-gray-600">
        📍 {s.municipio_id} · {t('panel.contacto')}: <b>{s.contacto_nombre} — {s.contacto_telefono}</b>
      </p>
      <div className="mt-3 flex gap-2">
        <button disabled={pending} onClick={() => moderar('verificar')}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
          ✓ {t('panel.verificar')}
        </button>
        <button disabled={pending} onClick={() => moderar('duplicar')}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {t('panel.duplicar')}
        </button>
        <button disabled={pending} onClick={() => moderar('rechazar')}
          className="rounded bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-800 disabled:opacity-50">
          {t('panel.rechazar')}
        </button>
      </div>
    </article>
  )
}
