import { useTranslations } from 'next-intl'

type Voluntario = {
  id: string; habilidades: string[] | null; disponibilidad: string | null; municipio_id: string
  contacto_telefono?: string | null; foto_url?: string | null
}

export default function DetalleVoluntario({ item, municipio }: { item: Voluntario; municipio?: string }) {
  const t = useTranslations()
  const habilidades = (item.habilidades ?? []).map((h) => t(`habilidades.${h}`)).join(', ')
  const tel = item.contacto_telefono ?? ''
  return (
    <div className="p-5 sm:p-6">
      {item.foto_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.foto_url} alt="" className="mb-3 h-44 w-full rounded-lg object-cover" />
      )}
      <h1 className="mb-2 pr-8 text-xl font-bold">🛠️ {habilidades}</h1>
      {item.disponibilidad && <p className="text-gray-800">{item.disponibilidad}</p>}
      <p className="mt-3 text-sm text-gray-500">📍 {municipio ?? item.municipio_id}</p>
      {tel && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <a href={`https://wa.me/${tel.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-white hover:brightness-95">
            💬 {t('mascotas.whatsapp')}
          </a>
          <a href={`tel:${tel}`}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            📞 {t('mascotas.llamar')}
          </a>
        </div>
      )}
    </div>
  )
}
