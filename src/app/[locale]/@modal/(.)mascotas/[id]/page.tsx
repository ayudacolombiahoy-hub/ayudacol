export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerMascota } from '@/lib/datos/mascotas'
import { nombreMunicipio } from '@/lib/datos/consultas'
import Modal from '@/componentes/detalle/Modal'
import DetalleMascota from '@/componentes/detalle/DetalleMascota'

export default async function ModalMascota({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerMascota(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <Modal etiquetaCerrar={td('cerrarModal')}>
      <DetalleMascota item={item} municipio={municipio} />
    </Modal>
  )
}
