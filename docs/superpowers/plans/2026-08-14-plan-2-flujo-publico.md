# Plan 2 — Flujo Público (formularios + listas)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquier persona, sin registrarse, pueda reportar una necesidad / ofrecerse como voluntario / ofrecer un servicio (queda "sin verificar"), y que cualquiera pueda navegar listas públicas de necesidades, acopios, voluntarios y servicios con filtros por ciudad, categoría y estado.

**Architecture:** Sobre la fundación del Plan 1. Validación con **zod** (esquemas compartidos cliente/servidor). Las escrituras van por **Server Actions** de Next que insertan con el cliente anónimo de Supabase (el RLS ya garantiza que entran como `sin_verificar` y que nadie lea contactos). Las lecturas son **Server Components** que consultan las **vistas públicas** (sin datos de contacto) y filtran por query params en la URL. Anti-bot con honeypot. Fotos y rate-limiting por IP quedan fuera de este plan (anotados).

**Tech Stack:** Next.js 16 (App Router, Server Actions, `useActionState`) · Supabase (cliente anónimo, RLS) · zod · next-intl · Vitest.

**Spec:** `docs/superpowers/specs/2026-08-14-plataforma-ayuda-humanitaria-design.md` (§4 modelo, §5 flujo, §6 pantallas, §10 errores).
**Base:** Plan 1 completo (`fundacion-v1`): vistas `solicitudes_publicas`, `voluntarios_publicos`, `ofertas_servicios_publicas`; tabla `centros_acopio` y `municipios` legibles por anónimo; políticas de INSERT para anónimo en `solicitudes_ayuda`, `voluntarios`, `ofertas_servicios`; i18n ES/EN; `src/lib/estados.ts`.

**Roadmap (plan 2 de 5):** 1) Fundación ✓ · 2) Flujo público ← este · 3) Moderación y organizaciones · 4) Visualizador de focos + mapa + tiempo real · 5) Estadísticas + campañas + despliegue.

---

## Estructura de archivos que crea este plan

```
src/lib/validacion/esquemas.ts        ← esquemas zod + helper de errores por campo
src/lib/formato.ts                    ← tiempoRelativo() bilingüe
src/lib/datos/consultas.ts            ← lecturas de vistas públicas (listar*)
src/lib/datos/reportar.ts             ← inserciones validadas (crear*)
src/componentes/formularios/
    Campo.tsx                         ← wrapper etiqueta + error
    SelectCatalogo.tsx                ← select genérico (municipios/categorías/…)
    Honeypot.tsx                      ← campo trampa anti-bot
    BotonEnviar.tsx                   ← botón con estado pendiente
src/componentes/listas/
    TarjetaNecesidad.tsx  BarraFiltros.tsx  Vacio.tsx  Sello.tsx
src/app/[locale]/reportar/necesidad/{page.tsx,acciones.ts,formulario.tsx}
src/app/[locale]/reportar/voluntario/{page.tsx,acciones.ts,formulario.tsx}
src/app/[locale]/reportar/servicio/{page.tsx,acciones.ts,formulario.tsx}
src/app/[locale]/necesidades/page.tsx
src/app/[locale]/acopios/page.tsx
src/app/[locale]/voluntarios/page.tsx
src/app/[locale]/servicios/page.tsx
src/componentes/Navegacion.tsx        ← barra de navegación bilingüe
tests/unit/validacion.test.ts   tests/unit/formato.test.ts
tests/integracion/datos.test.ts       ← lecturas e inserciones vs Supabase real
```

Se modifican `src/messages/es.json`, `src/messages/en.json` (nuevas claves) y `src/app/[locale]/page.tsx` (CTAs de inicio enlazan a formularios/listas).

---

### Task 1: Validación con zod

**Files:**
- Create: `src/lib/validacion/esquemas.ts`, `tests/unit/validacion.test.ts`
- Modify: `package.json` (dep `zod`)

- [ ] **Step 1: Instalar zod**

Run: `npm install zod`
Expected: sin vulnerabilidades; `zod` aparece en `dependencies`.

- [ ] **Step 2: Escribir el test que falla** — `tests/unit/validacion.test.ts`

```ts
import { describe, test, expect } from 'vitest'
import {
  esquemaNecesidad,
  esquemaVoluntario,
  esquemaServicio,
  erroresPorCampo,
} from '../../src/lib/validacion/esquemas'

describe('esquemaNecesidad', () => {
  const base = {
    categoria: 'agua',
    descripcion: 'Familia sin agua potable en la vereda hace tres días',
    urgencia: 'alta',
    municipio_id: '27001',
    contacto_nombre: 'María',
    contacto_telefono: '+57 300 1234567',
  }
  test('acepta un reporte válido', () => {
    expect(esquemaNecesidad.safeParse(base).success).toBe(true)
  })
  test('rechaza descripción demasiado corta', () => {
    const r = esquemaNecesidad.safeParse({ ...base, descripcion: 'corto' })
    expect(r.success).toBe(false)
  })
  test('rechaza categoría inválida', () => {
    const r = esquemaNecesidad.safeParse({ ...base, categoria: 'zzz' })
    expect(r.success).toBe(false)
  })
  test('convierte personas_afectadas de texto a número', () => {
    const r = esquemaNecesidad.safeParse({ ...base, personas_afectadas: '4' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.personas_afectadas).toBe(4)
  })
})

describe('esquemaVoluntario', () => {
  test('exige al menos una habilidad', () => {
    const r = esquemaVoluntario.safeParse({
      nombre: 'Juan', habilidades: [], municipio_id: '17001', contacto_telefono: '3001234567',
    })
    expect(r.success).toBe(false)
  })
})

describe('esquemaServicio', () => {
  test('acepta un servicio válido', () => {
    const r = esquemaServicio.safeParse({
      tipo: 'alojamiento',
      descripcion: 'Tengo dos habitaciones disponibles para familias',
      municipio_id: '66001',
      contacto_nombre: 'Ana',
      contacto_telefono: '3009876543',
    })
    expect(r.success).toBe(true)
  })
})

describe('erroresPorCampo', () => {
  test('agrupa los mensajes por nombre de campo', () => {
    const r = esquemaNecesidad.safeParse({ categoria: 'agua', descripcion: 'x' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const errs = erroresPorCampo(r.error)
      expect(Object.keys(errs)).toContain('descripcion')
      expect(Object.keys(errs)).toContain('municipio_id')
    }
  })
})
```

