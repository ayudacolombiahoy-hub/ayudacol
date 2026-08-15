export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerAcopio, nombreMunicipio } from '@/lib/datos/consultas'
import Modal from '@/componentes/detalle/Modal'
import DetalleAcopio from '@/componentes/detalle/DetalleAcopio'

export default async function ModalAcopio({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerAcopio(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <Modal etiquetaCerrar={td('cerrarModal')}>
      <DetalleAcopio item={item} municipio={municipio} />
    </Modal>
  )
}
