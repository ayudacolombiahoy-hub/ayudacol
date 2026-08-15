export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerAlbergue } from '@/lib/datos/albergues'
import { nombreMunicipio } from '@/lib/datos/consultas'
import Modal from '@/componentes/detalle/Modal'
import DetalleAlbergue from '@/componentes/detalle/DetalleAlbergue'

export default async function ModalAlbergue({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerAlbergue(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <Modal etiquetaCerrar={td('cerrarModal')}>
      <DetalleAlbergue item={item} municipio={municipio} />
    </Modal>
  )
}