Run: `npm test -- tests/unit/validacion.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar** `src/lib/validacion/esquemas.ts`

```ts
import { z } from 'zod'

export const CATEGORIAS = [
  'alimentos', 'agua', 'albergue', 'materiales_construccion',
  'remocion_escombros', 'salud', 'rescate', 'otro',
] as const
export const URGENCIAS = ['alta', 'media', 'baja'] as const
export const HABILIDADES = [
  'medico', 'psicologo', 'remocion_escombros', 'logistica',
  'transporte', 'construccion', 'otro',
] as const
export const TIPOS_SERVICIO = ['alojamiento', 'transporte', 'maquinaria', 'bodega', 'otro'] as const

const telefono = z.string().trim().min(7).max(30)
const nombre = z.string().trim().min(2).max(120)
const opcionalTexto = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

export const esquemaNecesidad = z.object({
  categoria: z.enum(CATEGORIAS),
  descripcion: z.string().trim().min(10).max(2000),
  personas_afectadas: z.coerce.number().int().positive().max(100000).optional(),
  urgencia: z.enum(URGENCIAS),
  municipio_id: z.string().trim().min(1),
  detalle_ubicacion: opcionalTexto(500),
  contacto_nombre: nombre,
  contacto_telefono: telefono,
})

export const esquemaVoluntario = z.object({
  nombre: nombre,
  habilidades: z.array(z.enum(HABILIDADES)).min(1),
  disponibilidad: opcionalTexto(300),
  municipio_id: z.string().trim().min(1),
  contacto_telefono: telefono,
})

export const esquemaServicio = z.object({
  tipo: z.enum(TIPOS_SERVICIO),
  descripcion: z.string().trim().min(10).max(2000),
  capacidad: opcionalTexto(200),
  municipio_id: z.string().trim().min(1),
  contacto_nombre: nombre,
  contacto_telefono: telefono,
})

export type DatosNecesidad = z.infer<typeof esquemaNecesidad>
export type DatosVoluntario = z.infer<typeof esquemaVoluntario>
export type DatosServicio = z.infer<typeof esquemaServicio>

// Robusto entre versiones de zod (usa .issues, presente en v3 y v4).
export function erroresPorCampo(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const campo = issue.path.join('.') || '_'
    ;(out[campo] ??= []).push(issue.message)
  }
  return out
}
```

Run: `npm test -- tests/unit/validacion.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/validacion/esquemas.ts tests/unit/validacion.test.ts
git commit -m "feat: esquemas de validación zod para los formularios públicos (TDD)"
```

---

### Task 2: Formato de tiempo relativo bilingüe

**Files:**
- Create: `src/lib/formato.ts`, `tests/unit/formato.test.ts`

- [ ] **Step 1: Test que falla** — `tests/unit/formato.test.ts`

```ts
import { test, expect } from 'vitest'
import { tiempoRelativo } from '../../src/lib/formato'

const ahora = new Date('2026-08-14T12:00:00Z')

test('minutos en español', () => {
  const hace5 = new Date('2026-08-14T11:55:00Z')
  expect(tiempoRelativo(hace5, 'es', ahora)).toMatch(/5 min/)
})
test('horas en inglés', () => {
  const hace3h = new Date('2026-08-14T09:00:00Z')
  expect(tiempoRelativo(hace3h, 'en', ahora)).toMatch(/3 hr|3 hours/)
})
test('acepta fecha en texto ISO', () => {
  expect(tiempoRelativo('2026-08-14T11:00:00Z', 'es', ahora)).toMatch(/1 h|1 hora/)
})
```

Run: `npm test -- tests/unit/formato.test.ts` → FAIL.

- [ ] **Step 2: Implementar** `src/lib/formato.ts`

```ts
type Locale = 'es' | 'en'

const RANGOS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [3600, 'minute'],
  [86400, 'hour'],
  [604800, 'day'],
  [2629800, 'week'],
  [31557600, 'month'],
  [Infinity, 'year'],
]

const DIVISOR: Record<Intl.RelativeTimeFormatUnit, number> = {
  second: 1, minute: 60, hour: 3600, day: 86400,
  week: 604800, month: 2629800, quarter: 7889400, year: 31557600,
}

