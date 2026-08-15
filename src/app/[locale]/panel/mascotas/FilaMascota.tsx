'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionCambiarEstadoMascota } from './acciones'

type Mascota = {
  id: string; tipo_reporte: string; especie: string; nombre: string | null; descripcion: string
  municipio_id: string | null; ultima_ubicacion: string | null
  estado: string; contacto_nombre: string; contacto_telefono: string; creada_en: string
}

const COLOR_TIPO: Record<string, string> = {
  perdida: 'bg-amber-100 text-amber-800',
  encontrada: 'bg-green-100 text-green-800',
}

export default function FilaMascota({ m, municipio }: { m: Mascota; municipio?: string }) {
  const t = useTranslations('mascotas')
  const [pending, start] = useTransition()
  const [estado, setEstado] = useState(m.estado)
  const [oculta, setOculta] = useState(false)

  function cambiar(nuevo: 'reunida' | 'cerrado') {
    start(async () => {
      const r = await accionCambiarEstadoMascota(m.id, nuevo)
      if (r.ok) {
        if (nuevo === 'cerrado') setOculta(true)
        else setEstado(nuevo)
      }
    })
  }
  if (oculta) return null

  const ubicacion = [municipio, m.ultima_ubicacion].filter(Boolean).join(' · ')
  const titulo = [t(`especie_${m.especie}`), m.nombre].filter(Boolean).join(' · ')

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-bold">🐾 {titulo}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_TIPO[m.tipo_reporte] ?? 'bg-gray-100 text-gray-600'}`}>
          {t(`tipo_${m.tipo_reporte}`)} · {t(`estado_${estado}`)}
        </span>
      </div>
      <p className="text-sm text-gray-700">{m.descripcion}</p>
      {ubicacion && <p className="mt-2 text-xs text-gray-600">📍 {ubicacion}</p>}
      <p className="mt-1 text-xs text-gray-600">
        {t('contacto')}: <b>{m.contacto_nombre} — {m.contacto_telefono}</b>
      </p>
      <div className="mt-3 flex gap-2">
        {estado === 'activo' && (
          <button disabled={pending} onClick={() => cambiar('reunida')}
            className="rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
            ✓ {t('marcarReunida')}
          </button>
        )}
        <button disabled={pending} onClick={() => cambiar('cerrado')}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {t('cerrar')}
        </button>
      </div>
    </article>
  )
}
