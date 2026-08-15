# Detalle abrible de publicaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada publicación de los 7 listados públicos se pueda abrir en detalle (foto completa + toda la info + contacto/mapa) como modal desde el listado y como página con URL propia compartible.

**Architecture:** Rutas interceptoras + paralelas de Next 16. Un slot `@modal` en `[locale]/layout.tsx` intercepta `(.)<listado>/[id]` y monta el mismo componente `Detalle<X>` que usa la página real `<listado>/[id]/page.tsx`. Los datos se leen SIEMPRE de las vistas/tablas públicas (nunca de las tablas base). Sin cambios de base de datos.

**Tech Stack:** Next.js 16 (App Router, rutas interceptoras/paralelas), React server + client components, next-intl (i18n + navegación localizada), Supabase (cliente anónimo, vistas públicas con RLS), Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-15-detalle-publicaciones-design.md`

---

## Convenciones y piezas transversales (leer antes de empezar)

- **Cliente de datos:** `crearClienteAnonimo()` de `@/lib/supabase/cliente` (fuerza `cache: 'no-store'`).
- **Navegación localizada:** `Link`, `useRouter` de `@/i18n/navegacion`. `useRouter().back()` existe.
- **Fecha:** `tiempoRelativo(fecha, locale)` de `@/lib/formato`.
- **Mapas:** `BotonesMaps` de `@/componentes/BotonesMaps` (props: `direccion`, `municipioTexto?`, `lat?`, `lng?`, `textoVer`, `textoComoLlegar`).
- **Imágenes:** el proyecto usa `<img>` con `// eslint-disable-next-line @next/next/no-img-element` (no `next/image`). Seguir ese patrón.
- **i18n paridad:** cualquier clave nueva va a `src/messages/es.json` **y** `src/messages/en.json` (idéntica estructura), o el test `tests/unit/mensajes-paridad.test.ts` falla.
- **Tests:** unitarios puros en `tests/unit/` (`environment: node`, no hay jsdom → no se testean componentes React). Integración en `tests/integracion/` contra Supabase real (usa `.env.local`). Comandos: `npm test` (todo), `npx vitest run tests/unit/<archivo>` (uno).
- **Commits:** frecuentes, uno por tarea. Formato existente: `feat: …` / `refactor: …` / `test: …`, en español.

### Plantilla mecánica: página de detalle e intercept (se reusa en cada listado)

Cada listado repite EXACTAMENTE estos dos archivos, cambiando solo tres cosas:
`RUTA` (p. ej. `mascotas`), `obtenerX` (p. ej. `obtenerMascota`), `DetalleX` (p. ej. `DetalleMascota`), y el nombre de la prop que espera el componente. La tabla de sustitución está en cada tarea. **Página** (`src/app/[locale]/RUTA/[id]/page.tsx`):

```tsx
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerX } from '@/lib/datos/…'
import { nombreMunicipio } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import DetalleX from '@/componentes/detalle/DetalleX'
import { metadatosDe } from '@/componentes/detalle/metadatos'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  const item = await obtenerX(id)
  return metadatosDe(item) // devuelve {} si item es null
}

export default async function Pagina({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerX(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/RUTA" className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:underline">{td('volver')}</Link>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DetalleX item={item} municipio={municipio} />
      </div>
    </main>
  )
}
```

**Intercept** (`src/app/[locale]/@modal/(.)RUTA/[id]/page.tsx`):

```tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerX } from '@/lib/datos/…'
import { nombreMunicipio } from '@/lib/datos/consultas'
import Modal from '@/componentes/detalle/Modal'
import DetalleX from '@/componentes/detalle/DetalleX'

export default async function ModalX({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerX(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <Modal etiquetaCerrar={td('cerrarModal')}>
      <DetalleX item={item} municipio={municipio} />
    </Modal>
  )
}
```

> Nota: cada `DetalleX` recibe `{ item, municipio }`. `item` tiene el tipo propio del listado (definido dentro del componente). Albergues/servicios/voluntarios cuya fuente no tiene `municipio_id`… sí lo tienen todos (verificado en el esquema). Para necesidades el campo mapa es `lat`/`lng`; para acopios también. Se resuelven dentro del `DetalleX`.

---

## FASE 0 — Infra compartida + Mascotas de punta a punta

Objetivo: dejar el patrón probado con UN listado antes de replicar.

### Task 1: Guard `esUuid` + helper `nombreMunicipio`

**Files:**
- Modify: `src/lib/formato.ts`
- Modify: `src/lib/datos/consultas.ts`
- Test: `tests/unit/formato.test.ts` (existe; se le agrega)

- [ ] **Step 1: Escribir el test que falla** (agregar al final de `tests/unit/formato.test.ts`, dentro de un nuevo `describe`)

```ts
import { esUuid } from '../../src/lib/formato'

describe('esUuid', () => {
  test('acepta un UUID v4 válido', () => {
    expect(esUuid('3f4b2c1a-1111-4222-8333-444455556666')).toBe(true)
  })
  test('rechaza cadenas que no son UUID', () => {
    expect(esUuid('123')).toBe(false)
    expect(esUuid('')).toBe(false)
    expect(esUuid('drop table')).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/unit/formato.test.ts`
Expected: FAIL — `esUuid is not a function` / no export.

- [ ] **Step 3: Implementar `esUuid`** (agregar a `src/lib/formato.ts`)

```ts
export function esUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/unit/formato.test.ts`
Expected: PASS.

- [ ] **Step 5: Agregar `nombreMunicipio` a `src/lib/datos/consultas.ts`** (reutilizado por todas las páginas/intercepts). Debajo de `listarMunicipios`:

```ts
// Nombre "Municipio — Departamento" para un código DANE (o undefined). Reusa listarMunicipios.
export async function nombreMunicipio(id: string | null): Promise<string | undefined> {
  if (!id) return undefined
  const municipios = await listarMunicipios()
  const m = municipios.find((x) => x.codigo_dane === id)
  return m ? `${m.nombre} — ${m.departamento}` : undefined
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/formato.ts src/lib/datos/consultas.ts tests/unit/formato.test.ts
git commit -m "feat: esUuid guard + nombreMunicipio helper para detalle"
```

---

### Task 2: Componente `Modal` (client)

**Files:**
- Create: `src/componentes/detalle/Modal.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from '@/i18n/navegacion'

// Overlay accesible que envuelve el contenido del detalle. Cierra con Esc, clic en el
// fondo o el botón ✕, todos vía router.back() para que la URL vuelva al listado y el
// slot @modal caiga en default.tsx (null).
export default function Modal({ children, etiquetaCerrar }: { children: React.ReactNode; etiquetaCerrar: string }) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') router.back() }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = previo
      document.removeEventListener('keydown', alTeclear)
    }
  }, [router])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-6"
      onClick={() => router.back()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="relative my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => router.back()}
          aria-label={etiquetaCerrar}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 hover:bg-gray-200"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila** (typecheck rápido)

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `Modal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/componentes/detalle/Modal.tsx
git commit -m "feat: componente Modal accesible para detalle"
```

---

### Task 3: Componente `VisorFoto` (client) — foto completa + galería

**Files:**
- Create: `src/componentes/detalle/VisorFoto.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client'
import { useState } from 'react'

