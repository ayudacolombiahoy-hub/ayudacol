# Botones de Google Maps en acopios y albergues — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir botones "Ver ubicación" y "Cómo llegar" (Google Maps) en las tarjetas de centros de acopio, de albergues, y en el popup de acopios del mapa operativo.

**Architecture:** Un helper puro (`enlacesMaps`) construye dos URLs de Google Maps a partir del texto de la dirección (o de `lat/lng` si existieran), sin API key. Un componente presentacional (`BotonesMaps`) las renderiza como dos `<a>`. Las páginas de lista (server components) lo insertan en cada tarjeta; el mapa precalcula las URLs en el servidor y el popup las pinta.

**Tech Stack:** Next.js 16 (App Router, server components), next-intl v4, MapLibre GL, Vitest, Tailwind.

---

## File Structure

**Nuevos**
- `src/lib/geo/maps.ts` — helper puro `enlacesMaps()`. Única responsabilidad: dado una dirección/coordenadas, devolver las dos URLs de Google Maps.
- `src/componentes/BotonesMaps.tsx` — componente presentacional (dos anclas). Sin estado.
- `tests/unit/maps.test.ts` — pruebas del helper.

**Modificados**
- `src/app/[locale]/acopios/page.tsx` — inserta `<BotonesMaps>` en cada tarjeta.
- `src/app/[locale]/albergues/page.tsx` — inserta `<BotonesMaps>` en cada tarjeta.
- `src/app/[locale]/mapa/page.tsx` — precalcula URLs para puntos `acopio`.
- `src/componentes/mapa/MapaOperativo.tsx` — el popup pinta los enlaces.
- `src/messages/es.json`, `src/messages/en.json` — namespace `maps`.

---

## Task 1: Helper `enlacesMaps` (TDD)

**Files:**
- Create: `src/lib/geo/maps.ts`
- Test: `tests/unit/maps.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/maps.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { enlacesMaps } from '../../src/lib/geo/maps'

const q = (url: string) => decodeURIComponent(url.split('query=')[1] ?? url.split('destination=')[1])

describe('enlacesMaps', () => {
  test('usa lat,lng cuando ambos son finitos', () => {
    const { ver, comoLlegar } = enlacesMaps({ direccion: 'Calle 1', lat: 6.1, lng: -75.9 })
    expect(ver).toBe('https://www.google.com/maps/search/?api=1&query=6.1%2C-75.9')
    expect(comoLlegar).toBe('https://www.google.com/maps/dir/?api=1&destination=6.1%2C-75.9')
  })

  test('cae a dirección + municipio + Colombia sin coordenadas', () => {
    const { ver } = enlacesMaps({ direccion: 'Cra 50 #10-20', municipioTexto: 'Salgar — Antioquia' })
    expect(q(ver)).toBe('Cra 50 #10-20, Salgar — Antioquia, Colombia')
  })

  test('omite municipio vacío sin dejar comas colgando', () => {
    const { ver } = enlacesMaps({ direccion: 'Cra 50' })
    expect(q(ver)).toBe('Cra 50, Colombia')
  })

  test('ignora lat/lng no finitos y usa la dirección', () => {
    const { ver } = enlacesMaps({ direccion: 'Cra 50', lat: NaN, lng: -75 })
    expect(q(ver)).toBe('Cra 50, Colombia')
  })

  test('genera los dos endpoints con ?api=1', () => {
    const { ver, comoLlegar } = enlacesMaps({ direccion: 'X' })
    expect(ver.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true)
    expect(comoLlegar.startsWith('https://www.google.com/maps/dir/?api=1&destination=')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/maps.test.ts`
Expected: FAIL — no puede resolver `../../src/lib/geo/maps`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/geo/maps.ts`:

```ts
export type EntradaMaps = {
  direccion: string
  municipioTexto?: string
  lat?: number | null
  lng?: number | null
}

export type EnlacesMaps = { ver: string; comoLlegar: string }