export function tiempoRelativo(fecha: string | Date, locale: Locale, ahora: Date = new Date()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  const seg = Math.round((ahora.getTime() - d.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  for (const [limite, unidad] of RANGOS) {
    if (Math.abs(seg) < limite) {
      const valor = Math.round(seg / DIVISOR[unidad])
      return rtf.format(-valor, unidad)
    }
  }
  return rtf.format(-Math.round(seg / DIVISOR.year), 'year')
}
```

Run: `npm test -- tests/unit/formato.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/formato.ts tests/unit/formato.test.ts
git commit -m "feat: formateo de tiempo relativo bilingüe (TDD)"
```

---

### Task 3: Capa de datos (lecturas e inserciones) + tests de integración

**Files:**
- Create: `src/lib/datos/consultas.ts`, `src/lib/datos/reportar.ts`, `tests/integracion/datos.test.ts`

- [ ] **Step 1: Lecturas** — `src/lib/datos/consultas.ts`

```ts
import { crearClienteAnonimo } from '@/lib/supabase/cliente'

export type FiltrosNecesidades = { municipio?: string; categoria?: string; estado?: string }
export type FiltrosSimple = { municipio?: string }

export async function listarMunicipios() {
  const sb = crearClienteAnonimo()
  const { data, error } = await sb
    .from('municipios')
    .select('codigo_dane, nombre, departamento')
    .order('departamento', { ascending: true })
    .order('nombre', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listarNecesidades(f: FiltrosNecesidades = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('solicitudes_publicas').select('*').order('creada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  if (f.categoria) q = q.eq('categoria', f.categoria)
  if (f.estado) q = q.eq('estado', f.estado)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listarAcopios(f: FiltrosSimple = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('centros_acopio').select('*').order('actualizada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listarVoluntarios(f: FiltrosSimple = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('voluntarios_publicos').select('*').order('creada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listarServicios(f: FiltrosSimple = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('ofertas_servicios_publicas').select('*').order('creada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}
```

- [ ] **Step 2: Inserciones validadas** — `src/lib/datos/reportar.ts`

```ts
import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import {
  esquemaNecesidad, esquemaVoluntario, esquemaServicio, erroresPorCampo,
} from '@/lib/validacion/esquemas'

export type Resultado =
  | { ok: true }
  | { ok: false; errores: Record<string, string[]> }

export async function crearNecesidad(entrada: unknown): Promise<Resultado> {
  const p = esquemaNecesidad.safeParse(entrada)
  if (!p.success) return { ok: false, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('solicitudes_ayuda').insert({ ...p.data, estado: 'sin_verificar' })
  if (error) return { ok: false, errores: { _: [error.message] } }
  return { ok: true }
}

export async function crearVoluntario(entrada: unknown): Promise<Resultado> {
  const p = esquemaVoluntario.safeParse(entrada)
  if (!p.success) return { ok: false, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('voluntarios').insert({ ...p.data, estado: 'disponible' })
  if (error) return { ok: false, errores: { _: [error.message] } }
  return { ok: true }
}

export async function crearServicio(entrada: unknown): Promise<Resultado> {
  const p = esquemaServicio.safeParse(entrada)
  if (!p.success) return { ok: false, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('ofertas_servicios').insert({ ...p.data, estado: 'disponible' })
  if (error) return { ok: false, errores: { _: [error.message] } }
  return { ok: true }
}
```

- [ ] **Step 3: Test de integración** — `tests/integracion/datos.test.ts` (corre contra Supabase real)

```ts
import { describe, test, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { listarMunicipios, listarNecesidades } from '../../src/lib/datos/consultas'
import { crearNecesidad, crearVoluntario } from '../../src/lib/datos/reportar'

const MARCA = 'PRUEBA INTEGRACION —'

describe('lecturas públicas', () => {
  test('lista municipios (>= 25)', async () => {
    const m = await listarMunicipios()
    expect(m.length).toBeGreaterThanOrEqual(25)
    expect(m[0]).toHaveProperty('codigo_dane')
  })
  test('lista necesidades y NUNCA expone contacto', async () => {
    const n = await listarNecesidades()
    for (const fila of n) {
      expect(fila).not.toHaveProperty('contacto_telefono')
      expect(fila).not.toHaveProperty('contacto_nombre')
    }
  })
  test('filtra necesidades por municipio sin error', async () => {
    const n = await listarNecesidades({ municipio: '17001' })
    expect(Array.isArray(n)).toBe(true)
  })
})

describe('inserciones validadas', () => {
  test('crea una necesidad válida', async () => {
    const r = await crearNecesidad({
      categoria: 'agua',
      descripcion: `${MARCA} familia sin agua potable en zona rural`,
      urgencia: 'alta',
      municipio_id: '27001',
      contacto_nombre: 'Prueba',
      contacto_telefono: '+57 300 0000000',
    })
    expect(r.ok).toBe(true)
  })
  test('rechaza una necesidad inválida con errores por campo', async () => {
    const r = await crearNecesidad({ categoria: 'agua', descripcion: 'x' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.descripcion).toBeDefined()
  })
  test('crea un voluntario válido', async () => {
    const r = await crearVoluntario({
      nombre: `${MARCA} Juan`,
      habilidades: ['remocion_escombros'],
      municipio_id: '17001',
      contacto_telefono: '3001112222',
    })
    expect(r.ok).toBe(true)
  })
})

afterAll(async () => {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave) return
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, llave)
  await admin.from('solicitudes_ayuda').delete().like('descripcion', `${MARCA}%`)
  await admin.from('voluntarios').delete().like('nombre', `${MARCA}%`)
})
```

Run: `npm test -- tests/integracion/datos.test.ts` → PASS (6 tests). Requiere migraciones aplicadas (Plan 1) y `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/datos tests/integracion/datos.test.ts
git commit -m "feat: capa de datos pública (lecturas de vistas + inserciones validadas) con tests de integración"
```

---

### Task 4: Mensajes i18n para formularios y listas

**Files:**
- Modify: `src/messages/es.json`, `src/messages/en.json` (el test de paridad existente los valida)

- [ ] **Step 1: Añadir bloques a `src/messages/es.json`**

Agregar estas claves de primer nivel (junto a las existentes `comun`, `nav`, `inicio`, `categorias`, `estados`):

```json
"acciones": {
  "reportarNecesidad": "Reportar una necesidad",
  "ofrecerVoluntariado": "Ofrecerme como voluntario",
  "ofrecerServicio": "Ofrecer un servicio",
  "enviar": "Enviar",
  "enviando": "Enviando…",
  "verNecesidades": "Ver necesidades",
  "verAcopios": "Ver centros de acopio",
  "verVoluntarios": "Ver voluntarios",
  "verServicios": "Ver servicios"
},
"campos": {
  "categoria": "Categoría",
  "descripcion": "Descripción",
  "personasAfectadas": "Personas afectadas",
  "urgencia": "Urgencia",
  "municipio": "Municipio",
  "detalleUbicacion": "Detalle de la ubicación",
  "contactoNombre": "Tu nombre",
  "contactoTelefono": "Teléfono de contacto",
  "telefonoPrivado": "Tu teléfono no se muestra al público; solo lo ven los moderadores para verificar.",
  "nombre": "Nombre",
  "habilidades": "Habilidades",
  "disponibilidad": "Disponibilidad",
  "tipoServicio": "Tipo de servicio",
  "capacidad": "Capacidad",
  "obligatorio": "obligatorio",
  "opcional": "opcional"
},
"habilidades": {
  "medico": "Médico",
  "psicologo": "Psicólogo",
  "remocion_escombros": "Remoción de escombros",
  "logistica": "Logística",
  "transporte": "Transporte",
  "construccion": "Construcción",
  "otro": "Otro"
},
"tiposServicio": {
  "alojamiento": "Alojamiento",
  "transporte": "Transporte",
  "maquinaria": "Maquinaria",
  "bodega": "Bodega",
  "otro": "Otro"
},
"urgencias": {
  "alta": "Alta",
  "media": "Media",
  "baja": "Baja"
},
"listas": {
  "tituloNecesidades": "Necesidades reportadas",
  "tituloAcopios": "Centros de acopio",
  "tituloVoluntarios": "Voluntarios disponibles",
  "tituloServicios": "Servicios ofrecidos",
  "filtroTodos": "Todos",
  "filtroMunicipio": "Ciudad / municipio",
  "filtroCategoria": "Categoría",
  "filtroEstado": "Estado",
  "vacio": "No hay resultados con estos filtros todavía.",
  "personas": "{n} personas",
  "recibe": "Recibe",
  "noNecesita": "Ya no necesita"
},
"formulario": {
  "gracias": "¡Gracias! Tu reporte quedó registrado como \"sin verificar\". Un moderador lo revisará pronto.",
  "error": "No se pudo enviar. Revisa los campos e intenta de nuevo.",
  "elige": "Elige una opción"
}
```

- [ ] **Step 2: Añadir los mismos bloques (traducidos) a `src/messages/en.json`**

```json
"acciones": {
  "reportarNecesidad": "Report a need",
  "ofrecerVoluntariado": "Volunteer",
  "ofrecerServicio": "Offer a service",
  "enviar": "Submit",
  "enviando": "Submitting…",
  "verNecesidades": "View needs",
  "verAcopios": "View donation centers",
  "verVoluntarios": "View volunteers",
  "verServicios": "View services"
},
"campos": {
  "categoria": "Category",
  "descripcion": "Description",
  "personasAfectadas": "People affected",
  "urgencia": "Urgency",
  "municipio": "Municipality",
  "detalleUbicacion": "Location details",
  "contactoNombre": "Your name",
  "contactoTelefono": "Contact phone",
  "telefonoPrivado": "Your phone is never shown publicly; only moderators see it to verify.",
  "nombre": "Name",
  "habilidades": "Skills",
  "disponibilidad": "Availability",
  "tipoServicio": "Service type",
  "capacidad": "Capacity",
  "obligatorio": "required",
  "opcional": "optional"
},
"habilidades": {
  "medico": "Doctor",
  "psicologo": "Psychologist",
  "remocion_escombros": "Debris removal",
  "logistica": "Logistics",
  "transporte": "Transport",
  "construccion": "Construction",
  "otro": "Other"
},
"tiposServicio": {
  "alojamiento": "Lodging",
  "transporte": "Transport",
  "maquinaria": "Machinery",
  "bodega": "Warehouse",
  "otro": "Other"
},
"urgencias": {
  "alta": "High",
  "media": "Medium",
  "baja": "Low"
},
"listas": {
  "tituloNecesidades": "Reported needs",
  "tituloAcopios": "Donation centers",
  "tituloVoluntarios": "Available volunteers",
  "tituloServicios": "Offered services",
  "filtroTodos": "All",
  "filtroMunicipio": "City / municipality",
  "filtroCategoria": "Category",
  "filtroEstado": "Status",
  "vacio": "No results with these filters yet.",
  "personas": "{n} people",
  "recibe": "Accepts",
  "noNecesita": "No longer needs"
},
"formulario": {
  "gracias": "Thank you! Your report was recorded as \"unverified\". A moderator will review it soon.",
  "error": "Could not submit. Please check the fields and try again.",
  "elige": "Choose an option"
}
```

- [ ] **Step 3: Verificar paridad**

Run: `npm test -- tests/unit/mensajes-paridad.test.ts` → PASS (mismas claves ES/EN).

- [ ] **Step 4: Commit**

```bash
git add src/messages/es.json src/messages/en.json
git commit -m "i18n: claves de formularios y listas del flujo público"
```

---

### Task 5: Componentes de formulario reutilizables

**Files:**
- Create: `src/componentes/formularios/Campo.tsx`, `SelectCatalogo.tsx`, `Honeypot.tsx`, `BotonEnviar.tsx`

- [ ] **Step 1: `Campo.tsx`** (etiqueta + errores, server-safe)

```tsx
export default function Campo({
  etiqueta, htmlFor, requerido, ayuda, errores, children,
}: {
  etiqueta: string
  htmlFor: string
  requerido?: boolean
  ayuda?: string
  errores?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
        {etiqueta} {requerido && <span className="text-red-600">*</span>}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-gray-500">{ayuda}</p>}
      {errores?.map((e) => (
        <p key={e} className="mt-1 text-xs text-red-600">{e}</p>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `SelectCatalogo.tsx`** (select genérico)

```tsx
export type Opcion = { valor: string; texto: string }

export default function SelectCatalogo({
  id, name, opciones, placeholder, defaultValue, requerido,
}: {
  id: string
  name: string
  opciones: Opcion[]
  placeholder: string
  defaultValue?: string
  requerido?: boolean
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue ?? ''}
      required={requerido}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
    >
      <option value="" disabled={requerido}>{placeholder}</option>
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>{o.texto}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 3: `Honeypot.tsx`** (campo trampa; oculto a humanos, tentador para bots)

```tsx
export default function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px]" tabIndex={-1}>
      <label htmlFor="sitio_web">No llenar</label>
      <input id="sitio_web" name="sitio_web" type="text" autoComplete="off" tabIndex={-1} />
    </div>
  )
}
```

- [ ] **Step 4: `BotonEnviar.tsx`** (client component con estado pendiente)

```tsx
'use client'
import { useFormStatus } from 'react-dom'

export default function BotonEnviar({ texto, textoEnviando }: { texto: string; textoEnviando: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-blue-700 px-5 py-2.5 font-bold text-white disabled:opacity-60"
    >
      {pending ? textoEnviando : texto}
    </button>
  )
}
```

- [ ] **Step 5: Verificar que compila** (no hay test unitario de UI; el build de la Task 9 los ejercita)

Run: `npx tsc --noEmit` → sin errores nuevos en estos archivos.

- [ ] **Step 6: Commit**

```bash
git add src/componentes/formularios
git commit -m "feat: componentes reutilizables de formulario (campo, select, honeypot, botón)"
```

---

### Task 6: Reportar necesidad (server action + página + formulario)

**Files:**
- Create: `src/app/[locale]/reportar/necesidad/acciones.ts`, `formulario.tsx`, `page.tsx`

- [ ] **Step 1: Server action** — `acciones.ts`

```ts
'use server'
import { crearNecesidad } from '@/lib/datos/reportar'

export type EstadoFormulario = {
  enviado: boolean
  errores?: Record<string, string[]>
}

export async function accionReportarNecesidad(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true } // bot: descartar en silencio
  const entrada = {
    categoria: formData.get('categoria'),
    descripcion: formData.get('descripcion'),
    personas_afectadas: (formData.get('personas_afectadas') as string) || undefined,
    urgencia: formData.get('urgencia'),
    municipio_id: formData.get('municipio_id'),
    detalle_ubicacion: (formData.get('detalle_ubicacion') as string) || undefined,
    contacto_nombre: formData.get('contacto_nombre'),
    contacto_telefono: formData.get('contacto_telefono'),
  }
  const res = await crearNecesidad(entrada)
  if (!res.ok) return { enviado: false, errores: res.errores }
  return { enviado: true }
}
```

- [ ] **Step 2: Formulario (client)** — `formulario.tsx`

```tsx
'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionReportarNecesidad, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import { CATEGORIAS, URGENCIAS } from '@/lib/validacion/esquemas'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioNecesidad({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionReportarNecesidad, inicial)

  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('formulario.gracias')}</p>
  }

  const cats: Opcion[] = CATEGORIAS.map((c) => ({ valor: c, texto: t(`categorias.${c}`) }))
  const urgs: Opcion[] = URGENCIAS.map((u) => ({ valor: u, texto: t(`urgencias.${u}`) }))
  const e = estado.errores ?? {}

  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('campos.categoria')} htmlFor="categoria" requerido errores={e.categoria}>
        <SelectCatalogo id="categoria" name="categoria" opciones={cats} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.urgencia')} htmlFor="urgencia" requerido errores={e.urgencia}>
        <SelectCatalogo id="urgencia" name="urgencia" opciones={urgs} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" requerido errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.descripcion')} htmlFor="descripcion" requerido errores={e.descripcion}>
        <textarea id="descripcion" name="descripcion" rows={4} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.personasAfectadas')} htmlFor="personas_afectadas" errores={e.personas_afectadas}>
        <input id="personas_afectadas" name="personas_afectadas" type="number" min={1}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.detalleUbicacion')} htmlFor="detalle_ubicacion" errores={e.detalle_ubicacion}>
        <input id="detalle_ubicacion" name="detalle_ubicacion" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.contactoNombre')} htmlFor="contacto_nombre" requerido errores={e.contacto_nombre}>
        <input id="contacto_nombre" name="contacto_nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.contactoTelefono')} htmlFor="contacto_telefono" requerido
        ayuda={t('campos.telefonoPrivado')} errores={e.contacto_telefono}>
        <input id="contacto_telefono" name="contacto_telefono" type="tel" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
      <BotonEnviar texto={t('acciones.enviar')} textoEnviando={t('acciones.enviando')} />
    </form>
  )
}
```

- [ ] **Step 3: Página (server)** — `page.tsx`

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioNecesidad from './formulario'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('acciones')
  const municipios = (await listarMunicipios()).map((m) => ({
    valor: m.codigo_dane,
    texto: `${m.nombre} — ${m.departamento}`,
  }))
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-extrabold">{t('reportarNecesidad')}</h1>
      <FormularioNecesidad municipios={municipios} />
    </main>
  )
}
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev > /tmp/p2dev.log 2>&1 &
sleep 8
curl -s -o /dev/null -w "necesidad ES=%{http_code}\n" http://localhost:3000/es/reportar/necesidad
curl -s http://localhost:3000/es/reportar/necesidad | grep -o "Reportar una necesidad" | head -1
pkill -f "next dev"; pkill -f "next-server"
```
Expected: `necesidad ES=200` y el grep encuentra el título. Matar el server al final.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/reportar/necesidad"
git commit -m "feat: formulario público para reportar una necesidad (server action + validación)"
```

---

### Task 7: Reportar voluntario y servicio

**Files:**
- Create: `src/app/[locale]/reportar/voluntario/{acciones.ts,formulario.tsx,page.tsx}`, `src/app/[locale]/reportar/servicio/{acciones.ts,formulario.tsx,page.tsx}`

- [ ] **Step 1: Voluntario — `acciones.ts`**

```ts
'use server'
import { crearVoluntario } from '@/lib/datos/reportar'
export type EstadoFormulario = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionReportarVoluntario(
  _prev: EstadoFormulario, formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true }
  const entrada = {
    nombre: formData.get('nombre'),
    habilidades: formData.getAll('habilidades'),
    disponibilidad: (formData.get('disponibilidad') as string) || undefined,
    municipio_id: formData.get('municipio_id'),
    contacto_telefono: formData.get('contacto_telefono'),
  }
  const res = await crearVoluntario(entrada)
  return res.ok ? { enviado: true } : { enviado: false, errores: res.errores }
}
```

- [ ] **Step 2: Voluntario — `formulario.tsx`**

```tsx
'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionReportarVoluntario, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import { HABILIDADES } from '@/lib/validacion/esquemas'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioVoluntario({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionReportarVoluntario, inicial)
  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('formulario.gracias')}</p>
  }
  const e = estado.errores ?? {}
  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('campos.nombre')} htmlFor="nombre" requerido errores={e.nombre}>
        <input id="nombre" name="nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.habilidades')} htmlFor="habilidades" requerido errores={e.habilidades}>
        <div className="grid grid-cols-2 gap-2">
          {HABILIDADES.map((h) => (
            <label key={h} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="habilidades" value={h} /> {t(`habilidades.${h}`)}
            </label>
          ))}
        </div>
      </Campo>
      <Campo etiqueta={t('campos.disponibilidad')} htmlFor="disponibilidad" errores={e.disponibilidad}>
        <input id="disponibilidad" name="disponibilidad" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" requerido errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.contactoTelefono')} htmlFor="contacto_telefono" requerido
        ayuda={t('campos.telefonoPrivado')} errores={e.contacto_telefono}>
        <input id="contacto_telefono" name="contacto_telefono" type="tel" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
      <BotonEnviar texto={t('acciones.enviar')} textoEnviando={t('acciones.enviando')} />
    </form>
  )
}
```

- [ ] **Step 3: Voluntario — `page.tsx`**

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioVoluntario from './formulario'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('acciones')
  const municipios = (await listarMunicipios()).map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-extrabold">{t('ofrecerVoluntariado')}</h1>
      <FormularioVoluntario municipios={municipios} />
    </main>
  )
}
```

- [ ] **Step 4: Servicio — `acciones.ts`**

```ts
'use server'
import { crearServicio } from '@/lib/datos/reportar'
export type EstadoFormulario = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionReportarServicio(
  _prev: EstadoFormulario, formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true }
  const entrada = {
    tipo: formData.get('tipo'),
    descripcion: formData.get('descripcion'),
    capacidad: (formData.get('capacidad') as string) || undefined,
    municipio_id: formData.get('municipio_id'),
    contacto_nombre: formData.get('contacto_nombre'),
    contacto_telefono: formData.get('contacto_telefono'),
  }
  const res = await crearServicio(entrada)
  return res.ok ? { enviado: true } : { enviado: false, errores: res.errores }
}
```

- [ ] **Step 5: Servicio — `formulario.tsx`**

```tsx
'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionReportarServicio, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import { TIPOS_SERVICIO } from '@/lib/validacion/esquemas'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioServicio({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionReportarServicio, inicial)
  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('formulario.gracias')}</p>
  }
  const tipos: Opcion[] = TIPOS_SERVICIO.map((s) => ({ valor: s, texto: t(`tiposServicio.${s}`) }))
  const e = estado.errores ?? {}
  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('campos.tipoServicio')} htmlFor="tipo" requerido errores={e.tipo}>
        <SelectCatalogo id="tipo" name="tipo" opciones={tipos} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.descripcion')} htmlFor="descripcion" requerido errores={e.descripcion}>
        <textarea id="descripcion" name="descripcion" rows={4} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.capacidad')} htmlFor="capacidad" errores={e.capacidad}>
        <input id="capacidad" name="capacidad" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" requerido errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.contactoNombre')} htmlFor="contacto_nombre" requerido errores={e.contacto_nombre}>
        <input id="contacto_nombre" name="contacto_nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.contactoTelefono')} htmlFor="contacto_telefono" requerido
        ayuda={t('campos.telefonoPrivado')} errores={e.contacto_telefono}>
        <input id="contacto_telefono" name="contacto_telefono" type="tel" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
      <BotonEnviar texto={t('acciones.enviar')} textoEnviando={t('acciones.enviando')} />
    </form>
  )
}
```

- [ ] **Step 6: Servicio — `page.tsx`**

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioServicio from './formulario'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('acciones')
  const municipios = (await listarMunicipios()).map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-extrabold">{t('ofrecerServicio')}</h1>
      <FormularioServicio municipios={municipios} />
    </main>
  )
}
```

- [ ] **Step 7: Smoke test**

```bash
npm run dev > /tmp/p2dev.log 2>&1 &
sleep 8
curl -s -o /dev/null -w "voluntario=%{http_code} servicio=%{http_code}\n" http://localhost:3000/es/reportar/voluntario
curl -s -o /dev/null -w "servicio EN=%{http_code}\n" http://localhost:3000/en/reportar/servicio
pkill -f "next dev"; pkill -f "next-server"
```
Expected: ambos `200`. Matar el server.

- [ ] **Step 8: Commit**

```bash
git add "src/app/[locale]/reportar/voluntario" "src/app/[locale]/reportar/servicio"
git commit -m "feat: formularios públicos de voluntariado y servicios"
```

---

### Task 8: Listas públicas con filtros

**Files:**
- Create: `src/componentes/listas/Sello.tsx`, `TarjetaNecesidad.tsx`, `BarraFiltros.tsx`, `Vacio.tsx`
- Create: `src/app/[locale]/necesidades/page.tsx`, `acopios/page.tsx`, `voluntarios/page.tsx`, `servicios/page.tsx`

- [ ] **Step 1: `Sello.tsx`** (badge de estado con color)

```tsx
import { useTranslations } from 'next-intl'

const COLOR: Record<string, string> = {
  sin_verificar: 'bg-gray-200 text-gray-700',
  verificada: 'bg-blue-100 text-blue-800',
  en_atencion: 'bg-purple-100 text-purple-800',
  resuelta: 'bg-green-100 text-green-800',
  por_reconfirmar: 'bg-amber-100 text-amber-800',
}

export default function Sello({ estado }: { estado: string }) {
  const t = useTranslations('estados')
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR[estado] ?? 'bg-gray-100 text-gray-600'}`}>
      {estado === 'verificada' ? '✓ ' : ''}{t(estado)}
    </span>
  )
}
```

- [ ] **Step 2: `TarjetaNecesidad.tsx`**

```tsx
import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'
import Sello from './Sello'

type Necesidad = {
  id: string; categoria: string; descripcion: string; urgencia: string
  estado: string; municipio_id: string; personas_afectadas: number | null
  creada_en: string
}

export default function TarjetaNecesidad({ n, municipio }: { n: Necesidad; municipio?: string }) {
  const t = useTranslations()
  const locale = useLocale() as 'es' | 'en'
  const borde = n.urgencia === 'alta' ? 'border-l-red-500' : n.urgencia === 'media' ? 'border-l-amber-500' : 'border-l-gray-300'
  return (
    <article className={`rounded-lg border border-gray-200 border-l-4 ${borde} bg-white p-4 shadow-sm`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold">{t(`categorias.${n.categoria}`)}</span>
        <Sello estado={n.estado} />
      </div>
      <p className="text-sm text-gray-700">{n.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>📍 {municipio ?? n.municipio_id}</span>
        {n.personas_afectadas != null && <span>👥 {t('listas.personas', { n: n.personas_afectadas })}</span>}
        <span>🕓 {tiempoRelativo(n.creada_en, locale)}</span>
      </div>
    </article>
  )
}
```

- [ ] **Step 3: `Vacio.tsx`** y `BarraFiltros.tsx`

`Vacio.tsx`:
```tsx
import { useTranslations } from 'next-intl'
export default function Vacio() {
  const t = useTranslations('listas')
  return <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('vacio')}</p>
}
```

`BarraFiltros.tsx` (client; actualiza la URL sin recargar):
```tsx
'use client'
import { useRouter, usePathname } from '@/i18n/navegacion'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Opcion } from '@/componentes/formularios/SelectCatalogo'

export default function BarraFiltros({
  municipios, categorias,
}: { municipios: Opcion[]; categorias?: Opcion[] }) {
  const t = useTranslations('listas')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function cambiar(clave: string, valor: string) {
    const p = new URLSearchParams(params.toString())
    if (valor) p.set(clave, valor); else p.delete(clave)
    router.replace(`${pathname}?${p.toString()}`)
  }

  const sel = 'rounded-lg border border-gray-300 px-3 py-2 text-sm'
  return (
    <div className="mb-5 flex flex-wrap gap-3">
      <select className={sel} defaultValue={params.get('municipio') ?? ''} onChange={(e) => cambiar('municipio', e.target.value)}>
        <option value="">{t('filtroMunicipio')}: {t('filtroTodos')}</option>
        {municipios.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
      </select>
      {categorias && (
        <select className={sel} defaultValue={params.get('categoria') ?? ''} onChange={(e) => cambiar('categoria', e.target.value)}>
          <option value="">{t('filtroCategoria')}: {t('filtroTodos')}</option>
          {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Página de necesidades** — `src/app/[locale]/necesidades/page.tsx`

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarNecesidades, listarMunicipios } from '@/lib/datos/consultas'
import { CATEGORIAS } from '@/lib/validacion/esquemas'
import TarjetaNecesidad from '@/componentes/listas/TarjetaNecesidad'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ municipio?: string; categoria?: string; estado?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations()
  const [necesidades, municipios] = await Promise.all([listarNecesidades(f), listarMunicipios()])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  const opcCat = CATEGORIAS.map((c) => ({ valor: c, texto: t(`categorias.${c}`) }))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-extrabold">{t('listas.tituloNecesidades')}</h1>
      <BarraFiltros municipios={opcMuni} categorias={opcCat} />
      {necesidades.length === 0 ? <Vacio /> : (
        <div className="grid gap-3">
          {necesidades.map((n) => <TarjetaNecesidad key={n.id} n={n} municipio={mapaMuni.get(n.municipio_id)} />)}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 5: Páginas de acopios, voluntarios y servicios**

`acopios/page.tsx`:
```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarAcopios, listarMunicipios } from '@/lib/datos/consultas'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ municipio?: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations('listas')
  const [acopios, municipios] = await Promise.all([listarAcopios(f), listarMunicipios()])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-extrabold">{t('tituloAcopios')}</h1>
      <BarraFiltros municipios={opcMuni} />
      {acopios.length === 0 ? <Vacio /> : (
        <div className="grid gap-3">
          {acopios.map((a) => (
            <article key={a.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-bold">{a.nombre}</h2>
              <p className="text-sm text-gray-600">📍 {mapaMuni.get(a.municipio_id) ?? a.municipio_id} · {a.direccion}</p>
              {a.horarios && <p className="text-sm text-gray-600">🕓 {a.horarios}</p>}
              {a.recibe?.length > 0 && <p className="mt-2 text-sm"><b>{t('recibe')}:</b> {a.recibe.join(', ')}</p>}
              {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('noNecesita')}:</b> {a.no_necesita.join(', ')}</p>}
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
```

`voluntarios/page.tsx`:
```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarVoluntarios, listarMunicipios } from '@/lib/datos/consultas'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ municipio?: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations()
  const [voluntarios, municipios] = await Promise.all([listarVoluntarios(f), listarMunicipios()])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-extrabold">{t('listas.tituloVoluntarios')}</h1>
      <BarraFiltros municipios={opcMuni} />
      {voluntarios.length === 0 ? <Vacio /> : (
        <div className="grid gap-3">
          {voluntarios.map((v) => (
            <article key={v.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm">🛠️ {(v.habilidades ?? []).map((h: string) => t(`habilidades.${h}`)).join(', ')}</p>
              <p className="mt-1 text-xs text-gray-500">📍 {mapaMuni.get(v.municipio_id) ?? v.municipio_id}{v.disponibilidad ? ` · ${v.disponibilidad}` : ''}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
```

`servicios/page.tsx`:
```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarServicios, listarMunicipios } from '@/lib/datos/consultas'
import BarraFiltros from '@/componentes/listas/BarraFiltros'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ municipio?: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations()
  const [servicios, municipios] = await Promise.all([listarServicios(f), listarMunicipios()])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-extrabold">{t('listas.tituloServicios')}</h1>
      <BarraFiltros municipios={opcMuni} />
      {servicios.length === 0 ? <Vacio /> : (
        <div className="grid gap-3">
          {servicios.map((s) => (
            <article key={s.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="font-semibold">{t(`tiposServicio.${s.tipo}`)}</p>
              <p className="text-sm text-gray-700">{s.descripcion}</p>
              <p className="mt-1 text-xs text-gray-500">📍 {mapaMuni.get(s.municipio_id) ?? s.municipio_id}{s.capacidad ? ` · ${s.capacidad}` : ''}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 6: Smoke test de las 4 listas**

```bash
npm run dev > /tmp/p2dev.log 2>&1 &
sleep 8
for r in necesidades acopios voluntarios servicios; do
  curl -s -o /dev/null -w "$r=%{http_code}\n" "http://localhost:3000/es/$r"
done
curl -s -o /dev/null -w "filtro=%{http_code}\n" "http://localhost:3000/es/necesidades?municipio=17001&categoria=agua"
pkill -f "next dev"; pkill -f "next-server"
```
Expected: las 4 listas y el filtro devuelven `200`.

- [ ] **Step 7: Commit**

```bash
git add src/componentes/listas "src/app/[locale]/necesidades" "src/app/[locale]/acopios" "src/app/[locale]/voluntarios" "src/app/[locale]/servicios"
git commit -m "feat: listas públicas (necesidades, acopios, voluntarios, servicios) con filtros por ciudad/categoría"
```

---

### Task 9: Navegación, CTAs de inicio y verificación final

**Files:**
- Create: `src/componentes/Navegacion.tsx`
- Modify: `src/app/[locale]/layout.tsx` (montar la navegación), `src/app/[locale]/page.tsx` (enlazar CTAs)

- [ ] **Step 1: `Navegacion.tsx`**

```tsx
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navegacion'
import SelectorIdioma from '@/componentes/selector-idioma'

export default async function Navegacion() {
  const t = await getTranslations('nav')
  const enlaces: [string, string][] = [
    ['/necesidades', t('necesidades')],
    ['/acopios', t('acopios')],
    ['/voluntarios', t('voluntariado')],
    ['/servicios', t('servicios')],
  ]
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-3">
        <Link href="/" className="font-extrabold">🇨🇴 AyudaCol</Link>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {enlaces.map(([href, txt]) => (
            <Link key={href} href={href} className="text-gray-700 hover:text-blue-700">{txt}</Link>
          ))}
          <SelectorIdioma />
        </div>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: Montar la navegación en el layout** — reemplazar el `<body>` de `src/app/[locale]/layout.tsx`

```tsx
      <body>
        <NextIntlClientProvider>
          {/* @ts-expect-error Async Server Component */}
          <Navegacion />
          {children}
        </NextIntlClientProvider>
      </body>
```
Y añadir el import al inicio del archivo: `import Navegacion from '@/componentes/Navegacion'`.
(Si TypeScript no marca error en el Async Server Component, quita el comentario `@ts-expect-error`.)

- [ ] **Step 3: Enlazar los CTAs de inicio** — en `src/app/[locale]/page.tsx`, envolver cada botón con `Link`. Reemplazar el bloque de los tres `<span>` por:

```tsx
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/reportar/necesidad" className="rounded-lg bg-red-100 px-4 py-2 font-bold text-red-900">
          🆘 {t('pedirAyuda')}
        </Link>
        <Link href="/reportar/voluntario" className="rounded-lg bg-green-100 px-4 py-2 font-bold text-green-900">
          🤝 {t('quieroAyudar')}
        </Link>
        <Link href="/necesidades" className="rounded-lg bg-blue-100 px-4 py-2 font-bold text-blue-900">
          🗺️ {t('donarDesdeEEUU')}
        </Link>
      </div>
```
Y añadir el import: `import { Link } from '@/i18n/navegacion'`.

- [ ] **Step 4: Suite completa**

Run: `npm test`
Expected: PASS todo — validación, formato, paridad de mensajes, estados, RLS e integración de datos.

- [ ] **Step 5: Build de producción**

Run: `npm run build`
Expected: exit 0; se listan las rutas `/[locale]/reportar/necesidad`, `/necesidades`, `/acopios`, `/voluntarios`, `/servicios`, etc.

- [ ] **Step 6: Smoke test de navegación**

```bash
npm run dev > /tmp/p2dev.log 2>&1 &
sleep 8
curl -s http://localhost:3000/es | grep -o "Necesidades" | head -1
curl -s -o /dev/null -w "home=%{http_code}\n" http://localhost:3000/es
pkill -f "next dev"; pkill -f "next-server"
```
Expected: el grep encuentra "Necesidades" (nav montada) y home responde `200`.

- [ ] **Step 7: Commit + tag**

```bash
git add "src/app/[locale]/layout.tsx" "src/app/[locale]/page.tsx" src/componentes/Navegacion.tsx
git commit -m "feat: navegación bilingüe y CTAs de inicio enlazados al flujo público"
git tag flujo-publico-v1
```

---

## Notas para el ejecutor

- **Requiere el Plan 1 aplicado** (migraciones en Supabase) y `.env.local` con las credenciales; la Task 3 y las listas leen de la base real.
- **Render en request-time:** añade `export const dynamic = 'force-dynamic'` al inicio de cada página que lee de Supabase (`reportar/necesidad`, `reportar/voluntario`, `reportar/servicio`, `necesidades`, `acopios`, `voluntarios`, `servicios`). Evita llamadas a la base durante `npm run build` (que romperían el build si la red falla) y garantiza datos frescos en cada visita — clave en una plataforma en vivo. La home (`page.tsx`) se queda estática. Las páginas de listas ya son dinámicas por usar `await searchParams`, pero declararlo explícito lo deja claro.
- **Fuera de alcance (anotado):** subida de fotos a Supabase Storage, rate-limiting por IP (el honeypot es el anti-bot de este plan), y el mapa/visualizador de focos (Plan 4). Las listas de la Task 8 son tarjetas; el mapa se añade en el Plan 4.
- **Server Actions:** las escrituras usan el cliente anónimo; el RLS del Plan 1 garantiza que entran como `sin_verificar`/`disponible` y que nadie lea contactos. No introducir el `service_role` en código de la app.
- **Estados en las listas:** por ahora el público ve todo lo que no está `rechazada`/`duplicada` (así lo define la vista `solicitudes_publicas`). El resaltado de "verificada" ya se muestra con `Sello`.

## Self-review (hecho)
- **Cobertura del spec:** formularios de necesidad/voluntario/servicio (§4, §6) ✓; listas con filtros por ciudad/categoría/estado (§6) ✓; contacto privado nunca expuesto (se lee de vistas; test lo verifica) ✓; "actualizado hace X" (`tiempoRelativo`) ✓; anti-bot honeypot (§5) ✓; bilingüe (claves ES/EN con test de paridad) ✓. Acopios muestran "qué recibe / qué ya no necesita" (§4) ✓.
- **Consistencia de tipos:** `Opcion {valor,texto}` se usa igual en `SelectCatalogo`, formularios, `BarraFiltros`; `EstadoFormulario {enviado, errores}` idéntico en las 3 acciones; `Resultado` de `reportar.ts` consumido por las acciones; `tiempoRelativo(fecha, locale, ahora?)` misma firma en test y uso.
- **Sin placeholders:** cada paso trae el código completo.
