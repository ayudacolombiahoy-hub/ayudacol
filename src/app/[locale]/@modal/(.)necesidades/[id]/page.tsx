export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerNecesidad, nombreMunicipio } from '@/lib/datos/consultas'
import Modal from '@/componentes/detalle/Modal'
import DetalleNecesidad from '@/componentes/detalle/DetalleNecesidad'

export default async function ModalNecesidad({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerNecesidad(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <Modal etiquetaCerrar={td('cerrarModal')}>
      <DetalleNecesidad item={item} municipio={municipio} />
    </Modal>
  )
}