// Muestra la foto SIN recortar (object-contain) y permite ampliarla a pantalla
// completa. Con varias fotos (necesidades) añade navegación anterior/siguiente.
export default function VisorFoto({
  fotos, alt, etiquetaAnterior, etiquetaSiguiente, etiquetaAmpliar, etiquetaCerrar,
}: {
  fotos: string[]
  alt: string
  etiquetaAnterior: string
  etiquetaSiguiente: string
  etiquetaAmpliar: string
  etiquetaCerrar: string
}) {
  const [i, setI] = useState(0)
  const [ampliada, setAmpliada] = useState(false)
  if (!fotos.length) return null
  const hayVarias = fotos.length > 1
  const anterior = () => setI((p) => (p - 1 + fotos.length) % fotos.length)
  const siguiente = () => setI((p) => (p + 1) % fotos.length)

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fotos[i]}
        alt={alt}
        title={etiquetaAmpliar}
        onClick={() => setAmpliada(true)}
        className="max-h-[60vh] w-full cursor-zoom-in rounded-lg bg-gray-50 object-contain"
      />
      {hayVarias && (
        <>
          <button onClick={anterior} aria-label={etiquetaAnterior} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-1 text-white hover:bg-black/70">‹</button>
          <button onClick={siguiente} aria-label={etiquetaSiguiente} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-1 text-white hover:bg-black/70">›</button>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">{i + 1}/{fotos.length}</span>
        </>
      )}
      {ampliada && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setAmpliada(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotos[i]} alt={alt} className="max-h-full max-w-full object-contain" />
          <button onClick={() => setAmpliada(false)} aria-label={etiquetaCerrar} className="absolute right-4 top-4 text-3xl leading-none text-white">✕</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/componentes/detalle/VisorFoto.tsx
git commit -m "feat: VisorFoto (foto completa + galería) para detalle"
```

---

### Task 4: i18n — namespace `detalle` (es + en)

**Files:**
- Modify: `src/messages/es.json`
- Modify: `src/messages/en.json`
- Test: `tests/unit/mensajes-paridad.test.ts` (existe; debe seguir pasando)

- [ ] **Step 1: Agregar el bloque a `src/messages/es.json`** (como nueva clave de primer nivel, junto a las otras)

```json
"detalle": {
  "volver": "← Volver al listado",
  "cerrar": "Cerrar",
  "cerrarModal": "Cerrar ventana",
  "verFoto": "Ampliar foto",
  "fotoAnterior": "Foto anterior",
  "fotoSiguiente": "Foto siguiente",
  "cupos": "Cupos: {libres} libres de {total}",
  "personasAfectadas": "{n} personas afectadas"
}
```

- [ ] **Step 2: Agregar el bloque equivalente a `src/messages/en.json`**

```json
"detalle": {
  "volver": "← Back to list",
  "cerrar": "Close",
  "cerrarModal": "Close dialog",
  "verFoto": "Enlarge photo",
  "fotoAnterior": "Previous photo",
  "fotoSiguiente": "Next photo",
  "cupos": "Spots: {libres} free of {total}",
  "personasAfectadas": "{n} people affected"
}
```

- [ ] **Step 3: Correr el test de paridad**

Run: `npx vitest run tests/unit/mensajes-paridad.test.ts`
Expected: PASS (mismas claves en es/en).

- [ ] **Step 4: Commit**

```bash
git add src/messages/es.json src/messages/en.json
git commit -m "feat: i18n namespace detalle (es/en)"
```

---

### Task 5: `obtenerMascota` + metadatos compartidos

**Files:**
- Modify: `src/lib/datos/mascotas.ts`
- Create: `src/componentes/detalle/metadatos.ts`
- Test: `tests/integracion/datos.test.ts` (existe; se agrega un caso)

- [ ] **Step 1: Escribir el test de integración que falla** (agregar dentro de `describe('lecturas públicas', …)`)

```ts
import { listarMascotas } from '../../src/lib/datos/mascotas'
import { obtenerMascota } from '../../src/lib/datos/mascotas'

test('obtenerMascota devuelve la fila por id (o null)', async () => {
  const lista = await listarMascotas()
  if (lista.length === 0) return // sin datos, nada que verificar
  const uno = await obtenerMascota(lista[0].id)
  expect(uno).not.toBeNull()
  expect(uno!.id).toBe(lista[0].id)
})

test('obtenerMascota con id inexistente devuelve null', async () => {
  const r = await obtenerMascota('00000000-0000-4000-8000-000000000000')
  expect(r).toBeNull()
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/integracion/datos.test.ts`
Expected: FAIL — `obtenerMascota` no existe.

- [ ] **Step 3: Implementar `obtenerMascota`** (agregar a `src/lib/datos/mascotas.ts`; importar `esUuid`)

```ts
import { esUuid } from '@/lib/formato'

// Lectura pública de UNA mascota por id, desde la misma vista que el listado
// (incluye contacto). Devuelve null si el id no es UUID o no existe/no es público.
export async function obtenerMascota(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('mascotas_publicas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 4: Crear el helper de metadatos** `src/componentes/detalle/metadatos.ts`

```ts
import type { Metadata } from 'next'

// Metadatos OpenGraph para compartir una publicación (título + descripción + foto).
// Recibe un item con al menos { descripcion } y opcionalmente { foto_url, nombre }.
export function metadatosDe(item: unknown): Metadata {
  if (!item || typeof item !== 'object') return {}
  const it = item as { descripcion?: string; nombre?: string | null; foto_url?: string | null }
  const desc = (it.descripcion ?? '').slice(0, 160)
  const titulo = it.nombre?.trim() || desc.slice(0, 60) || 'AyudaCol'
  return {
    title: titulo,
    description: desc || undefined,
    openGraph: {
      title: titulo,
      description: desc || undefined,
      images: it.foto_url ? [{ url: it.foto_url }] : undefined,
    },
  }
}
```

- [ ] **Step 5: Correr el test y verlo pasar**

Run: `npx vitest run tests/integracion/datos.test.ts`
Expected: PASS (requiere `.env.local` con credenciales Supabase; si el suite de integración no corre en tu entorno, verificar `obtenerMascota` en el paso manual de la Task 10).

- [ ] **Step 6: Commit**

```bash
git add src/lib/datos/mascotas.ts src/componentes/detalle/metadatos.ts tests/integracion/datos.test.ts
git commit -m "feat: obtenerMascota + helper de metadatos OG"
```

---

### Task 6: Componente `DetalleMascota` (server)

**Files:**
- Create: `src/componentes/detalle/DetalleMascota.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import VisorFoto from './VisorFoto'

type Mascota = {
  id: string; tipo_reporte: string; especie: string; nombre: string | null
  descripcion: string; municipio_id: string | null; ultima_ubicacion: string | null
  foto_url: string | null; estado: string
  contacto_nombre: string; contacto_telefono: string; creada_en: string
}

export default function DetalleMascota({ item, municipio }: { item: Mascota; municipio?: string }) {
  const t = useTranslations('mascotas')
  const td = useTranslations('detalle')
  const locale = useLocale() as 'es' | 'en'
  const ubicacion = [municipio, item.ultima_ubicacion].filter(Boolean).join(' · ')
  const soloDigitos = item.contacto_telefono.replace(/\D/g, '')
  const titulo = [t(`especie_${item.especie}`), item.nombre].filter(Boolean).join(' · ')

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
        <span className="text-xl font-bold">🐾 {titulo}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.tipo_reporte === 'perdida' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
          {t(`tipo_${item.tipo_reporte}`)}
        </span>
        {item.estado === 'reunida' && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">{t('estado_reunida')}</span>
        )}
      </div>
      {item.foto_url && (
        <VisorFoto
          fotos={[item.foto_url]}
          alt={titulo}
          etiquetaAnterior={td('fotoAnterior')}
          etiquetaSiguiente={td('fotoSiguiente')}
          etiquetaAmpliar={td('verFoto')}
          etiquetaCerrar={td('cerrar')}
        />
      )}
      <p className="mt-3 whitespace-pre-line text-gray-800">{item.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
        {ubicacion && <span>📍 {ubicacion}</span>}
        <span>🕓 {tiempoRelativo(item.creada_en, locale)}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <span className="text-gray-700">{t('contacto')}: <b>{item.contacto_nombre}</b></span>
        <a href={`https://wa.me/${soloDigitos}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-bold text-white hover:brightness-95">💬 {t('whatsapp')}</a>
        <a href={`tel:${item.contacto_telefono}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">📞 {t('llamar')}</a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/componentes/detalle/DetalleMascota.tsx
git commit -m "feat: DetalleMascota (cuerpo reutilizable página+modal)"
```

---

### Task 7: Página de detalle de mascota `mascotas/[id]/page.tsx`

**Files:**
- Create: `src/app/[locale]/mascotas/[id]/page.tsx`

Sustitución de la plantilla "Página": `RUTA=mascotas`, `obtenerX=obtenerMascota` (de `@/lib/datos/mascotas`), `DetalleX=DetalleMascota`.

- [ ] **Step 1: Crear el archivo** (plantilla "Página" ya sustituida)

```tsx
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerMascota } from '@/lib/datos/mascotas'
import { nombreMunicipio } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import DetalleMascota from '@/componentes/detalle/DetalleMascota'
import { metadatosDe } from '@/componentes/detalle/metadatos'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  return metadatosDe(await obtenerMascota(id))
}

export default async function Pagina({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerMascota(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/mascotas" className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:underline">{td('volver')}</Link>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DetalleMascota item={item} municipio={municipio} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verificar en dev** — con `npm run dev`, abrir directo `/es/mascotas/<id-real>` (tomar un id de `/es/mascotas`). Debe verse la página completa con la foto sin recortar. Un id inventado → 404.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/mascotas/[id]/page.tsx"
git commit -m "feat: página de detalle compartible de mascota"
```

---

### Task 8: Slot `@modal` + intercept de mascota + layout

**Files:**
- Create: `src/app/[locale]/@modal/default.tsx`
- Create: `src/app/[locale]/@modal/[...catchAll]/page.tsx`
- Create: `src/app/[locale]/@modal/(.)mascotas/[id]/page.tsx`
- Modify: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: `@modal/default.tsx`**

```tsx
export default function Default() {
  return null
}
```

- [ ] **Step 2: `@modal/[...catchAll]/page.tsx`** (cierra el modal al navegar a cualquier otra ruta)

```tsx
export default function CatchAll() {
  return null
}
```

- [ ] **Step 3: `@modal/(.)mascotas/[id]/page.tsx`** (plantilla "Intercept" sustituida: `RUTA=mascotas`, `obtenerMascota`, `DetalleMascota`)

```tsx
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
```

- [ ] **Step 4: Modificar `layout.tsx`** para aceptar y renderizar el slot `modal`. Cambiar la firma y el JSX:

```tsx
export default async function LocaleLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode
  modal: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Navegacion />
          {children}
          {modal}
          <BotonWhatsApp />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Verificar en dev** — reiniciar `npm run dev`. En `/es/mascotas`, la lista carga normal (el slot cae en `default.tsx`). Abrir directo `/es/mascotas/<id>` sigue mostrando la página completa (sin interceptar en carga dura).

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/@modal" "src/app/[locale]/layout.tsx"
git commit -m "feat: slot @modal + intercept de mascota + layout"
```

---

### Task 9: Tarjeta de mascota clickeable (stretched-link)

**Files:**
- Modify: `src/componentes/listas/TarjetaMascota.tsx`

Patrón stretched-link: la tarjeta se vuelve `relative`; un `<Link>` absoluto (`z-[1]`) cubre toda la tarjeta; los botones de contacto suben a `z-10` para seguir siendo clickeables independientes. Sin anclas anidadas (Link y botones son hermanos).

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import { Link } from '@/i18n/navegacion'

type Mascota = {
  id: string; tipo_reporte: string; especie: string; nombre: string | null
  descripcion: string; municipio_id: string | null; ultima_ubicacion: string | null
  foto_url: string | null; estado: string
  contacto_nombre: string; contacto_telefono: string; creada_en: string
}

const COLOR_TIPO: Record<string, string> = {
  perdida: 'bg-amber-100 text-amber-800',
  encontrada: 'bg-green-100 text-green-800',
}

export default function TarjetaMascota({ m, municipio }: { m: Mascota; municipio?: string }) {
  const t = useTranslations('mascotas')
  const locale = useLocale() as 'es' | 'en'
  const ubicacion = [municipio, m.ultima_ubicacion].filter(Boolean).join(' · ')
  const soloDigitos = m.contacto_telefono.replace(/\D/g, '')
  const titulo = [t(`especie_${m.especie}`), m.nombre].filter(Boolean).join(' · ')

  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/mascotas/${m.id}`} aria-label={titulo} className="absolute inset-0 z-[1] rounded-lg" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold">🐾 {titulo}</span>
        <div className="flex flex-shrink-0 gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_TIPO[m.tipo_reporte] ?? 'bg-gray-100 text-gray-600'}`}>
            {t(`tipo_${m.tipo_reporte}`)}
          </span>
          {m.estado === 'reunida' && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
              {t('estado_reunida')}
            </span>
          )}
        </div>
      </div>
      {m.foto_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.foto_url} alt={titulo} className="mb-2 h-40 w-full rounded-lg object-cover" />
      )}
      <p className="text-sm text-gray-700">{m.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {ubicacion && <span>📍 {ubicacion}</span>}
        <span>🕓 {tiempoRelativo(m.creada_en, locale)}</span>
      </div>
      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm">
        <span className="text-gray-700">{t('contacto')}: <b>{m.contacto_nombre}</b></span>
        <a
          href={`https://wa.me/${soloDigitos}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:brightness-95"
        >
          💬 {t('whatsapp')}
        </a>
        <a
          href={`tel:${m.contacto_telefono}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          📞 {t('llamar')}
        </a>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/componentes/listas/TarjetaMascota.tsx
git commit -m "feat: tarjeta de mascota clickeable (stretched-link)"
```

---

### Task 10: Verificación manual de mascotas (end-to-end)

**Files:** ninguno (checklist con `npm run dev`).

- [ ] **Step 1: Ejecutar y verificar**

Run: `npm run dev` y comprobar en el navegador:
- [ ] En `/es/mascotas`, clic en cualquier parte de la tarjeta (no en los botones) → abre **modal** encima de la lista; la URL cambia a `/es/mascotas/<id>`.
- [ ] Los botones **WhatsApp** y **Llamar** de la tarjeta siguen funcionando (no abren el modal).
- [ ] En el modal, la foto se ve **completa** (object-contain) y al hacer clic se amplía a pantalla completa.
- [ ] `Esc`, clic en el fondo y el botón ✕ cierran el modal y devuelven a `/es/mascotas`.
- [ ] Refrescar (F5) estando en `/es/mascotas/<id>` → muestra la **página completa** (no el modal).
- [ ] Navegar a otra sección con el modal abierto lo cierra (catch-all).
- [ ] Repetir en `/en/mascotas`.

- [ ] **Step 2: Si algo falla,** revisar: convención de interceptación (`(.)mascotas` bajo `@modal`), que `layout.tsx` renderice `{modal}`, y la combinación next-intl + intercept (que el `Link` localizado prefije `[locale]`). Las **páginas** deben funcionar aunque el modal no; corregir el modal sin romper las páginas.

- [ ] **Step 3: Commit** (si hubo ajustes)

```bash
git commit -am "fix: ajustes de la capa modal de mascotas"
```

---

## FASE 1 — Desaparecidos (con foto, SIN contacto)

### Task 11: `obtenerDesaparecido` (privacidad: sin contacto)

**Files:**
- Modify: `src/lib/datos/desaparecidos.ts`
- Test: `tests/integracion/datos.test.ts`

- [ ] **Step 1: Test de integración que falla** (agregar en `describe('lecturas públicas', …)`)

```ts
import { listarDesaparecidos, obtenerDesaparecido } from '../../src/lib/datos/desaparecidos'

test('obtenerDesaparecido NUNCA expone contacto', async () => {
  const lista = await listarDesaparecidos()
  if (lista.length === 0) return
  const uno = await obtenerDesaparecido(lista[0].id)
  expect(uno).not.toBeNull()
  expect(uno).not.toHaveProperty('contacto_telefono')
  expect(uno).not.toHaveProperty('contacto_nombre')
})
```

- [ ] **Step 2: Correr y verlo fallar** — `npx vitest run tests/integracion/datos.test.ts` → FAIL (no existe `obtenerDesaparecido`).

- [ ] **Step 3: Implementar** (agregar a `src/lib/datos/desaparecidos.ts`; importar `esUuid` de `@/lib/formato`)

```ts
import { esUuid } from '@/lib/formato'

// Lectura pública de UNA persona desaparecida por id, desde la vista SIN contacto.
export async function obtenerDesaparecido(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('personas_desaparecidas_publicas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 4: Correr y verlo pasar** — `npx vitest run tests/integracion/datos.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/datos/desaparecidos.ts tests/integracion/datos.test.ts
git commit -m "feat: obtenerDesaparecido (vista sin contacto) + test de privacidad"
```

---

### Task 12: `DetalleDesaparecido` + página + intercept + tarjeta

**Files:**
- Create: `src/componentes/detalle/DetalleDesaparecido.tsx`
- Create: `src/app/[locale]/desaparecidos/[id]/page.tsx`
- Create: `src/app/[locale]/@modal/(.)desaparecidos/[id]/page.tsx`
- Modify: `src/componentes/listas/TarjetaDesaparecido.tsx`

- [ ] **Step 1: `DetalleDesaparecido.tsx`** (sin botones de contacto)

```tsx
import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import VisorFoto from './VisorFoto'

type Desaparecido = {
  id: string; nombre: string; edad: number | null; descripcion: string
  municipio_id: string | null; ultima_ubicacion: string | null
  foto_url: string | null; estado: string; creada_en: string
}

const COLOR_ESTADO: Record<string, string> = {
  buscando: 'bg-amber-100 text-amber-800',
  encontrada: 'bg-green-100 text-green-800',
}

export default function DetalleDesaparecido({ item, municipio }: { item: Desaparecido; municipio?: string }) {
  const t = useTranslations()
  const td = useTranslations('detalle')
  const locale = useLocale() as 'es' | 'en'
  const ubicacion = [municipio, item.ultima_ubicacion].filter(Boolean).join(' · ')

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
        <span className="text-xl font-bold">{item.nombre}</span>
        {item.edad != null && <span className="text-gray-500">{t('desaparecidos.aniosAbrev', { n: item.edad })}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[item.estado] ?? 'bg-gray-100 text-gray-600'}`}>
          {t(`desaparecidos.${item.estado}`)}
        </span>
      </div>
      {item.foto_url && (
        <VisorFoto fotos={[item.foto_url]} alt={item.nombre} etiquetaAnterior={td('fotoAnterior')} etiquetaSiguiente={td('fotoSiguiente')} etiquetaAmpliar={td('verFoto')} etiquetaCerrar={td('cerrar')} />
      )}
      <p className="mt-3 whitespace-pre-line text-gray-800">{item.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
        {ubicacion && <span>📍 {ubicacion}</span>}
        <span>🕓 {tiempoRelativo(item.creada_en, locale)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Página** `src/app/[locale]/desaparecidos/[id]/page.tsx` — plantilla "Página" con `RUTA=desaparecidos`, `obtenerDesaparecido` (de `@/lib/datos/desaparecidos`), `DetalleDesaparecido`:

```tsx
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerDesaparecido } from '@/lib/datos/desaparecidos'
import { nombreMunicipio } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import DetalleDesaparecido from '@/componentes/detalle/DetalleDesaparecido'
import { metadatosDe } from '@/componentes/detalle/metadatos'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  return metadatosDe(await obtenerDesaparecido(id))
}

export default async function Pagina({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerDesaparecido(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/desaparecidos" className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:underline">{td('volver')}</Link>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DetalleDesaparecido item={item} municipio={municipio} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Intercept** `src/app/[locale]/@modal/(.)desaparecidos/[id]/page.tsx` — plantilla "Intercept" sustituida:

```tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerDesaparecido } from '@/lib/datos/desaparecidos'
import { nombreMunicipio } from '@/lib/datos/consultas'
import Modal from '@/componentes/detalle/Modal'
import DetalleDesaparecido from '@/componentes/detalle/DetalleDesaparecido'

export default async function ModalDesaparecido({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerDesaparecido(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <Modal etiquetaCerrar={td('cerrarModal')}>
      <DetalleDesaparecido item={item} municipio={municipio} />
    </Modal>
  )
}
```

- [ ] **Step 4: Tarjeta clickeable** — en `src/componentes/listas/TarjetaDesaparecido.tsx`: importar `Link` de `@/i18n/navegacion`, poner `relative` en el `<article>` y agregar como primer hijo el stretched-link (esta tarjeta no tiene botones, así que basta el link):

```tsx
import { Link } from '@/i18n/navegacion'
// … dentro del <article className="relative rounded-lg …"> como primer hijo:
<Link href={`/desaparecidos/${d.id}`} aria-label={d.nombre} className="absolute inset-0 z-[1] rounded-lg" />
```

(Añadir `relative` a la clase del `<article>` y `transition hover:shadow-md` para el feedback.)

- [ ] **Step 5: Verificar en dev** — clic en tarjeta abre modal; foto completa; **no** aparece teléfono ni WhatsApp; refresh muestra página; es/en.

- [ ] **Step 6: Commit**

```bash
git add "src/componentes/detalle/DetalleDesaparecido.tsx" "src/app/[locale]/desaparecidos/[id]" "src/app/[locale]/@modal/(.)desaparecidos" "src/componentes/listas/TarjetaDesaparecido.tsx"
git commit -m "feat: detalle abrible de personas desaparecidas"
```

---

## FASE 2 — Necesidades (galería + mapa, SIN contacto)

### Task 13: `obtenerNecesidad` (privacidad: sin contacto)

**Files:**
- Modify: `src/lib/datos/consultas.ts`
- Test: `tests/integracion/datos.test.ts`

- [ ] **Step 1: Test que falla** (en `describe('lecturas públicas', …)`)

```ts
import { obtenerNecesidad } from '../../src/lib/datos/consultas'

test('obtenerNecesidad NUNCA expone contacto', async () => {
  const lista = await listarNecesidades()
  if (lista.length === 0) return
  const uno = await obtenerNecesidad(lista[0].id)
  expect(uno).not.toBeNull()
  expect(uno).not.toHaveProperty('contacto_telefono')
  expect(uno).not.toHaveProperty('contacto_nombre')
})
```

- [ ] **Step 2: Correr y verlo fallar** — FAIL (no existe).

- [ ] **Step 3: Implementar** en `src/lib/datos/consultas.ts` (importar `esUuid` de `@/lib/formato` al inicio del archivo)

```ts
export async function obtenerNecesidad(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('solicitudes_publicas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 4: Correr y verlo pasar** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/datos/consultas.ts tests/integracion/datos.test.ts
git commit -m "feat: obtenerNecesidad (vista sin contacto) + test de privacidad"
```

---

### Task 14: `DetalleNecesidad` (galería + mapa) + página + intercept + tarjeta

**Files:**
- Create: `src/componentes/detalle/DetalleNecesidad.tsx`
- Create: `src/app/[locale]/necesidades/[id]/page.tsx`
- Create: `src/app/[locale]/@modal/(.)necesidades/[id]/page.tsx`
- Modify: `src/componentes/listas/TarjetaNecesidad.tsx`

- [ ] **Step 1: `DetalleNecesidad.tsx`** — usa `VisorFoto` con toda la galería y `BotonesMaps` con lat/lng.

```tsx
import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import VisorFoto from './VisorFoto'
import BotonesMaps from '@/componentes/BotonesMaps'

type Necesidad = {
  id: string; categoria: string; descripcion: string; urgencia: string
  estado: string; municipio_id: string; personas_afectadas: number | null
  detalle_ubicacion: string | null; lat: number | null; lng: number | null
  creada_en: string; fotos?: string[] | null
}

const BORDE: Record<string, string> = {
  alta: 'border-l-red-500', media: 'border-l-amber-500', baja: 'border-l-gray-300',
}

export default function DetalleNecesidad({ item, municipio }: { item: Necesidad; municipio?: string }) {
  const t = useTranslations()
  const td = useTranslations('detalle')
  const tMaps = useTranslations('maps')
  const locale = useLocale() as 'es' | 'en'
  const fotos = item.fotos ?? []
  const direccion = [item.detalle_ubicacion, municipio].filter(Boolean).join(', ')

  return (
    <div className={`border-l-4 ${BORDE[item.urgencia] ?? 'border-l-gray-300'} p-5 sm:p-6`}>
      <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
        <span className="text-xl font-bold">{t(`categorias.${item.categoria}`)}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{t(`urgencias.${item.urgencia}`)}</span>
      </div>
      {fotos.length > 0 && (
        <VisorFoto fotos={fotos} alt={t(`categorias.${item.categoria}`)} etiquetaAnterior={td('fotoAnterior')} etiquetaSiguiente={td('fotoSiguiente')} etiquetaAmpliar={td('verFoto')} etiquetaCerrar={td('cerrar')} />
      )}
      <p className="mt-3 whitespace-pre-line text-gray-800">{item.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
        <span>📍 {[municipio, item.detalle_ubicacion].filter(Boolean).join(' · ')}</span>
        {item.personas_afectadas != null && <span>👥 {td('personasAfectadas', { n: item.personas_afectadas })}</span>}
        <span>🕓 {tiempoRelativo(item.creada_en, locale)}</span>
      </div>
      {direccion && (
        <BotonesMaps direccion={direccion} municipioTexto={municipio} lat={item.lat} lng={item.lng} textoVer={tMaps('verUbicacion')} textoComoLlegar={tMaps('comoLlegar')} />
      )}
    </div>
  )
}
```

> Nota: `urgencias` ya existe como namespace en messages (claves `alta/media/baja`). Verificar en `src/messages/es.json`; si faltara alguna clave, agregarla en es y en (paridad).

- [ ] **Step 2: Página** `src/app/[locale]/necesidades/[id]/page.tsx` — plantilla "Página" con `RUTA=necesidades`, `obtenerNecesidad` (de `@/lib/datos/consultas`), `DetalleNecesidad`:

```tsx
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerNecesidad, nombreMunicipio } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import DetalleNecesidad from '@/componentes/detalle/DetalleNecesidad'
import { metadatosDe } from '@/componentes/detalle/metadatos'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  const item = await obtenerNecesidad(id)
  return metadatosDe(item ? { ...item, foto_url: item.fotos?.[0] ?? null } : null)
}

export default async function Pagina({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerNecesidad(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/necesidades" className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:underline">{td('volver')}</Link>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DetalleNecesidad item={item} municipio={municipio} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Intercept** `src/app/[locale]/@modal/(.)necesidades/[id]/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerNecesidad, nombreMunicipio } from '@/lib/datos/consultas'
import Modal from '@/componentes/detalle/Modal'
import DetalleNecesidad from '@/componentes/detalle/DetalleNecesidad'

export default async function ModalNecesidad({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerNecesidad(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <Modal etiquetaCerrar={td('cerrarModal')}>
      <DetalleNecesidad item={item} municipio={municipio} />
    </Modal>
  )
}
```

- [ ] **Step 4: Tarjeta clickeable** — `src/componentes/listas/TarjetaNecesidad.tsx`: importar `Link`, poner `relative` en el `<article>` y agregar como primer hijo:

```tsx
import { Link } from '@/i18n/navegacion'
// primer hijo del <article className="relative … border-l-4 …">:
<Link href={`/necesidades/${n.id}`} aria-label={t(`categorias.${n.categoria}`)} className="absolute inset-0 z-[1] rounded-lg" />
```

- [ ] **Step 5: Verificar en dev** — abre modal; si hay varias fotos, la **galería** navega; el **mapa** aparece si hay ubicación; sin contacto; es/en.

- [ ] **Step 6: Commit**

```bash
git add "src/componentes/detalle/DetalleNecesidad.tsx" "src/app/[locale]/necesidades/[id]" "src/app/[locale]/@modal/(.)necesidades" "src/componentes/listas/TarjetaNecesidad.tsx"
git commit -m "feat: detalle abrible de necesidades (galería + mapa)"
```

---

## FASE 3 — Acopios (extraer tarjeta + contacto + mapa)

### Task 15: `obtenerAcopio`

**Files:**
- Modify: `src/lib/datos/consultas.ts`

- [ ] **Step 1: Implementar** (junto a `listarAcopios`; `esUuid` ya importado en Task 13)

```ts
export async function obtenerAcopio(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('centros_acopio').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data // RLS ya restringe a verificado=true para anon
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/datos/consultas.ts
git commit -m "feat: obtenerAcopio (tabla pública verificada)"
```

---

### Task 16: Extraer `TarjetaAcopio` (clickeable) y usarla en la página

**Files:**
- Create: `src/componentes/listas/TarjetaAcopio.tsx`
- Modify: `src/app/[locale]/acopios/page.tsx`

- [ ] **Step 1: Crear `TarjetaAcopio.tsx`** (misma UI que hoy en la página + stretched-link; los botones de Maps suben a `z-10`). Recibe los textos ya traducidos por props para poder ser server component que no dependa del namespace activo:

```tsx
import { Link } from '@/i18n/navegacion'
import BotonesMaps from '@/componentes/BotonesMaps'

type Acopio = {
  id: string; nombre: string; municipio_id: string; direccion: string
  horarios: string | null; recibe: string[]; no_necesita: string[]
  lat: number | null; lng: number | null
}

export default function TarjetaAcopio({
  a, municipioTexto, textoRecibe, textoNoNecesita, textoVerMapa, textoComoLlegar,
}: {
  a: Acopio; municipioTexto?: string
  textoRecibe: string; textoNoNecesita: string; textoVerMapa: string; textoComoLlegar: string
}) {
  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/acopios/${a.id}`} aria-label={a.nombre} className="absolute inset-0 z-[1] rounded-lg" />
      <h2 className="font-bold">{a.nombre}</h2>
      <p className="text-sm text-gray-600">📍 {municipioTexto ?? a.municipio_id} · {a.direccion}</p>
      {a.horarios && <p className="text-sm text-gray-600">🕓 {a.horarios}</p>}
      {a.recibe?.length > 0 && <p className="mt-2 text-sm"><b>{textoRecibe}:</b> {a.recibe.join(', ')}</p>}
      {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{textoNoNecesita}:</b> {a.no_necesita.join(', ')}</p>}
      <div className="relative z-10">
        <BotonesMaps direccion={a.direccion} municipioTexto={municipioTexto} lat={a.lat} lng={a.lng} textoVer={textoVerMapa} textoComoLlegar={textoComoLlegar} />
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Usarla en `acopios/page.tsx`** — reemplazar el bloque `acopios.map(...)` (el `<article>` inline) por:

```tsx
{acopios.map((a) => (
  <TarjetaAcopio
    key={a.id}
    a={a}
    municipioTexto={mapaMuni.get(a.municipio_id)}
    textoRecibe={t('recibe')}
    textoNoNecesita={t('noNecesita')}
    textoVerMapa={tMaps('verUbicacion')}
    textoComoLlegar={tMaps('comoLlegar')}
  />
))}
```

Y agregar el import: `import TarjetaAcopio from '@/componentes/listas/TarjetaAcopio'`. (Los helpers `t`/`tMaps`/`mapaMuni` ya existen en esa página.)

- [ ] **Step 3: Verificar en dev** — la lista de acopios se ve igual; ahora la tarjeta es clickeable y los botones de mapa siguen funcionando.

- [ ] **Step 4: Commit**

```bash
git add "src/componentes/listas/TarjetaAcopio.tsx" "src/app/[locale]/acopios/page.tsx"
git commit -m "refactor: extraer TarjetaAcopio clickeable"
```

---

### Task 17: `DetalleAcopio` + página + intercept

**Files:**
- Create: `src/componentes/detalle/DetalleAcopio.tsx`
- Create: `src/app/[locale]/acopios/[id]/page.tsx`
- Create: `src/app/[locale]/@modal/(.)acopios/[id]/page.tsx`

- [ ] **Step 1: `DetalleAcopio.tsx`**

```tsx
import { useTranslations } from 'next-intl'
import BotonesMaps from '@/componentes/BotonesMaps'

type Acopio = {
  id: string; nombre: string; municipio_id: string; direccion: string
  horarios: string | null; contacto_publico: string | null
  recibe: string[]; no_necesita: string[]; lat: number | null; lng: number | null
}

export default function DetalleAcopio({ item, municipio }: { item: Acopio; municipio?: string }) {
  const t = useTranslations('listas')
  const tMaps = useTranslations('maps')
  return (
    <div className="p-5 sm:p-6">
      <h1 className="mb-2 pr-8 text-xl font-bold">{item.nombre}</h1>
      <p className="text-sm text-gray-600">📍 {[municipio, item.direccion].filter(Boolean).join(' · ')}</p>
      {item.horarios && <p className="mt-1 text-sm text-gray-600">🕓 {item.horarios}</p>}
      {item.contacto_publico && <p className="mt-1 text-sm text-gray-600">☎️ {item.contacto_publico}</p>}
      {item.recibe?.length > 0 && <p className="mt-3 text-sm"><b>{t('recibe')}:</b> {item.recibe.join(', ')}</p>}
      {item.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('noNecesita')}:</b> {item.no_necesita.join(', ')}</p>}
      <BotonesMaps direccion={item.direccion} municipioTexto={municipio} lat={item.lat} lng={item.lng} textoVer={tMaps('verUbicacion')} textoComoLlegar={tMaps('comoLlegar')} />
    </div>
  )
}
```

- [ ] **Step 2: Página** `src/app/[locale]/acopios/[id]/page.tsx` — plantilla "Página" con `RUTA=acopios`, `obtenerAcopio` (de `@/lib/datos/consultas`), `DetalleAcopio`. `metadatosDe` recibe el item tal cual (usa `descripcion`/`nombre`/`foto_url` si existen; acopio no tiene `descripcion`/`foto_url`, así que caerá a título = `nombre`):

```tsx
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerAcopio, nombreMunicipio } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import DetalleAcopio from '@/componentes/detalle/DetalleAcopio'
import { metadatosDe } from '@/componentes/detalle/metadatos'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  return metadatosDe(await obtenerAcopio(id))
}

export default async function Pagina({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerAcopio(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/acopios" className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:underline">{td('volver')}</Link>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DetalleAcopio item={item} municipio={municipio} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Intercept** `src/app/[locale]/@modal/(.)acopios/[id]/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerAcopio, nombreMunicipio } from '@/lib/datos/consultas'
import Modal from '@/componentes/detalle/Modal'
import DetalleAcopio from '@/componentes/detalle/DetalleAcopio'

export default async function ModalAcopio({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerAcopio(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <Modal etiquetaCerrar={td('cerrarModal')}>
      <DetalleAcopio item={item} municipio={municipio} />
    </Modal>
  )
}
```

- [ ] **Step 4: Verificar en dev** — modal con horarios, recibe/no necesita, contacto público y botones de mapa; refresh muestra página; es/en.

- [ ] **Step 5: Commit**

```bash
git add "src/componentes/detalle/DetalleAcopio.tsx" "src/app/[locale]/acopios/[id]" "src/app/[locale]/@modal/(.)acopios"
git commit -m "feat: detalle abrible de centros de acopio"
```

---

## FASE 4 — Albergues (extraer tarjeta + cupos + contacto)

### Task 18: `obtenerAlbergue`

**Files:**
- Modify: `src/lib/datos/albergues.ts`

- [ ] **Step 1: Implementar** (importar `esUuid` de `@/lib/formato`; usar `crearClienteAnonimo` como en `listarAlbergues`)

```ts
import { esUuid } from '@/lib/formato'

export async function obtenerAlbergue(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('albergues').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}
```

> Verificar el nombre del import del cliente en `albergues.ts` (probablemente `crearClienteAnonimo` de `@/lib/supabase/cliente`); reusar el que ya use `listarAlbergues`.

- [ ] **Step 2: Typecheck + Commit**

```bash
npx tsc --noEmit
git add src/lib/datos/albergues.ts
git commit -m "feat: obtenerAlbergue"
```

---

### Task 19: Extraer `TarjetaAlbergue` (clickeable) y usarla en la página

**Files:**
- Create: `src/componentes/listas/TarjetaAlbergue.tsx`
- Modify: `src/app/[locale]/albergues/page.tsx`

- [ ] **Step 1: Crear `TarjetaAlbergue.tsx`** (misma UI de hoy + stretched-link; textos por props)

```tsx
import { Link } from '@/i18n/navegacion'
import BotonesMaps from '@/componentes/BotonesMaps'

type Albergue = {
  id: string; nombre: string; municipio_id: string; direccion: string
  capacidad: number | null; ocupacion: number; contacto_publico: string | null
  estado: string; lat?: number | null; lng?: number | null
}

const COLOR_ESTADO: Record<string, string> = {
  abierto: 'bg-green-100 text-green-800',
  lleno: 'bg-amber-100 text-amber-800',
  cerrado: 'bg-gray-200 text-gray-700',
}

export default function TarjetaAlbergue({
  a, municipioTexto, textoEstado, textoCupos, textoVerMapa, textoComoLlegar,
}: {
  a: Albergue; municipioTexto?: string
  textoEstado: string; textoCupos: string | null; textoVerMapa: string; textoComoLlegar: string
}) {
  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/albergues/${a.id}`} aria-label={a.nombre} className="absolute inset-0 z-[1] rounded-lg" />
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-bold">{a.nombre}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[a.estado] ?? 'bg-gray-100 text-gray-600'}`}>{textoEstado}</span>
      </div>
      <p className="text-sm text-gray-600">📍 {municipioTexto ?? a.municipio_id} · {a.direccion}</p>
      {textoCupos && <p className="mt-1 text-sm font-semibold text-gray-700">{textoCupos}</p>}
      {a.contacto_publico && <p className="mt-1 text-sm text-gray-600">☎️ {a.contacto_publico}</p>}
      <div className="relative z-10">
        <BotonesMaps direccion={a.direccion} municipioTexto={municipioTexto} lat={a.lat} lng={a.lng} textoVer={textoVerMapa} textoComoLlegar={textoComoLlegar} />
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Usarla en `albergues/page.tsx`** — reemplazar el `<article>` inline dentro de `albergues.map(...)`. Mantener el cálculo de `libres`:

```tsx
{albergues.map((a) => {
  const libres = a.capacidad != null ? Math.max(0, a.capacidad - a.ocupacion) : null
  return (
    <TarjetaAlbergue
      key={a.id}
      a={a}
      municipioTexto={mapaMuni.get(a.municipio_id)}
      textoEstado={t(a.estado)}
      textoCupos={libres !== null ? t('cupos', { libres, total: a.capacidad }) : null}
      textoVerMapa={tMaps('verUbicacion')}
      textoComoLlegar={tMaps('comoLlegar')}
    />
  )
})}
```

Agregar `import TarjetaAlbergue from '@/componentes/listas/TarjetaAlbergue'`.

- [ ] **Step 3: Verificar + Commit**

```bash
git add "src/componentes/listas/TarjetaAlbergue.tsx" "src/app/[locale]/albergues/page.tsx"
git commit -m "refactor: extraer TarjetaAlbergue clickeable"
```

---

### Task 20: `DetalleAlbergue` + página + intercept

**Files:**
- Create: `src/componentes/detalle/DetalleAlbergue.tsx`
- Create: `src/app/[locale]/albergues/[id]/page.tsx`
- Create: `src/app/[locale]/@modal/(.)albergues/[id]/page.tsx`

- [ ] **Step 1: `DetalleAlbergue.tsx`**

```tsx
import { useTranslations } from 'next-intl'
import BotonesMaps from '@/componentes/BotonesMaps'

type Albergue = {
  id: string; nombre: string; municipio_id: string; direccion: string
  capacidad: number | null; ocupacion: number; contacto_publico: string | null
  estado: string; lat?: number | null; lng?: number | null
}

const COLOR_ESTADO: Record<string, string> = {
  abierto: 'bg-green-100 text-green-800',
  lleno: 'bg-amber-100 text-amber-800',
  cerrado: 'bg-gray-200 text-gray-700',
}

export default function DetalleAlbergue({ item, municipio }: { item: Albergue; municipio?: string }) {
  const t = useTranslations('albergues')
  const td = useTranslations('detalle')
  const tMaps = useTranslations('maps')
  const libres = item.capacidad != null ? Math.max(0, item.capacidad - item.ocupacion) : null
  return (
    <div className="p-5 sm:p-6">
      <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
        <h1 className="text-xl font-bold">{item.nombre}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[item.estado] ?? 'bg-gray-100 text-gray-600'}`}>{t(item.estado)}</span>
      </div>
      <p className="text-sm text-gray-600">📍 {[municipio, item.direccion].filter(Boolean).join(' · ')}</p>
      {libres !== null && <p className="mt-2 text-sm font-semibold text-gray-700">{td('cupos', { libres, total: item.capacidad })}</p>}
      {item.contacto_publico && <p className="mt-1 text-sm text-gray-600">☎️ {item.contacto_publico}</p>}
      <BotonesMaps direccion={item.direccion} municipioTexto={municipio} lat={item.lat} lng={item.lng} textoVer={tMaps('verUbicacion')} textoComoLlegar={tMaps('comoLlegar')} />
    </div>
  )
}
```

- [ ] **Step 2: Página** `src/app/[locale]/albergues/[id]/page.tsx` — plantilla "Página": `RUTA=albergues`, `obtenerAlbergue` (de `@/lib/datos/albergues`), `DetalleAlbergue`. Importar `nombreMunicipio` de `@/lib/datos/consultas`.

```tsx
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerAlbergue } from '@/lib/datos/albergues'
import { nombreMunicipio } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import DetalleAlbergue from '@/componentes/detalle/DetalleAlbergue'
import { metadatosDe } from '@/componentes/detalle/metadatos'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  return metadatosDe(await obtenerAlbergue(id))
}

export default async function Pagina({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerAlbergue(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/albergues" className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:underline">{td('volver')}</Link>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DetalleAlbergue item={item} municipio={municipio} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Intercept** `src/app/[locale]/@modal/(.)albergues/[id]/page.tsx`:

```tsx
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
```

- [ ] **Step 4: Verificar + Commit**

```bash
git add "src/componentes/detalle/DetalleAlbergue.tsx" "src/app/[locale]/albergues/[id]" "src/app/[locale]/@modal/(.)albergues"
git commit -m "feat: detalle abrible de albergues"
```

---

## FASE 5 — Servicios y Voluntarios (detalle simple)

### Task 21: `obtenerServicio` + `obtenerVoluntario`

**Files:**
- Modify: `src/lib/datos/consultas.ts`

- [ ] **Step 1: Implementar** (junto a `listarServicios`/`listarVoluntarios`)

```ts
export async function obtenerServicio(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('ofertas_servicios_publicas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function obtenerVoluntario(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('voluntarios_publicos').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 2: Typecheck + Commit**

```bash
npx tsc --noEmit
git add src/lib/datos/consultas.ts
git commit -m "feat: obtenerServicio + obtenerVoluntario"
```

---

### Task 22: Extraer `TarjetaServicio` + `TarjetaVoluntario` (clickeables)

**Files:**
- Create: `src/componentes/listas/TarjetaServicio.tsx`
- Create: `src/componentes/listas/TarjetaVoluntario.tsx`
- Modify: `src/app/[locale]/servicios/page.tsx`
- Modify: `src/app/[locale]/voluntarios/page.tsx`

- [ ] **Step 1: `TarjetaServicio.tsx`** (textos por props; el `tipo` traducido lo pasa la página)

```tsx
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
```

- [ ] **Step 2: `TarjetaVoluntario.tsx`** (habilidades ya traducidas por la página → `habilidadesTexto`)

```tsx
import { Link } from '@/i18n/navegacion'

type Voluntario = { id: string; habilidades: string[] | null; disponibilidad: string | null; municipio_id: string }

export default function TarjetaVoluntario({ v, habilidadesTexto, municipioTexto }: { v: Voluntario; habilidadesTexto: string; municipioTexto?: string }) {
  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/voluntarios/${v.id}`} aria-label={habilidadesTexto || 'Voluntario'} className="absolute inset-0 z-[1] rounded-lg" />
      <p className="text-sm">🛠️ {habilidadesTexto}</p>
      <p className="mt-1 text-xs text-gray-500">📍 {municipioTexto ?? v.municipio_id}{v.disponibilidad ? ` · ${v.disponibilidad}` : ''}</p>
    </article>
  )
}
```

- [ ] **Step 3: Usar en `servicios/page.tsx`** — reemplazar el `<article>` inline por:

```tsx
{servicios.map((s) => (
  <TarjetaServicio key={s.id} s={s} tipoTexto={t(`tiposServicio.${s.tipo}`)} municipioTexto={mapaMuni.get(s.municipio_id)} />
))}
```

Agregar `import TarjetaServicio from '@/componentes/listas/TarjetaServicio'`.

- [ ] **Step 4: Usar en `voluntarios/page.tsx`** — reemplazar el `<article>` inline por:

```tsx
{voluntarios.map((v) => (
  <TarjetaVoluntario
    key={v.id}
    v={v}
    habilidadesTexto={(v.habilidades ?? []).map((h: string) => t(`habilidades.${h}`)).join(', ')}
    municipioTexto={mapaMuni.get(v.municipio_id)}
  />
))}
```

Agregar `import TarjetaVoluntario from '@/componentes/listas/TarjetaVoluntario'`.

- [ ] **Step 5: Verificar + Commit**

```bash
git add "src/componentes/listas/TarjetaServicio.tsx" "src/componentes/listas/TarjetaVoluntario.tsx" "src/app/[locale]/servicios/page.tsx" "src/app/[locale]/voluntarios/page.tsx"
git commit -m "refactor: extraer TarjetaServicio y TarjetaVoluntario clickeables"
```

---

### Task 23: `DetalleServicio` + `DetalleVoluntario` + páginas + intercepts

**Files:**
- Create: `src/componentes/detalle/DetalleServicio.tsx`
- Create: `src/componentes/detalle/DetalleVoluntario.tsx`
- Create: `src/app/[locale]/servicios/[id]/page.tsx`
- Create: `src/app/[locale]/voluntarios/[id]/page.tsx`
- Create: `src/app/[locale]/@modal/(.)servicios/[id]/page.tsx`
- Create: `src/app/[locale]/@modal/(.)voluntarios/[id]/page.tsx`

- [ ] **Step 1: `DetalleServicio.tsx`**

```tsx
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
```

- [ ] **Step 2: `DetalleVoluntario.tsx`**

```tsx
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
```

- [ ] **Step 3: Páginas** — crear `servicios/[id]/page.tsx` y `voluntarios/[id]/page.tsx` con la plantilla "Página". Sustituciones:
  - Servicios: `RUTA=servicios`, `obtenerServicio`, `DetalleServicio`.
  - Voluntarios: `RUTA=voluntarios`, `obtenerVoluntario`, `DetalleVoluntario`.
  Ambos importan `obtenerX`/`nombreMunicipio` de `@/lib/datos/consultas`. Ejemplo servicios:

```tsx
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerServicio, nombreMunicipio } from '@/lib/datos/consultas'
import { Link } from '@/i18n/navegacion'
import DetalleServicio from '@/componentes/detalle/DetalleServicio'
import { metadatosDe } from '@/componentes/detalle/metadatos'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  return metadatosDe(await obtenerServicio(id))
}

export default async function Pagina({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerServicio(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/servicios" className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:underline">{td('volver')}</Link>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DetalleServicio item={item} municipio={municipio} />
      </div>
    </main>
  )
}
```

(Voluntarios idéntico cambiando `servicios→voluntarios`, `obtenerServicio→obtenerVoluntario`, `DetalleServicio→DetalleVoluntario`, `href="/voluntarios"`.)

- [ ] **Step 4: Intercepts** — crear `@modal/(.)servicios/[id]/page.tsx` y `@modal/(.)voluntarios/[id]/page.tsx` con la plantilla "Intercept" y las mismas sustituciones. Ejemplo servicios:

```tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { obtenerServicio, nombreMunicipio } from '@/lib/datos/consultas'
import Modal from '@/componentes/detalle/Modal'
import DetalleServicio from '@/componentes/detalle/DetalleServicio'

export default async function ModalServicio({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const item = await obtenerServicio(id)
  if (!item) notFound()
  const municipio = await nombreMunicipio(item.municipio_id)
  const td = await getTranslations('detalle')
  return (
    <Modal etiquetaCerrar={td('cerrarModal')}>
      <DetalleServicio item={item} municipio={municipio} />
    </Modal>
  )
}
```

(Voluntarios idéntico con las sustituciones.)

- [ ] **Step 5: Verificar en dev** — servicios y voluntarios abren modal/página; es/en.

- [ ] **Step 6: Commit**

```bash
git add "src/componentes/detalle/DetalleServicio.tsx" "src/componentes/detalle/DetalleVoluntario.tsx" "src/app/[locale]/servicios/[id]" "src/app/[locale]/voluntarios/[id]" "src/app/[locale]/@modal/(.)servicios" "src/app/[locale]/@modal/(.)voluntarios"
git commit -m "feat: detalle abrible de servicios y voluntarios"
```

---

## FASE 6 — Verificación final

### Task 24: Build + lint + tests + verificación integral

**Files:** ninguno.

- [ ] **Step 1: Suite de tests**

Run: `npm test`
Expected: PASS (unit + integración; el de paridad es/en debe pasar).

- [ ] **Step 2: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Build de producción**

Run: `npm run build`
Expected: compila sin errores (verifica que las rutas interceptoras/paralelas y las páginas `[id]` no rompan el build).

- [ ] **Step 4: Verificación manual integral** (con `npm run dev`), para los 7 listados:
- [ ] Clic en tarjeta → modal; URL cambia; foto completa donde aplica.
- [ ] `Esc`/fondo/✕ cierran; refresh en `/…/[id]` muestra página completa; navegar cierra modal.
- [ ] Contacto SOLO en mascotas, acopios, albergues; ausente en desaparecidos, necesidades, servicios, voluntarios.
- [ ] Necesidades: galería navega; mapa aparece con ubicación.
- [ ] Botones de acción de las tarjetas (WhatsApp/Llamar/Mapa) siguen funcionando sin abrir el modal.
- [ ] Pegar un link `/es/mascotas/<id>` en un chat muestra tarjeta OG con foto.
- [ ] Todo repetido en `/en/…`.

- [ ] **Step 5: Commit final** (si hubo ajustes) y preparar merge/PR con el skill `superpowers:finishing-a-development-branch`.

```bash
git commit -am "test: verificación integral del detalle de publicaciones" || echo "sin cambios"
```

---

## Notas de riesgo (de la spec)

- **next-intl + interceptación:** combinación algo quisquillosa. Si el modal no dispara o no cierra limpio con el prefijo `[locale]`, priorizar que las **páginas** funcionen (ya cumplen el objetivo) y ajustar el modal aparte. Verificar contra los docs de Next 16 en `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{intercepting-routes,parallel-routes}.md`.
- **Scroll lock:** el `Modal` restaura `document.body.style.overflow` al desmontar; verificar que no quede el body bloqueado tras navegación rápida.
- **Sin cambios de BD:** si algún `obtener<X>` devuelve error de permisos, es señal de estar consultando la tabla base en vez de la vista pública — revisar el `from(...)`.
```
