# Plan 4 — Mapa + Visualizador de Focos + Actualización en vivo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La pieza visual estrella: un **visualizador de focos** con el mapa real de Colombia (Vemaps) que pulsa por departamento afectado y, al hacer clic, muestra las cifras de esa región; un **mapa operativo MapLibre** con marcadores agrupados (clustering) de necesidades y acopios filtrables; y **actualización automática** de las cifras (indicador "en vivo").

**Architecture:** Agregación por departamento **en código** (función pura testeable) a partir de las vistas públicas. El visualizador es un SVG (paths de Vemaps generados a un módulo TS) con focos calibrados (coords del spec §7). El mapa usa **MapLibre GL + tiles de OpenStreetMap**, ubicando cada solicitud/acopio en el **centroide de su municipio** (las formas aún no capturan lat/lng exactas). "Tiempo real" se implementa como **auto-refresco por polling cada 30 s** con indicador en vivo — el push real vía Supabase Realtime queda para el Plan 5 (requiere un agregado público en la publicación de realtime; con RLS el anónimo no recibe cambios de la tabla base).

**Tech Stack:** Next.js 16 · MapLibre GL (`maplibre-gl`) · OpenStreetMap tiles · Supabase (vistas públicas) · next-intl · Vitest.

**Spec:** §6 (pantallas), §7 (visualizador de focos — coords ya calibradas), §8 (estadísticas), §9 (tiempo real). Mapa Vemaps: `recursos/vemaps/co-07.svg` (atribución "© Vemaps.com" obligatoria).
**Base:** Planes 1/2/3/3b en `main`. Existen: `src/lib/supabase/cliente.ts` (`crearClienteAnonimo`), `src/lib/datos/consultas.ts` (`listarNecesidades`, `listarAcopios`, `listarMunicipios`), `src/lib/formato.ts` (`tiempoRelativo`), i18n ES/EN, `src/i18n/navegacion.ts`.

**Roadmap:** …3b) Organizaciones ✓ · **4) Mapa + visualizador + en vivo** ← este · 5) Estadísticas + campañas + despliegue.

---

## Estructura de archivos

```
scripts/gen-colombia-paths.mjs           ← genera el módulo de paths desde co-07.svg
src/componentes/visualizador/
    colombia-paths.ts                     ← (generado) paths de los 33 deptos
    Visualizador.tsx                      ← SVG oscuro + focos + panel de región (client)
src/lib/geo/centroides.ts                 ← municipio_id → [lng,lat] (aprox) + capital de depto
src/lib/datos/agregados.ts               ← agregarPorDepartamento (pura) + resumen/contadores
src/componentes/mapa/MapaOperativo.tsx    ← MapLibre GL con clustering (client)
src/componentes/EnVivo.tsx                ← auto-refresco (router.refresh cada 30s) + indicador
src/app/[locale]/mapa/page.tsx            ← página del mapa operativo (filtros)
tests/unit/agregados.test.ts
```
Se modifican `src/messages/{es,en}.json` (claves `viz`, `mapa`), `src/app/[locale]/page.tsx` (montar visualizador + contadores + En vivo) y `src/componentes/Navegacion.tsx` (enlace "Mapa").

---

### Task 1: Agregación por departamento (pura, TDD)

**Files:**
- Create: `src/lib/datos/agregados.ts`, `tests/unit/agregados.test.ts`

- [ ] **Step 1: Test que falla** — `tests/unit/agregados.test.ts`

