import { useTranslations } from 'next-intl'

type Servicio = { id: string; tipo: string; descripcion: string; capacidad: number | null; municipio_id: string }

export default function DetalleServicio({ item, municipio }: { item: Servicio; municipio?: string }) {
  const t = useTranslations()
  return (
    <div className="p-5 sm:p-6">
      <h1 className="mb-2 pr-8 text-xl font-bold">{t(`tiposServicio.${item.tipo}`)}</h1>
      <p className="whitespace-pre-line text-gray-800">{item.descripcion}</p>
      <p className="mt-3 text-sm text-gray-500">📍 {municipio ?? item.municipio_id}{item.capacidad ? ` · ${item.capacidad}` : ''}</p>
    </div>
  )
}
