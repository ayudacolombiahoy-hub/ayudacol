'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionModerarAcopio } from './acciones'

type Acopio = {
  id: string; nombre: string; direccion: string; municipio_id: string
  horarios: string | null; contacto_publico: string | null
  recibe: string[]; no_necesita: string[]; creada_en: string
}

export default function FilaAcopio({ a, municipio }: { a: Acopio; municipio?: string }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [oculta, setOculta] = useState(false)

  function moderar(accion: 'aprobar' | 'rechazar') {
    start(async () => {
      const r = await accionModerarAcopio(a.id, accion)
      if (r.ok) setOculta(true)
    })
  }
  if (oculta) return null

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="font-bold">{a.nombre}</p>
      <p className="text-sm text-gray-600">📍 {municipio ?? a.municipio_id} · {a.direccion}</p>
      {a.horarios && <p className="text-sm text-gray-600">🕓 {a.horarios}</p>}
      {a.contacto_publico && <p className="text-sm text-gray-600">☎️ {a.contacto_publico}</p>}
      {a.recibe?.length > 0 && <p className="mt-2 text-sm"><b>{t('org.recibe')}:</b> {a.recibe.join(', ')}</p>}
      {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('org.noNecesita')}:</b> {a.no_necesita.join(', ')}</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={pending} onClick={() => moderar('aprobar')}
          className="rounded bg-green-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
          ✓ {t('acopiosPublico.aprobar')}
        </button>
        <button disabled={pending} onClick={() => moderar('rechazar')}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {t('acopiosPublico.rechazar')}
        </button>
      </div>
    </article>
  )
}