```ts
import { describe, test, expect } from 'vitest'
import { agregarPorDepartamento, contadoresDesdeResumen } from '../../src/lib/datos/agregados'

const muniADepto = new Map<string, string>([
  ['17001', 'Caldas'],
  ['66001', 'Risaralda'],
  ['27001', 'Chocó'],
])

describe('agregarPorDepartamento', () => {
  const solicitudes = [
    { municipio_id: '17001', estado: 'verificada', urgencia: 'alta' },
    { municipio_id: '17001', estado: 'sin_verificar', urgencia: 'media' },
    { municipio_id: '17001', estado: 'resuelta', urgencia: 'baja' },
    { municipio_id: '66001', estado: 'verificada', urgencia: 'alta' },
  ]
  const acopios = [{ municipio_id: '17001' }, { municipio_id: '27001' }]

  test('cuenta activas, urgentes, resueltas y acopios por departamento', () => {
    const r = agregarPorDepartamento(solicitudes, acopios, muniADepto)
    const caldas = r.find((d) => d.departamento === 'Caldas')!
    expect(caldas.activas).toBe(2) // verificada + sin_verificar (resuelta no cuenta activa)
    expect(caldas.urgentes).toBe(1)
    expect(caldas.resueltas).toBe(1)
    expect(caldas.acopios).toBe(1)
    const choco = r.find((d) => d.departamento === 'Chocó')!
    expect(choco.acopios).toBe(1)
    expect(choco.activas).toBe(0)
  })
})

describe('contadoresDesdeResumen', () => {
  test('suma los totales globales', () => {
    const resumen = [
      { departamento: 'Caldas', activas: 2, urgentes: 1, resueltas: 1, acopios: 1 },
      { departamento: 'Chocó', activas: 0, urgentes: 0, resueltas: 0, acopios: 1 },
    ]
    expect(contadoresDesdeResumen(resumen)).toEqual({ activas: 2, urgentes: 1, resueltas: 1, acopios: 2 })
  })
})
```

Run: `npm test -- tests/unit/agregados.test.ts` → FAIL.

- [ ] **Step 2: Implementar** — `src/lib/datos/agregados.ts`

```ts
import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { listarMunicipios } from './consultas'

export type ResumenDepto = {
  departamento: string
  activas: number
  urgentes: number
  resueltas: number
  acopios: number
}

const ACTIVAS = new Set(['sin_verificar', 'verificada', 'en_atencion', 'por_reconfirmar'])

export function agregarPorDepartamento(
  solicitudes: { municipio_id: string; estado: string; urgencia: string }[],
  acopios: { municipio_id: string }[],
  muniADepto: Map<string, string>,
): ResumenDepto[] {
  const mapa = new Map<string, ResumenDepto>()
  const asegura = (depto: string) => {
    if (!mapa.has(depto)) mapa.set(depto, { departamento: depto, activas: 0, urgentes: 0, resueltas: 0, acopios: 0 })
    return mapa.get(depto)!
  }
  for (const s of solicitudes) {
    const depto = muniADepto.get(s.municipio_id)
    if (!depto) continue
    const d = asegura(depto)
    if (s.estado === 'resuelta') d.resueltas++
    else if (ACTIVAS.has(s.estado)) {
      d.activas++
      if (s.urgencia === 'alta') d.urgentes++
    }
  }
  for (const a of acopios) {
    const depto = muniADepto.get(a.municipio_id)
    if (!depto) continue
    asegura(depto).acopios++
  }
  return [...mapa.values()].sort((x, y) => y.activas - x.activas)
}

export function contadoresDesdeResumen(resumen: ResumenDepto[]) {
  return resumen.reduce(
    (acc, d) => ({
      activas: acc.activas + d.activas,
      urgentes: acc.urgentes + d.urgentes,
      resueltas: acc.resueltas + d.resueltas,
      acopios: acc.acopios + d.acopios,
    }),
    { activas: 0, urgentes: 0, resueltas: 0, acopios: 0 },
  )
}

export async function resumenPorDepartamento(): Promise<ResumenDepto[]> {
  const sb = crearClienteAnonimo()
  const [{ data: sols }, { data: acos }, munis] = await Promise.all([
    sb.from('solicitudes_publicas').select('municipio_id, estado, urgencia').limit(5000),
    sb.from('centros_acopio').select('municipio_id').limit(5000),
    listarMunicipios(),
  ])
  const muniADepto = new Map(munis.map((m) => [m.codigo_dane, m.departamento]))
  return agregarPorDepartamento(sols ?? [], acos ?? [], muniADepto)
}
```

Run: `npm test -- tests/unit/agregados.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/datos/agregados.ts tests/unit/agregados.test.ts
git commit -m "feat: agregación de solicitudes/acopios por departamento (pura, TDD)"
```

---

### Task 2: Paths de Colombia (generados desde Vemaps)

