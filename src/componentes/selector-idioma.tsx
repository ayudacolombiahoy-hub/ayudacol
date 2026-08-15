'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navegacion'

export default function SelectorIdioma() {
  const t = useTranslations('comun')
  const pathname = usePathname()
  const locale = useLocale()
  const otro = locale === 'es' ? 'en' : 'es'
  return (
    <Link
      href={pathname}
      locale={otro}
      className="rounded border px-3 py-1 text-sm font-semibold"
    >
      {t('cambiarIdioma')}
    </Link>
  )
}
