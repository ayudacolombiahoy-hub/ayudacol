import { Link } from '@/i18n/navegacion'

type Servicio = { id: string; tipo: string; descripcion: string; capacidad: number | null; municipio_id: string }

export default function TarjetaServicio({ s, tipoTexto, municipioTexto }: { s: Servicio; tipoTexto: string; municipioTexto?: string }) {
  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/servicios/${s.id}`} aria-label={tipoTexto} className="absolute inset-0 z-[1] rounded-lg" />
      <p className="font-semibold">{tipoTexto}</p>
      <p className="text-sm text-gray-700">{s.descripcion}</p>
      <p className="mt-1 text-xs text-gray-500">📍 {municipioTexto ?? s.municipio_id}{s.capacidad ? ` · ${s.capacidad}` : ''}</p>
    </article>
  )
}