**Files:**
- Create: `scripts/gen-colombia-paths.mjs`, `src/componentes/visualizador/colombia-paths.ts` (generado)

- [ ] **Step 1: Script generador** — `scripts/gen-colombia-paths.mjs`

```js
// Genera src/componentes/visualizador/colombia-paths.ts desde el SVG de Vemaps.
// Los índices afectados provienen de la calibración del spec §7:
// Chocó=2, Valle=13, Caldas=25, Quindío=31, Risaralda=33.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const svg = readFileSync('recursos/vemaps/co-07.svg', 'utf8')
const col = svg.match(/<g id="Colombia">([\s\S]*?)<\/g>/)
if (!col) { console.error('No se encontró <g id="Colombia">'); process.exit(1) }
const paths = [...col[1].matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
if (paths.length !== 34) { console.error(`Esperaba 34 paths, hay ${paths.length}`); process.exit(1) }

const AFECTADOS = new Set([2, 13, 25, 31, 33])
const filas = paths.map((d, i) => `  { d: ${JSON.stringify(d)}, afectado: ${AFECTADOS.has(i)} },`)
mkdirSync('src/componentes/visualizador', { recursive: true })
writeFileSync(
  'src/componentes/visualizador/colombia-paths.ts',
  `// Generado por scripts/gen-colombia-paths.mjs desde recursos/vemaps/co-07.svg (© Vemaps.com).\n` +
  `// No editar a mano; re-generar con: node scripts/gen-colombia-paths.mjs\n` +
  `export type PathDepto = { d: string; afectado: boolean }\n` +
  `export const PATHS_COLOMBIA: PathDepto[] = [\n${filas.join('\n')}\n]\n`,
)
console.log(`OK: ${paths.length} paths escritos`)
```

- [ ] **Step 2: Generar y verificar**

Run: `node scripts/gen-colombia-paths.mjs`
Expected: `OK: 34 paths escritos`. Confirmar: `grep -c "afectado: true" src/componentes/visualizador/colombia-paths.ts` → 5.

- [ ] **Step 3: `tsc`**

Run: `npx tsc --noEmit`
Expected: sin errores (el módulo generado es TS válido).

- [ ] **Step 4: Commit**

```bash
git add scripts/gen-colombia-paths.mjs src/componentes/visualizador/colombia-paths.ts
git commit -m "feat: paths de Colombia generados desde el mapa de Vemaps"
```

---

### Task 3: Componente Visualizador de focos

**Files:**
- Create: `src/componentes/visualizador/Visualizador.tsx`
- Modify: `src/messages/es.json`, `src/messages/en.json` (bloque `viz`)

- [ ] **Step 1: i18n** — añadir a `es.json`:

```json
"viz": {
  "enVivo": "Datos en vivo",
  "titulo": "Dónde se necesita ayuda",
  "activas": "necesidades activas",
  "urgentes": "Urgentes",
  "acopios": "Centros de acopio",
  "resueltas": "Resueltas",
  "elige": "Toca un foco para ver la región",
  "verDetalle": "Ver en el mapa",
  "mapaCredito": "Mapa"
}
```
y a `en.json`:
```json
"viz": {
  "enVivo": "Live data",
  "titulo": "Where help is needed",
  "activas": "active needs",
  "urgentes": "Urgent",
  "acopios": "Donation centers",
  "resueltas": "Resolved",
  "elige": "Tap a hotspot to see the region",
  "verDetalle": "View on the map",
  "mapaCredito": "Map"
}
```

- [ ] **Step 2: Componente** — `src/componentes/visualizador/Visualizador.tsx`

```tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navegacion'
import { PATHS_COLOMBIA } from './colombia-paths'
import type { ResumenDepto } from '@/lib/datos/agregados'

// Focos calibrados (spec §7), viewBox "245 30 400 555".
const FOCOS: { depto: string; x: number; y: number; critico: boolean; etiqueta: string }[] = [
  { depto: 'Chocó', x: 328.3, y: 271.9, critico: true, etiqueta: 'Chocó' },
  { depto: 'Caldas', x: 362.8, y: 290.5, critico: true, etiqueta: 'Manizales' },
  { depto: 'Risaralda', x: 357.6, y: 298.4, critico: false, etiqueta: 'Pereira' },
  { depto: 'Quindío', x: 357.9, y: 306.8, critico: false, etiqueta: 'Armenia' },
  { depto: 'Valle del Cauca', x: 332.2, y: 339.2, critico: false, etiqueta: 'Cali' },
]