function consulta(e: EntradaMaps): string {
  if (
    typeof e.lat === 'number' && Number.isFinite(e.lat) &&
    typeof e.lng === 'number' && Number.isFinite(e.lng)
  ) {
    return `${e.lat},${e.lng}`
  }
  return [e.direccion, e.municipioTexto, 'Colombia']
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

// Construye enlaces de Google Maps (formato documentado ?api=1), sin API key.
// "ver" centra el pin sobre la dirección; "comoLlegar" abre la ruta hacia ella.
export function enlacesMaps(e: EntradaMaps): EnlacesMaps {
  const query = encodeURIComponent(consulta(e))
  return {
    ver: `https://www.google.com/maps/search/?api=1&query=${query}`,
    comoLlegar: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/maps.test.ts`
Expected: PASS (5 pruebas).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo/maps.ts tests/unit/maps.test.ts
git commit -m "feat: helper enlacesMaps para URLs de Google Maps"
```

---

## Task 2: Claves i18n `maps`

**Files:**
- Modify: `src/messages/es.json`
- Modify: `src/messages/en.json`

- [ ] **Step 1: Añadir namespace `maps` en español**

En `src/messages/es.json`, reemplazar el final del archivo:

```json
    "enVivo": "Datos en vivo"
  }
}
```

por:

```json
    "enVivo": "Datos en vivo"
  },
  "maps": {
    "verUbicacion": "Ver ubicación",
    "comoLlegar": "Cómo llegar"
  }
}
```

- [ ] **Step 2: Añadir namespace `maps` en inglés**

En `src/messages/en.json`, reemplazar el final del archivo:

```json
    "enVivo": "Live data"
  }
}
```

por:

```json
    "enVivo": "Live data"
  },
  "maps": {
    "verUbicacion": "View location",
    "comoLlegar": "Get directions"
  }
}
```

- [ ] **Step 3: Verificar que ambos JSON son válidos**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/messages/es.json','utf8'));JSON.parse(require('fs').readFileSync('src/messages/en.json','utf8'));console.log('JSON OK')"`
Expected: `JSON OK`

- [ ] **Step 4: Commit**

```bash
git add src/messages/es.json src/messages/en.json
git commit -m "feat: claves i18n maps.verUbicacion / maps.comoLlegar"
```

---

## Task 3: Componente `BotonesMaps`

**Files:**
- Create: `src/componentes/BotonesMaps.tsx`

- [ ] **Step 1: Crear el componente**

Create `src/componentes/BotonesMaps.tsx`:

```tsx
import { enlacesMaps } from '@/lib/geo/maps'

// Dos enlaces a Google Maps para una dirección. Es un server component
// (solo anclas), por eso recibe los textos ya traducidos por props.
export default function BotonesMaps({
  direccion,
  municipioTexto,
  lat,
  lng,
  textoVer,
  textoComoLlegar,
}: {
  direccion: string
  municipioTexto?: string
  lat?: number | null
  lng?: number | null
  textoVer: string
  textoComoLlegar: string
}) {
  if (!direccion?.trim()) return null
  const { ver, comoLlegar } = enlacesMaps({ direccion, municipioTexto, lat, lng })
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        href={ver}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        📍 {textoVer}
      </a>
      <a
        href={comoLlegar}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
      >
        🧭 {textoComoLlegar}
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados con `BotonesMaps`.

- [ ] **Step 3: Commit**

```bash
git add src/componentes/BotonesMaps.tsx
git commit -m "feat: componente BotonesMaps"
```

---

## Task 4: Integrar en la lista de acopios

**Files:**
- Modify: `src/app/[locale]/acopios/page.tsx`

- [ ] **Step 1: Importar el componente**

Añadir, junto a los otros imports de componentes en la cabecera del archivo:

```tsx
import BotonesMaps from '@/componentes/BotonesMaps'
```

- [ ] **Step 2: Cargar las traducciones `maps`**

Debajo de la línea `const tRoot = await getTranslations()`, añadir:

```tsx
const tMaps = await getTranslations('maps')
```

- [ ] **Step 3: Insertar los botones en cada tarjeta**

Reemplazar este bloque:

```tsx
              {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('noNecesita')}:</b> {a.no_necesita.join(', ')}</p>}
            </article>
```

por:

```tsx
              {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('noNecesita')}:</b> {a.no_necesita.join(', ')}</p>}
              <BotonesMaps
                direccion={a.direccion}
                municipioTexto={mapaMuni.get(a.municipio_id)}
                lat={a.lat}
                lng={a.lng}
                textoVer={tMaps('verUbicacion')}
                textoComoLlegar={tMaps('comoLlegar')}
              />
            </article>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/acopios/page.tsx
git commit -m "feat: botones de Maps en la lista de acopios"
```

---

## Task 5: Integrar en la lista de albergues

**Files:**
- Modify: `src/app/[locale]/albergues/page.tsx`

- [ ] **Step 1: Importar el componente**

Añadir junto a los imports de componentes:

```tsx
import BotonesMaps from '@/componentes/BotonesMaps'
```

- [ ] **Step 2: Cargar las traducciones `maps`**

El archivo ya tiene `const t = await getTranslations('albergues')`. Añadir justo debajo de esa línea:

```tsx
const tMaps = await getTranslations('maps')
```

- [ ] **Step 3: Insertar los botones en cada tarjeta**

Reemplazar este bloque:

```tsx
                {a.contacto_publico && <p className="mt-1 text-sm text-gray-600">☎️ {a.contacto_publico}</p>}
              </article>
```

por:

```tsx
                {a.contacto_publico && <p className="mt-1 text-sm text-gray-600">☎️ {a.contacto_publico}</p>}
                <BotonesMaps
                  direccion={a.direccion}
                  municipioTexto={mapaMuni.get(a.municipio_id)}
                  lat={a.lat}
                  lng={a.lng}
                  textoVer={tMaps('verUbicacion')}
                  textoComoLlegar={tMaps('comoLlegar')}
                />
              </article>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/albergues/page.tsx
git commit -m "feat: botones de Maps en la lista de albergues"
```

---

## Task 6: Enlaces de Maps en el popup del mapa (solo acopios)

**Files:**
- Modify: `src/componentes/mapa/MapaOperativo.tsx`
- Modify: `src/app/[locale]/mapa/page.tsx`

- [ ] **Step 1: Extender el tipo `Punto` y aceptar etiquetas en `MapaOperativo`**

En `src/componentes/mapa/MapaOperativo.tsx`, reemplazar el tipo `Punto`:

```tsx
export type Punto = {
  lng: number; lat: number
  tipo: 'necesidad' | 'acopio'
  titulo: string
  urgencia?: string
}
```

por:

```tsx
export type Punto = {
  lng: number; lat: number
  tipo: 'necesidad' | 'acopio'
  titulo: string
  urgencia?: string
  mapsVer?: string
  mapsDir?: string
}

export type EtiquetasMaps = { ver: string; comoLlegar: string }
```

- [ ] **Step 2: Recibir `etiquetas` como prop y guardarlas en un ref**

Reemplazar la firma del componente y la primera línea:

```tsx
export default function MapaOperativo({ puntos }: { puntos: Punto[] }) {
  const cont = useRef<HTMLDivElement>(null)
  const mapa = useRef<maplibregl.Map | null>(null)
```

por:

```tsx
export default function MapaOperativo({
  puntos,
  etiquetas = { ver: 'Ver ubicación', comoLlegar: 'Cómo llegar' },
}: { puntos: Punto[]; etiquetas?: EtiquetasMaps }) {
  const cont = useRef<HTMLDivElement>(null)
  const mapa = useRef<maplibregl.Map | null>(null)
  const etiq = useRef(etiquetas)
  etiq.current = etiquetas
```

- [ ] **Step 3: Pasar las URLs al GeoJSON**

Reemplazar el `properties` del `map` de features:

```tsx
        properties: { tipo: p.tipo, titulo: p.titulo, urgencia: p.urgencia ?? '' },
```

por:

```tsx
        properties: {
          tipo: p.tipo, titulo: p.titulo, urgencia: p.urgencia ?? '',
          mapsVer: p.mapsVer ?? '', mapsDir: p.mapsDir ?? '',
        },
```

- [ ] **Step 4: Pintar los enlaces en el popup**

Reemplazar el handler de clic sobre `punto`:

```tsx
      m!.on('click', 'punto', (e) => {
        const f = e.features?.[0]; if (!f) return
        const g = f.geometry as GeoJSON.Point
        new maplibregl.Popup().setLngLat([g.coordinates[0], g.coordinates[1]])
          .setHTML(`<strong>${f.properties!.titulo}</strong>`).addTo(m!)
      })
```

por:

```tsx
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
```

- [ ] **Step 5: Precalcular las URLs en la página del mapa**

En `src/app/[locale]/mapa/page.tsx`, reemplazar los imports superiores:

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarNecesidades, listarAcopios } from '@/lib/datos/consultas'
import { coordenada } from '@/lib/geo/centroides'
import MapaOperativo, { type Punto } from '@/componentes/mapa/MapaOperativo'
import EnVivo from '@/componentes/EnVivo'
```

por:

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarNecesidades, listarAcopios, listarMunicipios } from '@/lib/datos/consultas'
import { coordenada } from '@/lib/geo/centroides'
import { enlacesMaps } from '@/lib/geo/maps'
import MapaOperativo, { type Punto } from '@/componentes/mapa/MapaOperativo'
import EnVivo from '@/componentes/EnVivo'
```

- [ ] **Step 6: Cargar municipios + traducciones y adjuntar URLs a los acopios**

Reemplazar este bloque:

```tsx
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
```

por:

```tsx
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
```

- [ ] **Step 7: Pasar las etiquetas a `MapaOperativo`**

Reemplazar:

```tsx
      <MapaOperativo puntos={puntos} />
```

por:

```tsx
      <MapaOperativo puntos={puntos} etiquetas={{ ver: tMaps('verUbicacion'), comoLlegar: tMaps('comoLlegar') }} />
```

- [ ] **Step 8: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add src/componentes/mapa/MapaOperativo.tsx src/app/[locale]/mapa/page.tsx
git commit -m "feat: enlaces de Maps en el popup de acopios del mapa"
```

---

## Task 7: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr toda la batería de pruebas**

Run: `npm test`
Expected: PASS (incluye `maps.test.ts` y las suites existentes).

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 4: Build de producción**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Verificación manual (navegador)**

Con `npm run dev`:
- `/es/acopios`: cada tarjeta muestra 📍 Ver ubicación y 🧭 Cómo llegar; "Ver" abre el pin en Google Maps, "Cómo llegar" abre la ruta.
- `/es/albergues`: mismos botones en cada tarjeta.
- `/es/mapa`: al hacer clic en un punto verde (acopio), el popup muestra los dos enlaces; al hacer clic en una necesidad, no aparecen enlaces.
- Repetir en `/en/...` para confirmar los textos en inglés.

---

## Self-Review (cobertura del spec)

- Helper `enlacesMaps` (prioriza lat/lng, cae a dirección+municipio+Colombia, `?api=1`) → Task 1. ✅
- Componente `BotonesMaps` (dos anclas, target/rel, guarda si dirección vacía) → Task 3. ✅
- Acopios (lista) → Task 4. ✅
- Albergues (lista) → Task 5. ✅
- Popup del mapa solo para acopios; necesidades sin botón → Task 6 (el `if (pr.mapsVer)` y que solo los acopios reciben `mapsVer`). ✅
- i18n `maps.verUbicacion` / `maps.comoLlegar` en es/en → Task 2. ✅
- Nombres/props consistentes entre tareas: `mapsVer`/`mapsDir`, `EtiquetasMaps {ver, comoLlegar}`, `enlacesMaps({ver, comoLlegar})`. ✅
- Fuera de alcance (albergues en el mapa; captura de lat/lng en formularios) — no se implementa, coherente con el spec. ✅
