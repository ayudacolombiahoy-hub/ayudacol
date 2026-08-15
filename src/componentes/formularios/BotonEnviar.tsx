'use client'
import { useFormStatus } from 'react-dom'

export default function BotonEnviar({ texto, textoEnviando }: { texto: string; textoEnviando: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-blue-700 px-5 py-2.5 font-bold text-white disabled:opacity-60"
    >
      {pending ? textoEnviando : texto}
    </button>
  )
}
