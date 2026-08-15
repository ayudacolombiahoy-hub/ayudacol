'use client'
import { useTranslations } from 'next-intl'

export default function BotonWhatsApp() {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP
  const t = useTranslations('whatsapp')
  if (!numero) return null
  const mensaje = encodeURIComponent(t('mensaje'))
  return (
    <a
      href={`https://wa.me/${numero}?text=${mensaje}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 font-bold text-white shadow-lg hover:brightness-95"
    >
      💬 <span>{t('ayuda')}</span>
    </a>
  )
}
