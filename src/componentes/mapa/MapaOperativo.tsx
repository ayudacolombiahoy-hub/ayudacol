'use client'
import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export type Punto = {
  lng: number; lat: number
  tipo: 'necesidad' | 'acopio'
  titulo: string
  urgencia?: string
  mapsVer?: string
  mapsDir?: string
}

export type EtiquetasMaps = { ver: string; comoLlegar: string }

const ESTILO = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
}

export default function MapaOperativo({
  puntos,
  etiquetas = { ver: 'Ver ubicación', comoLlegar: 'Cómo llegar' },
}: { puntos: Punto[]; etiquetas?: EtiquetasMaps }) {
  const cont = useRef<HTMLDivElement>(null)
  const mapa = useRef<maplibregl.Map | null>(null)
  const etiq = useRef(etiquetas)
  useEffect(() => { etiq.current = etiquetas }, [etiquetas])

  useEffect(() => {
    if (!cont.current || mapa.current) return
    const m = new maplibregl.Map({
      container: cont.current,
      style: ESTILO,
      center: [-75.7, 4.8],
      zoom: 7,
    })
    m.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapa.current = m
    return () => { m.remove(); mapa.current = null }
  }, [])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const geojson = {
      type: 'FeatureCollection' as const,
      features: puntos.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {
          tipo: p.tipo, titulo: p.titulo, urgencia: p.urgencia ?? '',
          mapsVer: p.mapsVer ?? '', mapsDir: p.mapsDir ?? '',
        },
      })),
    }
    function pintar() {
      if (m!.getSource('puntos')) { (m!.getSource('puntos') as maplibregl.GeoJSONSource).setData(geojson); return }
      m!.addSource('puntos', { type: 'geojson', data: geojson, cluster: true, clusterRadius: 45 })
      m!.addLayer({ id: 'clusters', type: 'circle', source: 'puntos', filter: ['has', 'point_count'],
        paint: { 'circle-color': '#1d4ed8', 'circle-radius': ['step', ['get', 'point_count'], 15, 10, 22, 50, 30], 'circle-opacity': 0.85 } })
      m!.addLayer({ id: 'clusters-count', type: 'symbol', source: 'puntos', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 }, paint: { 'text-color': '#fff' } })
      m!.addLayer({ id: 'punto', type: 'circle', source: 'puntos', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 7,
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff',
          'circle-color': ['case',
            ['==', ['get', 'tipo'], 'acopio'], '#16a34a',
            ['==', ['get', 'urgencia'], 'alta'], '#dc2626',
            ['==', ['get', 'urgencia'], 'media'], '#f59e0b', '#64748b'],
        } })
      m!.on('click', 'punto', (e) => {
        const f = e.features?.[0]; if (!f) return
        const g = f.geometry as GeoJSON.Point
        const pr = f.properties!
        let html = `<strong>${pr.titulo}</strong>`
        if (pr.mapsVer) {
          html += `<div style="margin-top:6px;display:flex;gap:10px;font-size:12px">` +
            `<a href="${pr.mapsVer}" target="_blank" rel="noopener noreferrer">📍 ${etiq.current.ver}</a>` +
            `<a href="${pr.mapsDir}" target="_blank" rel="noopener noreferrer">🧭 ${etiq.current.comoLlegar}</a>` +
            `</div>`
        }
        new maplibregl.Popup().setLngLat([g.coordinates[0], g.coordinates[1]])
          .setHTML(html).addTo(m!)
      })
      m!.on('click', 'clusters', (e) => {
        const f = m!.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
        const src = m!.getSource('puntos') as maplibregl.GeoJSONSource
        src.getClusterExpansionZoom(f.properties!.cluster_id as number).then((z) => {
          const g = f.geometry as GeoJSON.Point
          m!.easeTo({ center: [g.coordinates[0], g.coordinates[1]], zoom: z })
        })
      })
    }
    if (m.isStyleLoaded()) pintar(); else m.once('load', pintar)
  }, [puntos])

  return <div ref={cont} className="h-[70vh] w-full rounded-lg" />
}
