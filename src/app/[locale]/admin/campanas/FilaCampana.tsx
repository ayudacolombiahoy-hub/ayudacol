'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionEliminarCampana } from './acciones'

type Campana = {
  id: string
  titulo_es: string
  titulo_en: string
  organizacion: string
  url: string
}

export default function FilaCampana({ c }: { c: Campana }) {
  const t = useTranslations('donar')
  const [pending, start] = useTransition()
  const [eliminada, setEliminada] = useState(false)

  if (eliminada) return null

  return (
    <article className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <p className="font-bold">{c.titulo_es} <span className="text-xs font-normal text-gray-500">· {c.organizacion}</span></p>
        <p className="text-xs text-gray-500">{c.url}</p>
      </div>
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const r = await accionEliminarCampana(c.id)
          if (r.ok) setEliminada(true)
        })}
        className="rounded bg-red-100 px-3 py-1.5 text-sm font-bold text-red-800 disabled:opacity-50"
      >
        {t('eliminar')}
      </button>
    </article>
  )
}
