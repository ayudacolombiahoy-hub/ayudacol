export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerNecesidad, nombreMunicipio } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import DetalleNecesidad from '@/componentes/detalle/DetalleNecesidad'
import { metadatosDe } from '@/componentes/detalle/metadatos'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  const item = await obtenerNecesidad(id)
  return metadatosDe(item)
}

export default async function Pagina({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerNecesidad(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/necesidades" className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:underline">{td('volver')}</Link>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DetalleNecesidad item={item} municipio={municipio} />
      </div>
    </main>
  )
}
