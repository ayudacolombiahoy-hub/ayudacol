'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { crearClienteNavegador } from '@/lib/supabase/navegador'

const TAMANO_MAXIMO = 5 * 1024 * 1024 // 5MB

// Sube una imagen al bucket público "fotos" y deja la URL pública en un input
// oculto (name) para que viaje con el resto del formulario. La foto es opcional:
// si la subida falla, se muestra un error pero no bloquea el envío del formulario.
export default function SubirFoto({ name, label }: { name: string; label?: string }) {
  const t = useTranslations('foto')
  const [url, setUrl] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  async function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite re-elegir el mismo archivo tras quitarlo
    if (!archivo) return
    setError('')
    if (archivo.size > TAMANO_MAXIMO) {
      setError(t('demasiadoGrande'))
      return
    }
    setSubiendo(true)
    try {
      const extension = archivo.name.includes('.') ? archivo.name.split('.').pop() : 'jpg'
      const ruta = `${crypto.randomUUID()}.${extension}`
      const sb = crearClienteNavegador()
      const { error: errorSubida } = await sb.storage.from('fotos').upload(ruta, archivo)
      if (errorSubida) throw errorSubida
      const { data } = sb.storage.from('fotos').getPublicUrl(ruta)
      setUrl(data.publicUrl)
    } catch {
      setError(t('error'))
    } finally {
      setSubiendo(false)
    }
  }

  function quitar() {
    setUrl('')
    setError('')
  }

  return (
    <div className="mb-4">
      <label htmlFor={`${name}_archivo`} className="mb-1 block text-sm font-semibold">
        {label ?? t('subir')}
      </label>
      <input type="hidden" name={name} value={url} />
      {url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
          <button type="button" onClick={quitar} className="text-xs font-semibold text-red-600 underline">
            {t('quitar')}
          </button>
        </div>
      ) : (
        <input
          id={`${name}_archivo`}
          type="file"
          accept="image/*"
          onChange={alElegirArchivo}
          disabled={subiendo}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
        />
      )}
      {subiendo && <p className="mt-1 text-xs text-gray-500">{t('subiendo')}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
