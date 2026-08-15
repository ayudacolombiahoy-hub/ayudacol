'use client'
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { crearClienteNavegador } from '@/lib/supabase/navegador'

export default function Entrar() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(false)
    const sb = crearClienteNavegador()
    const redirectTo = `${window.location.origin}/auth/callback?next=/${locale}/panel`
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    if (error) setError(true)
    else setEnviado(true)
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-2 text-2xl font-extrabold">{t('entrar')}</h1>
      <p className="mb-6 text-sm text-gray-500">{t('soloEquipo')}</p>
      {enviado ? (
        <p className="rounded-lg bg-green-100 p-4 text-green-900">{t('revisaCorreo')}</p>
      ) : (
        <form onSubmit={enviar}>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold">{t('email')}</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          {error && <p className="mb-3 text-sm text-red-600">{t('errorAcceso')}</p>}
          <button type="submit" className="rounded-lg bg-blue-700 px-5 py-2.5 font-bold text-white">
            {t('enviarEnlace')}
          </button>
        </form>
      )}
    </main>
  )
}
