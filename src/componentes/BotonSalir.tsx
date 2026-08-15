'use client'
import { useRouter } from '@/i18n/navegacion'
import { useTranslations } from 'next-intl'
import { crearClienteNavegador } from '@/lib/supabase/navegador'

export default function BotonSalir() {
  const t = useTranslations('auth')
  const router = useRouter()
  async function salir() {
    await crearClienteNavegador().auth.signOut()
    router.replace('/entrar')
    router.refresh()
  }
  return (
    <button onClick={salir} className="rounded border px-3 py-1 text-sm font-semibold">
      {t('salir')}
    </button>
  )
}
