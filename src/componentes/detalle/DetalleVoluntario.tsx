import { useTranslations } from 'next-intl'

type Voluntario = { id: string; habilidades: string[] | null; disponibilidad: string | null; municipio_id: string }

export default function DetalleVoluntario({ item, municipio }: { item: Voluntario; municipio?: string }) {
  const t = useTranslations()
  const habilidades = (item.habilidades ?? []).map((h) => t(`habilidades.${h}`)).join(', ')
  return (
    <div className="p-5 sm:p-6">
      <h1 className="mb-2 pr-8 text-xl font-bold">🛠️ {habilidades}</h1>
      {item.disponibilidad && <p className="text-gray-800">{item.disponibilidad}</p>}
      <p className="mt-3 text-sm text-gray-500">📍 {municipio ?? item.municipio_id}</p>
    </div>
  )
}
