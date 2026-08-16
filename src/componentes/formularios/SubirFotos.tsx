'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { crearClienteNavegador } from '@/lib/supabase/navegador'

const TAMANO_MAXIMO = 5 * 1024 * 1024 // 5MB

// Sube VARIAS imágenes al bucket público "fotos" y deja cada URL en un input oculto
// con el mismo `name`, para que viajen como arreglo (formData.getAll(name)).
// Reutiliza el namespace i18n "foto". `max` limita la cantidad (por defecto 5).
export default function SubirFotos({ name, label, max = 5 }: { name: string; label?: string; max?: number }) {
  const t = useTranslations('foto')
  const [urls, setUrls] = useState<string[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  async function alElegirArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    e.target.value = '' // permite re-elegir los mismos archivos
    if (!archivos.length) return
    setError('')
    const cupo = max - urls.length
    if (cupo <= 0) return
    setSubiendo(true)
    const sb = crearClienteNavegador()
    const nuevas: string[] = []
    for (const archivo of archivos.slice(0, cupo)) {
      if (archivo.size > TAMANO_MAXIMO) { setError(t('demasiadoGrande')); continue }
      try {
        const extension = archivo.name.includes('.') ? archivo.name.split('.').pop() : 'jpg'
        const ruta = `${crypto.randomUUID()}.${extension}`
        const { error: errorSubida } = await sb.storage.from('fotos').upload(ruta, archivo)
        if (errorSubida) throw errorSubida
        const { data } = sb.storage.from('fotos').getPublicUrl(ruta)
        nuevas.push(data.publicUrl)
      } catch {
        setError(t('error'))
      }
    }
    if (nuevas.length) setUrls((prev) => [...prev, ...nuevas])
    setSubiendo(false)
  }

  function quitar(url: string) {
    setUrls((prev) => prev.filter((u) => u !== url))
    setError('')
  }

  return (
    <div className="mb-4">
      <label htmlFor={`${name}_archivo`} className="mb-1 block text-sm font-semibold">
        {label ?? t('subir')}
      </label>
      {urls.map((u) => <input key={u} type="hidden" name={name} value={u} />)}
      {urls.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {urls.map((u) => (
            <div key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
              <button
                type="button"
                onClick={() => quitar(u)}
                aria-label={t('quitar')}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold leading-none text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {urls.length < max && (
        <input
          id={`${name}_archivo`}
          type="file"
          accept="image/*"
          multiple
          onChange={alElegirArchivos}
          disabled={subiendo}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
        />
      )}
      {subiendo && <p className="mt-1 text-xs text-gray-500">{t('subiendo')}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
