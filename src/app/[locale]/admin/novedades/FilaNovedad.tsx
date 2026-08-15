'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionEliminarNovedad } from './acciones'

type Novedad = {
  id: string
  titulo_es: string
  titulo_en: string
}

export default function FilaNovedad({ n }: { n: Novedad }) {
  const t = useTranslations('novedades')
  const [pending, start] = useTransition()
  const [eliminada, setEliminada] = useState(false)

  if (eliminada) return null

  return (
    <article className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <p className="font-bold">{n.titulo_es}</p>
      </div>
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const r = await accionEliminarNovedad(n.id)
          if (r.ok) setEliminada(true)
        })}
        className="rounded bg-red-100 px-3 py-1.5 text-sm font-bold text-red-800 disabled:opacity-50"
      >
        {t('eliminar')}
      </button>
    </article>
  )
}