const VACIO: ResumenDepto = { departamento: '', activas: 0, urgentes: 0, resueltas: 0, acopios: 0 }

export default function Visualizador({ resumen }: { resumen: ResumenDepto[] }) {
  const t = useTranslations('viz')
  const porDepto = new Map(resumen.map((r) => [r.departamento, r]))
  const [sel, setSel] = useState<string>('Caldas')
  const datos = porDepto.get(sel) ?? { ...VACIO, departamento: sel }

  return (
    <div className="flex flex-wrap overflow-hidden rounded-xl border border-slate-800 bg-[#020617]">
      <div className="relative min-w-[300px] flex-[1.2] p-2">
        <div className="absolute left-4 top-3 z-10">
          <div className="text-[10px] font-semibold text-green-400">● {t('enVivo')}</div>
        </div>
        <svg viewBox="245 30 400 555" className="block h-auto w-full">
          {PATHS_COLOMBIA.map((p, i) => (
            <path key={i} d={p.d}
              fill={p.afectado ? '#123a63' : '#0a2440'}
              stroke={p.afectado ? '#3b82c4' : '#1b4a73'} strokeWidth={p.afectado ? 0.9 : 0.6} />
          ))}
          {FOCOS.map((f) => {
            const activo = sel === f.depto
            const color = f.critico ? '#ef4444' : '#f59e0b'
            return (
              <g key={f.depto} onClick={() => setSel(f.depto)} className="cursor-pointer">
                <circle cx={f.x} cy={f.y} r={12} fill={color} opacity={0.25}>
                  <animate attributeName="r" from="6" to="20" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={f.x} cy={f.y} r={activo ? 8 : 6} fill={color} stroke="#020617" strokeWidth={1} />
                <text x={f.x + 9} y={f.y + 3} fontSize="9.5" fontWeight="700"
                  fill={f.critico ? '#fca5a5' : '#fcd34d'}>{f.etiqueta}</text>
              </g>
            )
          })}
        </svg>
        <div className="px-3 pb-1 text-right text-[9px] text-slate-500">{t('mapaCredito')}: © Vemaps.com</div>
      </div>
      <div className="min-w-[260px] flex-1 border-l border-slate-800 bg-[#0b1220] p-6 text-slate-200">
        <div className="text-lg font-bold text-sky-300">{datos.departamento}</div>
        <div className="mt-2 text-5xl font-extrabold tabular-nums">{datos.activas}</div>
        <div className="text-xs text-slate-400">{t('activas')}</div>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between border-b border-slate-800 pb-1"><dt>🔴 {t('urgentes')}</dt><dd className="font-bold text-red-400 tabular-nums">{datos.urgentes}</dd></div>
          <div className="flex justify-between border-b border-slate-800 pb-1"><dt>📦 {t('acopios')}</dt><dd className="font-bold text-green-400 tabular-nums">{datos.acopios}</dd></div>
          <div className="flex justify-between border-b border-slate-800 pb-1"><dt>✅ {t('resueltas')}</dt><dd className="font-bold text-lime-400 tabular-nums">{datos.resueltas}</dd></div>
        </dl>
        <Link href="/mapa" className="mt-5 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">{t('verDetalle')} →</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Paridad + tsc**

Run: `npm test -- tests/unit/mensajes-paridad.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/componentes/visualizador/Visualizador.tsx src/messages/es.json src/messages/en.json
git commit -m "feat: componente visualizador de focos (SVG Vemaps + datos por departamento)"
```

---

### Task 4: Centroides + Mapa operativo (MapLibre)

**Files:**
- Create: `src/lib/geo/centroides.ts`, `src/componentes/mapa/MapaOperativo.tsx`
- Modify: `package.json` (maplibre-gl)

- [ ] **Step 1: Instalar MapLibre**

Run: `npm install maplibre-gl`
Expected: 0 vulnerabilidades.

- [ ] **Step 2: Centroides** — `src/lib/geo/centroides.ts`

```ts
// Centroides aproximados [lng, lat] por municipio (los formularios aún no capturan
// coordenadas exactas; se ubica cada reporte en el centroide de su municipio).
export const CENTROIDES: Record<string, [number, number]> = {
  // Caldas
  '17001': [-75.52, 5.07], '17174': [-75.60, 4.98], '17873': [-75.51, 5.04],
  '17486': [-75.52, 5.17], '17524': [-75.62, 5.02], '17042': [-75.78, 5.24],
  // Risaralda
  '66001': [-75.69, 4.81], '66170': [-75.67, 4.83], '66682': [-75.62, 4.87],
  '66400': [-75.88, 4.90], '66440': [-75.74, 4.94],
  // Quindío
  '63001': [-75.68, 4.53], '63130': [-75.64, 4.53], '63470': [-75.75, 4.57],
  '63401': [-75.79, 4.45], '63190': [-75.64, 4.62], '63594': [-75.76, 4.62],
  '63690': [-75.57, 4.64], '63272': [-75.66, 4.68],
  // Valle del Cauca
  '76001': [-76.53, 3.44], '76892': [-76.50, 3.58], '76364': [-76.54, 3.26],
  '76520': [-76.30, 3.54], '76109': [-77.03, 3.88],
  // Chocó
  '27001': [-76.66, 5.69], '27361': [-76.68, 5.16], '27787': [-76.56, 5.26],
  '27205': [-76.65, 5.09], '27075': [-77.40, 6.22], '27050': [-76.63, 5.53],
}

export function coordenada(municipioId: string): [number, number] | null {
  return CENTROIDES[municipioId] ?? null
}
```

- [ ] **Step 3: Componente de mapa** — `src/componentes/mapa/MapaOperativo.tsx`

```tsx
'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export type Punto = {
  lng: number; lat: number
  tipo: 'necesidad' | 'acopio'
  titulo: string
  urgencia?: string
}

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

export default function MapaOperativo({ puntos }: { puntos: Punto[] }) {
  const cont = useRef<HTMLDivElement>(null)
  const mapa = useRef<maplibregl.Map | null>(null)

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
        properties: { tipo: p.tipo, titulo: p.titulo, urgencia: p.urgencia ?? '' },
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
        new maplibregl.Popup().setLngLat([g.coordinates[0], g.coordinates[1]])
          .setHTML(`<strong>${f.properties!.titulo}</strong>`).addTo(m!)
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
```

- [ ] **Step 4: `tsc`**

Run: `npx tsc --noEmit`
Expected: sin errores. (Si faltan tipos de GeoJSON, `maplibre-gl` los provee; no instalar @types extra.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/geo/centroides.ts src/componentes/mapa/MapaOperativo.tsx
git commit -m "feat: mapa operativo MapLibre con clustering + centroides por municipio"
```

---

### Task 5: Página del mapa + auto-refresco en vivo

**Files:**
- Create: `src/componentes/EnVivo.tsx`, `src/app/[locale]/mapa/page.tsx`
- Modify: `src/messages/es.json`, `src/messages/en.json` (bloque `mapa`), `src/componentes/Navegacion.tsx` (enlace)

- [ ] **Step 1: i18n** — añadir bloque `mapa` a `es.json`:

```json
"mapa": {
  "titulo": "Mapa de necesidades y acopios",
  "leyenda": "🔴 urgente · 🟠 media · 🟢 acopio",
  "sinCoords": "Algunos reportes sin ubicación exacta se ubican en el centro de su municipio."
}
```
y a `en.json`:
```json
"mapa": {
  "titulo": "Map of needs and donation centers",
  "leyenda": "🔴 urgent · 🟠 medium · 🟢 center",
  "sinCoords": "Some reports without exact location are placed at their municipality center."
}
```

- [ ] **Step 2: Auto-refresco** — `src/componentes/EnVivo.tsx`

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Refresca los datos del server component cada `segundos` sin recargar la página.
export default function EnVivo({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), segundos * 1000)
    return () => clearInterval(id)
  }, [router, segundos])
  return null
}
```

- [ ] **Step 3: Página del mapa** — `src/app/[locale]/mapa/page.tsx`

```tsx
export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarNecesidades, listarAcopios } from '@/lib/datos/consultas'
import { coordenada } from '@/lib/geo/centroides'
import MapaOperativo, { type Punto } from '@/componentes/mapa/MapaOperativo'
import EnVivo from '@/componentes/EnVivo'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('mapa')
  const [necesidades, acopios] = await Promise.all([listarNecesidades(), listarAcopios()])

  const puntos: Punto[] = []
  for (const n of necesidades) {
    const c = (n.lat != null && n.lng != null) ? [n.lng, n.lat] as [number, number] : coordenada(n.municipio_id)
    if (c) puntos.push({ lng: c[0], lat: c[1], tipo: 'necesidad', titulo: n.categoria, urgencia: n.urgencia })
  }
  for (const a of acopios) {
    const c = (a.lat != null && a.lng != null) ? [a.lng, a.lat] as [number, number] : coordenada(a.municipio_id)
    if (c) puntos.push({ lng: c[0], lat: c[1], tipo: 'acopio', titulo: a.nombre })
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <EnVivo />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t('titulo')}</h1>
        <span className="text-xs text-gray-500">{t('leyenda')}</span>
      </div>
      <MapaOperativo puntos={puntos} />
      <p className="mt-2 text-xs text-gray-500">{t('sinCoords')}</p>
    </main>
  )
}
```

- [ ] **Step 4: Enlace en nav** — en `src/componentes/Navegacion.tsx`, añadir al array `enlaces` una entrada al mapa (usa la clave `nav` — añade `"mapa": "Mapa"` a `nav` en ambos json si no existe; verifícalo). Insertar como primer elemento del array:
```tsx
    ['/mapa', t('mapa')],
```
Añadir a `es.json` en `nav`: `"mapa": "Mapa"`; a `en.json` en `nav`: `"mapa": "Map"`.

- [ ] **Step 5: Verificación**

Run: `npm test -- tests/unit/mensajes-paridad.test.ts && npx tsc --noEmit && npm run build`
Expected: paridad PASS; tipos ok; build exit 0 con la ruta `/[locale]/mapa`.

Smoke:
```bash
npm run dev > /tmp/p4dev.log 2>&1 &
sleep 9
curl -s -o /dev/null -w "mapa=%{http_code}\n" http://localhost:3000/es/mapa
pkill -f "next dev"; pkill -f "next-server"
```
Expected: `mapa=200`. (El mapa se renderiza en cliente; verificación visual manual.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/mapa" src/componentes/EnVivo.tsx src/messages/es.json src/messages/en.json src/componentes/Navegacion.tsx
git commit -m "feat: página del mapa operativo + auto-refresco en vivo + enlace en navegación"
```

---

### Task 6: Integración en la home + verificación final

**Files:**
- Modify: `src/app/[locale]/page.tsx` (montar visualizador + contadores + EnVivo)

- [ ] **Step 1: Home con visualizador** — reemplazar el contenido de `src/app/[locale]/page.tsx` por:

```tsx
export const dynamic = 'force-dynamic'

import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navegacion'
import { resumenPorDepartamento, contadoresDesdeResumen } from '@/lib/datos/agregados'
import Visualizador from '@/componentes/visualizador/Visualizador'
import EnVivo from '@/componentes/EnVivo'

export default async function Inicio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('inicio')
  const tv = await getTranslations('viz')
  const resumen = await resumenPorDepartamento()
  const total = contadoresDesdeResumen(resumen)

  return (
    <main className="mx-auto max-w-5xl p-6">
      <EnVivo />
      <h1 className="text-3xl font-extrabold">{t('titulo')}</h1>
      <p className="mt-2 text-lg text-gray-600">{t('subtitulo')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/reportar/necesidad" className="rounded-lg bg-red-100 px-4 py-2 font-bold text-red-900">🆘 {t('pedirAyuda')}</Link>
        <Link href="/reportar/voluntario" className="rounded-lg bg-green-100 px-4 py-2 font-bold text-green-900">🤝 {t('quieroAyudar')}</Link>
        <Link href="/necesidades" className="rounded-lg bg-blue-100 px-4 py-2 font-bold text-blue-900">🗺️ {t('donarDesdeEEUU')}</Link>
      </div>
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase text-gray-500">{tv('titulo')}</h2>
        <Visualizador resumen={resumen} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Contador n={total.activas} etiqueta={tv('activas')} />
          <Contador n={total.urgentes} etiqueta={tv('urgentes')} color="text-red-600" />
          <Contador n={total.acopios} etiqueta={tv('acopios')} color="text-green-600" />
          <Contador n={total.resueltas} etiqueta={tv('resueltas')} color="text-lime-600" />
        </div>
      </div>
    </main>
  )
}

function Contador({ n, etiqueta, color = 'text-gray-900' }: { n: number; etiqueta: string; color?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
      <div className={`text-3xl font-extrabold tabular-nums ${color}`}>{n}</div>
      <div className="text-xs text-gray-500">{etiqueta}</div>
    </div>
  )
}
```

- [ ] **Step 2: Verificación final**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: todos los tests PASS (incluye agregados); tipos ok; build exit 0 con `/[locale]` y `/[locale]/mapa`.

- [ ] **Step 3: Smoke test**

```bash
npm run dev > /tmp/p4dev.log 2>&1 &
sleep 9
curl -s -o /dev/null -w "home=%{http_code} mapa=%{http_code}\n" http://localhost:3000/es
curl -s http://localhost:3000/es | grep -o "Vemaps" | head -1
pkill -f "next dev"; pkill -f "next-server"
```
Expected: home 200; el grep encuentra "Vemaps" (visualizador montado con atribución). Sin procesos next colgados.

- [ ] **Step 4: Commit + tag**

```bash
git add "src/app/[locale]/page.tsx"
git commit -m "feat: home con visualizador de focos y contadores en vivo"
git tag mapa-visualizador-v1
```

---

## Notas para el ejecutor

- **Tiempo real = auto-refresco por polling (30 s)** con indicador "● en vivo". El push real vía Supabase Realtime es Plan 5 (con RLS, el anónimo no recibe `postgres_changes` de la tabla base; requiere un agregado público en la publicación de realtime o canal broadcast).
- **Coordenadas:** las formas públicas aún no capturan lat/lng; cada punto se ubica en el **centroide de su municipio** (`CENTROIDES`). Municipios sin centroide se omiten del mapa (se puede ampliar `CENTROIDES`). Un selector de ubicación en el mapa para el formulario es una mejora futura.
- **Tiles OSM:** para MVP/demo está bien con atribución; en producción (Plan 5, alto tráfico) conviene un proveedor con API key (MapTiler/Stadia) por la política de uso de OSM.
- **Atribución Vemaps** ("© Vemaps.com") va visible en el visualizador (requisito de licencia); no quitarla.
- **La home pasa a dinámica** (ya lo era desde el Plan 3b por la nav). El visualizador y el mapa son client components; la data se carga en el server component y se refresca por `router.refresh()`.
- **Verificación visual:** el mapa MapLibre y el visualizador se renderizan en el navegador; el build + smoke confirman que compilan y responden 200, pero conviene una mirada manual (`npm run dev` → `/es` y `/es/mapa`).

## Self-review (hecho)
- **Cobertura del spec (§6/§7/§8/§9):** visualizador de focos con mapa real Vemaps + datos por departamento ✓ (§7, coords calibradas); mapa operativo con clustering y colores por urgencia ✓ (§6); contadores globales en vivo ✓ (§8, indicador + polling); auto-actualización ✓ (§9, con nota de que el push es Plan 5). Filtros del mapa: el mapa muestra todo; filtros por ciudad/categoría en el mapa quedan como mejora (las listas del Plan 2 ya filtran) — anotado.
- **Consistencia de tipos:** `ResumenDepto` de `agregados.ts` consumido por `Visualizador` y la home; `Punto` de `MapaOperativo` construido en `mapa/page.tsx` con `coordenada()` de `centroides.ts`; `PATHS_COLOMBIA` del módulo generado; `EnVivo` reutilizado en home y mapa. Claves i18n `viz`/`mapa`/`nav.mapa` añadidas en ambos idiomas.
- **Sin placeholders:** cada paso trae código completo (el único archivo "generado" tiene su script generador y verificación de conteo).
