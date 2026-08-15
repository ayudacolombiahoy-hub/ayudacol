'use client'
import { useState } from 'react'

// Muestra la foto SIN recortar (object-contain) y permite ampliarla a pantalla
// completa. Con varias fotos (necesidades) añade navegación anterior/siguiente.
export default function VisorFoto({
  fotos, alt, etiquetaAnterior, etiquetaSiguiente, etiquetaAmpliar, etiquetaCerrar,
}: {
  fotos: string[]
  alt: string
  etiquetaAnterior: string
  etiquetaSiguiente: string
  etiquetaAmpliar: string
  etiquetaCerrar: string
}) {
  const [i, setI] = useState(0)
  const [ampliada, setAmpliada] = useState(false)
  if (!fotos.length) return null
  const hayVarias = fotos.length > 1
  const anterior = () => setI((p) => (p - 1 + fotos.length) % fotos.length)
  const siguiente = () => setI((p) => (p + 1) % fotos.length)

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fotos[i]}
        alt={alt}
        title={etiquetaAmpliar}
        onClick={() => setAmpliada(true)}
        className="max-h-[60vh] w-full cursor-zoom-in rounded-lg bg-gray-50 object-contain"
      />
      {hayVarias && (
        <>
          <button onClick={anterior} aria-label={etiquetaAnterior} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-1 text-white hover:bg-black/70">‹</button>
          <button onClick={siguiente} aria-label={etiquetaSiguiente} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-1 text-white hover:bg-black/70">›</button>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">{i + 1}/{fotos.length}</span>
        </>
      )}
      {ampliada && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setAmpliada(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotos[i]} alt={alt} className="max-h-full max-w-full object-contain" />
          <button onClick={() => setAmpliada(false)} aria-label={etiquetaCerrar} className="absolute right-4 top-4 text-3xl leading-none text-white">✕</button>
        </div>
      )}
    </div>
  )
}
