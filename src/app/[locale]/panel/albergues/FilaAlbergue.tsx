'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionActualizarAlbergue } from './acciones'
import { ESTADOS_ALBERGUE } from '@/lib/validacion/esquemas'

type Albergue = {
  id: string
  nombre: string
  municipio_id: string
  direccion: string
  capacidad: number | null
  ocupacion: number
  estado: string
}

const COLOR_ESTADO: Record<string, string> = {
  abierto: 'bg-green-100 text-green-800',
  lleno: 'bg-amber-100 text-amber-800',
  cerrado: 'bg-gray-200 text-gray-700',
}

export default function FilaAlbergue({ a, municipio }: { a: Albergue; municipio?: string }) {
  const t = useTranslations('albergues')
  const [pending, start] = useTransition()
  const [ocupacion, setOcupacion] = useState(String(a.ocupacion))
  const [estado, setEstado] = useState(a.estado)

  function guardarOcupacion() {
    const n = Number(ocupacion)
    if (!Number.isInteger(n) || n < 0) return
    start(async () => {
      const r = await accionActualizarAlbergue(a.id, { ocupacion: n })
      if (!r.ok) setOcupacion(String(a.ocupacion))
    })
  }

  function cambiarEstado(nuevo: string) {
    const anterior = estado
    setEstado(nuevo)
    start(async () => {
      const r = await accionActualizarAlbergue(a.id, { estado: nuevo })
      if (!r.ok) setEstado(anterior)
    })
  }

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-bold">{a.nombre}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[estado] ?? 'bg-gray-100 text-gray-600'}`}>
          {t(estado)}
        </span>
      </div>
      <p className="text-sm text-gray-600">📍 {municipio ?? a.municipio_id} · {a.direccion}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-gray-600">
          {t('ocupacion')} {a.capacidad != null && <span className="font-normal text-gray-400">/ {a.capacidad}</span>}
          <input
            type="number"
            min={0}
            step={1}
            value={ocupacion}
            disabled={pending}
            onChange={(ev) => setOcupacion(ev.target.value)}
            className="mt-1 block w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          disabled={pending}
          onClick={guardarOcupacion}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {t('actualizar')}
        </button>
        <label className="text-xs font-semibold text-gray-600">
          {t('estado')}
          <select
            value={estado}
            disabled={pending}
            onChange={(ev) => cambiarEstado(ev.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            {ESTADOS_ALBERGUE.map((op) => (
              <option key={op} value={op}>{t(op)}</option>
            ))}
          </select>
        </label>
      </div>
    </article>
  )
}
