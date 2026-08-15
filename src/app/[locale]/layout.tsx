import type { Metadata } from 'next'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import Navegacion from '@/componentes/Navegacion'
import BotonWhatsApp from '@/componentes/BotonWhatsApp'
import '../globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'inicio' })
  const titulo = `AyudaCol — ${t('titulo')}`
  const descripcion = t('subtitulo')
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: titulo, template: '%s · AyudaCol' },
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      url: `/${locale}`,
      siteName: 'AyudaCol',
      images: [{ url: '/og.png', width: 1200, height: 1200 }],
      locale: locale === 'es' ? 'es_CO' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descripcion,
      images: ['/og.png'],
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Navegacion />
          {children}
          <BotonWhatsApp />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
