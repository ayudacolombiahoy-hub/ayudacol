'use client'
import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from '@/i18n/navegacion'

// Overlay accesible que envuelve el contenido del detalle. Cierra con Esc, clic en el
// fondo o el botón ✕, todos vía router.back() para que la URL vuelva al listado y el
// slot @modal caiga en default.tsx (null).
export default function Modal({ children, etiquetaCerrar, titulo }: { children: React.ReactNode; etiquetaCerrar: string; titulo?: string }) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  // Evita que Esc + clic en el fondo (u otro doble disparo) hagan router.back() dos
  // veces, lo que saltaría de más en el historial.
  const cerrando = useRef(false)
  const cerrar = useCallback(() => {
    if (cerrando.current) return
    cerrando.current = true
    router.back()
  }, [router])

  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = previo
      document.removeEventListener('keydown', alTeclear)
    }
  }, [cerrar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-6"
      onClick={cerrar}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo ?? etiquetaCerrar}
        className="relative my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={cerrar}
          aria-label={etiquetaCerrar}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 hover:bg-gray-200"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
