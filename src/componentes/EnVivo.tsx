'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Refresca los datos del server component cada `segundos` sin recargar la página.
export default function EnVivo({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), segundos * 1000)
    return () => clearInterval(id)
  }, [router, segundos])
  return null
}
