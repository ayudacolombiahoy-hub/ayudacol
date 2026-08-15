'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionCambiarEstadoDesaparecido } from './acciones'

type Desaparecido = {
  id: string; nombre: string; edad: number | null; descripcion: string
  municipio_id: string | null; ultima_ubicacion: string | null
  estado: string; contacto_nombre: string; contacto_telefono: string; creada_en: string
}

const COLOR_ESTADO: Record<string, string> = {
  buscando: 'bg-amber-100 text-amber-800',
  encontrada: 'bg-green-100 text-green-800',
}

export default function FilaDesaparecido({ d, municipio }: { d: Desaparecido; municipio?: string }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [estado, setEstado] = useState(d.estado)
  const [oculta, setOculta] = useState(false)

  function cambiar(nuevo: 'encontrada' | 'cerrado') {
    start(async () => {
      const r = await accionCambiarEstadoDesaparecido(d.id, nuevo)
      if (r.ok) {
        if (nuevo === 'cerrado') setOculta(true)
        else setEstado(nuevo)
      }
    })
  }
  if (oculta) return null

  const ubicacion = [municipio, d.ultima_ubicacion].filter(Boolean).join(' · ')

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-bold">
          {d.nombre}
          {d.edad != null && <span className="font-normal text-gray-500"> · {t('desaparecidos.aniosAbrev', { n: d.edad })}</span>}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[estado] ?? 'bg-gray-100 text-gray-600'}`}>
          {t(`desaparecidos.${estado}`)}
        </span>
      </div>
      <p className="text-sm text-gray-700">{d.descripcion}</p>
      {ubicacion && <p className="mt-2 text-xs text-gray-600">📍 {ubicacion}</p>}
      <p className="mt-1 text-xs text-gray-600">
        {t('desaparecidos.contacto')}: <b>{d.contacto_nombre} — {d.contacto_telefono}</b>
      </p>
      <div className="mt-3 flex gap-2">
        {estado === 'buscando' && (
          <button disabled={pending} onClick={() => cambiar('encontrada')}
            className="rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
            ✓ {t('desaparecidos.marcarEncontrada')}
          </button>
        )}
        <button disabled={pending} onClick={() => cambiar('cerrado')}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {t('desaparecidos.cerrar')}
        </button>
      </div>
    </article>
  )
}
