export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarNecesidades, listarAcopios, listarMunicipios } from '@/lib/datos/consultas'
import { coordenada } from '@/lib/geo/centroides'
import { enlacesMaps } from '@/lib/geo/maps'
import MapaOperativo, { type Punto } from '@/componentes/mapa/MapaOperativo'
import EnVivo from '@/componentes/EnVivo'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('mapa')
  const tMaps = await getTranslations('maps')
  const [necesidades, acopios, municipios] = await Promise.all([
    listarNecesidades(), listarAcopios(), listarMunicipios(),
  ])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))

  const puntos: Punto[] = []
  for (const n of necesidades) {
    const c = (n.lat != null && n.lng != null) ? [n.lng, n.lat] as [number, number] : coordenada(n.municipio_id)
    if (c) puntos.push({ lng: c[0], lat: c[1], tipo: 'necesidad', titulo: n.categoria, urgencia: n.urgencia })
  }
  for (const a of acopios) {
    const c = (a.lat != null && a.lng != null) ? [a.lng, a.lat] as [number, number] : coordenada(a.municipio_id)
    if (!c) continue
    const l = enlacesMaps({
      direccion: a.direccion,
      municipioTexto: mapaMuni.get(a.municipio_id),
      lat: a.lat,
      lng: a.lng,
    })
    puntos.push({ lng: c[0], lat: c[1], tipo: 'acopio', titulo: a.nombre, mapsVer: l.ver, mapsDir: l.comoLlegar })
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <EnVivo />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t('titulo')}</h1>
        <span className="text-xs text-gray-500">{t('leyenda')}</span>
      </div>
      <MapaOperativo puntos={puntos} etiquetas={{ ver: tMaps('verUbicacion'), comoLlegar: tMaps('comoLlegar') }} />
      <p className="mt-2 text-xs text-gray-500">{t('sinCoords')}</p>
    </main>
  )
}
