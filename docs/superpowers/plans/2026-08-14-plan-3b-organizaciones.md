# Plan 3b — Organizaciones y Caducidad

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el admin apruebe organizaciones; que una organización aprobada vea las solicitudes verificadas, **"tome"** una (queda "en atención" y solo entonces ve su contacto), la **resuelva**, gestione sus **centros de acopio** (qué recibe / qué ya no necesita); y que las solicitudes verificadas sin actualización en 72 h **caduquen** a "por reconfirmar".

**Architecture:** Migración `0004` con las políticas RLS de organizaciones/admin (helpers `es_admin()` y `mi_organizacion()`, ambos `security definer`) y la función `caducar_solicitudes()`. La lógica de "tomar/resolver" usa la máquina de estados (`rol: 'org'`) y updates condicionales (evitan doble-toma en carrera). Auth y sesión ya existen (Plan 3). Páginas protegidas por rol reutilizando `obtenerPerfil()`.

**Tech Stack:** Next.js 16 (Server Actions) · Supabase (RLS, RPC, `@supabase/ssr`) · `pg` (runner de migración) · next-intl · Vitest.

**Spec:** §4 (organizaciones, acopios, solicitudes_personal), §5 (tomar/resolver/coordinación, caducidad 72h).
**Base:** Planes 1/2/3 en `main`. Migraciones 0001-0003 aplicadas. Existen: `src/lib/estados.ts` (`puedeTransicionar(...,'org')` permite `verificada→en_atencion`, `en_atencion→{resuelta,verificada}`), `src/lib/auth/sesion.ts` (`obtenerPerfil` devuelve `organizacion_id` y `rol`), `src/lib/supabase/servidor.ts` (`crearClienteServidor`), `scripts/aplicar-migraciones.mjs`, `scripts/verificar-bd.mjs`.

**Roadmap:** …3) Auth+moderación ✓ · **3b) Organizaciones** ← este · 4) Visualizador + mapa + tiempo real · 5) Estadísticas + despliegue.

---

## Estructura de archivos

```
supabase/migrations/0004_organizaciones.sql   ← RLS orgs/admin + caducar_solicitudes()
src/lib/datos/org.ts             ← decidirAccionOrg (pura), colas y tomar/resolver/liberar
src/lib/datos/admin.ts           ← listarOrgsPendientes, aprobarOrganizacion, crearOrganizacion
src/lib/datos/acopios-org.ts     ← listarMisAcopios, crearAcopio, editarEstadoAcopio
src/lib/validacion/esquemas.ts   ← (añadir) esquemaAcopio, esquemaOrganizacion
scripts/caducar.mjs              ← ejecuta caducar_solicitudes() (service_role)
src/app/[locale]/admin/organizaciones/{page.tsx,acciones.ts,FilaOrg.tsx}
src/app/[locale]/org/{page.tsx,acciones.ts,FilaTomar.tsx,FilaAsignada.tsx}
src/app/[locale]/org/acopios/{page.tsx,acciones.ts,FormularioAcopio.tsx}
tests/unit/org.test.ts           ← decidirAccionOrg
tests/integracion/caducidad.test.ts  ← caducar_solicitudes vs Supabase real
```
Se modifican `src/messages/{es,en}.json` (claves `org`, `admin`) y `src/componentes/Navegacion.tsx` (enlaces por rol).

---

### Task 1: Migración 0004 — RLS de organizaciones + caducidad

**Files:**
- Create: `supabase/migrations/0004_organizaciones.sql`, `tests/integracion/caducidad.test.ts`

- [ ] **Step 1: Escribir `supabase/migrations/0004_organizaciones.sql`**

```sql
-- ===== HELPERS (security definer: no dispara RLS ni recursión) =====
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function public.mi_organizacion()
returns uuid language sql stable security definer set search_path = public as $$
  select organizacion_id from perfiles where id = auth.uid();
$$;

-- ===== ADMIN: organizaciones y perfiles =====
create policy admin_lee_organizaciones on organizaciones for select to authenticated using (es_admin());
create policy admin_inserta_organizaciones on organizaciones for insert to authenticated with check (es_admin());
create policy admin_edita_organizaciones on organizaciones for update to authenticated using (es_admin());

create policy admin_lee_perfiles on perfiles for select to authenticated using (es_admin());
create policy admin_inserta_perfiles on perfiles for insert to authenticated with check (es_admin());
create policy admin_edita_perfiles on perfiles for update to authenticated using (es_admin());

-- ===== ORG: solicitudes (ver verificadas para tomar + las asignadas con contacto) =====
create policy org_lee_solicitudes on solicitudes_ayuda for select to authenticated
  using (
    (mi_organizacion() is not null and estado = 'verificada')
    or organizacion_asignada = mi_organizacion()
  );

create policy org_actualiza_solicitudes on solicitudes_ayuda for update to authenticated
  using (
    (estado = 'verificada' and organizacion_asignada is null and mi_organizacion() is not null)
    or organizacion_asignada = mi_organizacion()
  )
  with check (
    (organizacion_asignada = mi_organizacion() and estado in ('en_atencion', 'resuelta'))
    or (estado = 'verificada' and organizacion_asignada is null)
  );

-- ===== ORG: centros de acopio =====
create policy org_lee_sus_acopios on centros_acopio for select to authenticated
  using (organizacion_id = mi_organizacion() or es_admin());
create policy org_inserta_acopio on centros_acopio for insert to authenticated
  with check (organizacion_id = mi_organizacion());
create policy org_edita_acopio on centros_acopio for update to authenticated
  using (organizacion_id = mi_organizacion());

-- ===== ORG: solicitudes de personal =====
create policy org_inserta_personal on solicitudes_personal for insert to authenticated
  with check (organizacion_id = mi_organizacion());
create policy org_edita_personal on solicitudes_personal for update to authenticated
  using (organizacion_id = mi_organizacion());

-- ===== CADUCIDAD 72h =====
create or replace function public.caducar_solicitudes()
returns integer language plpgsql security definer set search_path = public as $$
declare afectadas integer;
begin
  update solicitudes_ayuda
     set estado = 'por_reconfirmar'
   where estado in ('verificada', 'en_atencion')
     and actualizada_en < now() - interval '72 hours';
  get diagnostics afectadas = row_count;
  return afectadas;
end; $$;
```

- [ ] **Step 2: Aplicar la migración**

Run: `node scripts/aplicar-migraciones.mjs 0004`
Expected: `Aplicando supabase/migrations/0004_organizaciones.sql ... OK`.

- [ ] **Step 3: Test de integración de caducidad** — `tests/integracion/caducidad.test.ts`

```ts
import { describe, test, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MARCA = 'PRUEBA CADUCIDAD —'

describe('caducar_solicitudes()', () => {
  test('mueve verificadas viejas (>72h) a por_reconfirmar', async () => {
    // Insertar una verificada con actualizada_en antigua (service_role salta RLS).
    const { data: ins, error: e0 } = await admin.from('solicitudes_ayuda').insert({
      categoria: 'agua',
      descripcion: `${MARCA} solicitud vieja de prueba`,
      urgencia: 'alta',
      municipio_id: '27001',
      contacto_nombre: 'Prueba',
      contacto_telefono: '+57 300 0000000',
      estado: 'verificada',
      actualizada_en: new Date(Date.now() - 80 * 3600 * 1000).toISOString(),
    }).select('id').single()
    expect(e0).toBeNull()
    const id = ins!.id

    const { data: n, error: e1 } = await admin.rpc('caducar_solicitudes')
    expect(e1).toBeNull()
    expect(typeof n).toBe('number')

    const { data: fila } = await admin.from('solicitudes_ayuda').select('estado').eq('id', id).single()
    expect(fila!.estado).toBe('por_reconfirmar')
  })

  test('NO toca verificadas recientes', async () => {
    const { data: ins } = await admin.from('solicitudes_ayuda').insert({
      categoria: 'agua',
      descripcion: `${MARCA} solicitud reciente de prueba`,
      urgencia: 'alta',
      municipio_id: '27001',
      contacto_nombre: 'Prueba',
      contacto_telefono: '+57 300 0000000',
      estado: 'verificada',
    }).select('id').single()
    await admin.rpc('caducar_solicitudes')
    const { data: fila } = await admin.from('solicitudes_ayuda').select('estado').eq('id', ins!.id).single()
    expect(fila!.estado).toBe('verificada')
  })
})

afterAll(async () => {
  await admin.from('solicitudes_ayuda').delete().like('descripcion', `${MARCA}%`)
})
```

Run: `npm test -- tests/integracion/caducidad.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Verificar el esquema**

Run: `node scripts/verificar-bd.mjs`
Expected: "Políticas RLS" ahora ≥ 27 (14 previas + 13 nuevas); las tablas y vistas siguen.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_organizaciones.sql tests/integracion/caducidad.test.ts
git commit -m "feat: migración 0004 (RLS organizaciones/admin + función de caducidad 72h) con test de integración"
```

---

### Task 2: Esquemas de validación de acopio y organización

**Files:**
- Modify: `src/lib/validacion/esquemas.ts`
- Test: `tests/unit/validacion.test.ts` (añadir casos)

- [ ] **Step 1: Añadir tests** al final de `tests/unit/validacion.test.ts`

```ts
import { esquemaAcopio, esquemaOrganizacion } from '../../src/lib/validacion/esquemas'

describe('esquemaAcopio', () => {
  test('acepta un acopio válido', () => {
    const r = esquemaAcopio.safeParse({
      nombre: 'Acopio Central',
      direccion: 'Calle 10 # 5-20',
      municipio_id: '17001',
      horarios: '8am-6pm',
      recibe: ['agua', 'alimentos'],
      no_necesita: ['ropa'],
    })
    expect(r.success).toBe(true)
  })
  test('rechaza acopio sin dirección', () => {
    expect(esquemaAcopio.safeParse({ nombre: 'X', municipio_id: '17001' }).success).toBe(false)
  })
})

describe('esquemaOrganizacion', () => {
  test('acepta una organización válida', () => {
    const r = esquemaOrganizacion.safeParse({ nombre: 'Cruz Roja Caldas', tipo: 'ong' })
    expect(r.success).toBe(true)
  })
})
```

Run: `npm test -- tests/unit/validacion.test.ts` → FAIL (esquemas no existen aún).

- [ ] **Step 2: Añadir a `src/lib/validacion/esquemas.ts`**

Al final del archivo, tras los esquemas existentes:

```ts
export const TIPOS_ORGANIZACION = ['ong', 'alcaldia', 'bomberos', 'iglesia', 'empresa', 'comunitaria'] as const
export const ESTADOS_ACOPIO = ['activo', 'lleno', 'cerrado'] as const

// Convierte "agua, alimentos" o un arreglo en string[] limpio.
const listaTexto = z.preprocess((v) => {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}, z.array(z.string()).max(30))

export const esquemaAcopio = z.object({
  nombre: z.string().trim().min(2).max(160),
  direccion: z.string().trim().min(3).max(300),
  municipio_id: z.string().trim().min(1),
  horarios: opcionalTexto(200),
  contacto_publico: opcionalTexto(160),
  recibe: listaTexto,
  no_necesita: listaTexto,
})

export const esquemaOrganizacion = z.object({
  nombre: z.string().trim().min(2).max(200),
  tipo: z.enum(TIPOS_ORGANIZACION),
  descripcion: opcionalTexto(1000),
  contacto_publico: opcionalTexto(160),
})

export type DatosAcopio = z.infer<typeof esquemaAcopio>
export type DatosOrganizacion = z.infer<typeof esquemaOrganizacion>
```

Run: `npm test -- tests/unit/validacion.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validacion/esquemas.ts tests/unit/validacion.test.ts
git commit -m "feat: esquemas de validación de acopio y organización (TDD)"
```

---

### Task 3: Data layer de organización (tomar / resolver) + test

**Files:**
- Create: `src/lib/datos/org.ts`, `tests/unit/org.test.ts`

- [ ] **Step 1: Test que falla** — `tests/unit/org.test.ts`

```ts
import { describe, test, expect } from 'vitest'
import { decidirAccionOrg } from '../../src/lib/datos/org'

describe('decidirAccionOrg', () => {
  test('tomar una verificada → en_atencion', () => {
    expect(decidirAccionOrg('verificada', 'tomar')).toEqual({ ok: true, hacia: 'en_atencion' })
  })
  test('resolver una en_atencion → resuelta', () => {
    expect(decidirAccionOrg('en_atencion', 'resolver')).toEqual({ ok: true, hacia: 'resuelta' })
  })
  test('liberar una en_atencion → verificada', () => {
    expect(decidirAccionOrg('en_atencion', 'liberar')).toEqual({ ok: true, hacia: 'verificada' })
  })
  test('no se puede tomar algo ya resuelto', () => {
    expect(decidirAccionOrg('resuelta', 'tomar').ok).toBe(false)
  })
  test('no se puede resolver una que aún no se ha tomado', () => {
    expect(decidirAccionOrg('verificada', 'resolver').ok).toBe(false)
  })
})
```

Run: `npm test -- tests/unit/org.test.ts` → FAIL.

- [ ] **Step 2: Implementar** — `src/lib/datos/org.ts`

```ts
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { puedeTransicionar, type EstadoSolicitud } from '@/lib/estados'

export type AccionOrg = 'tomar' | 'resolver' | 'liberar'

const DESTINO_ORG: Record<AccionOrg, EstadoSolicitud> = {
  tomar: 'en_atencion',
  resolver: 'resuelta',
  liberar: 'verificada',
}

export function decidirAccionOrg(
  actual: EstadoSolicitud,
  accion: AccionOrg,
): { ok: true; hacia: EstadoSolicitud } | { ok: false } {
  const hacia = DESTINO_ORG[accion]
  return puedeTransicionar(actual, hacia, 'org') ? { ok: true, hacia } : { ok: false }
}

// Verificadas SIN asignar: candidatas a tomar (RLS ya filtra a orgs).
export async function listarVerificadasParaTomar() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('solicitudes_ayuda')
    .select('*')
    .eq('estado', 'verificada')
    .is('organizacion_asignada', null)
    .order('urgencia', { ascending: true })
    .order('creada_en', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Las que YA tomó mi organización (con contacto, gracias al RLS).
export async function listarMisAsignadas() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('solicitudes_ayuda')
    .select('*')
    .eq('estado', 'en_atencion')
    .order('actualizada_en', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function accionSolicitudOrg(id: string, accion: AccionOrg) {
  const perfil = await obtenerPerfil()
  if (!perfil || perfil.rol !== 'org' || !perfil.organizacion_id) {
    return { ok: false as const, motivo: 'sin_permiso' }
  }
  const sb = await crearClienteServidor()
  const { data: fila, error: e1 } = await sb.from('solicitudes_ayuda').select('estado').eq('id', id).single()
  if (e1 || !fila) return { ok: false as const, motivo: 'no_encontrada' }

  const d = decidirAccionOrg(fila.estado as EstadoSolicitud, accion)
  if (!d.ok) return { ok: false as const, motivo: 'transicion_invalida' }

  if (accion === 'tomar') {
    // Update condicional: solo si sigue verificada y sin asignar (evita doble-toma).
    const { data, error } = await sb
      .from('solicitudes_ayuda')
      .update({ estado: 'en_atencion', organizacion_asignada: perfil.organizacion_id })
      .eq('id', id)
      .eq('estado', 'verificada')
      .is('organizacion_asignada', null)
      .select('id')
    if (error) return { ok: false as const, motivo: error.message }
    if (!data || data.length === 0) return { ok: false as const, motivo: 'ya_tomada' }
    return { ok: true as const }
  }

  const parche: Record<string, unknown> = { estado: d.hacia }
  if (accion === 'liberar') parche.organizacion_asignada = null
  const { error } = await sb.from('solicitudes_ayuda').update(parche).eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
```

Run: `npm test -- tests/unit/org.test.ts` → PASS (5 tests). Y `npm test` sin regresiones.

- [ ] **Step 3: Commit**

```bash
git add src/lib/datos/org.ts tests/unit/org.test.ts
git commit -m "feat: data layer de organización (tomar/resolver/liberar con update condicional) + decisión (TDD)"
```

---

### Task 4: Data layer de admin (orgs) y acopios

**Files:**
- Create: `src/lib/datos/admin.ts`, `src/lib/datos/acopios-org.ts`

- [ ] **Step 1: `src/lib/datos/admin.ts`**

```ts
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaOrganizacion, erroresPorCampo } from '@/lib/validacion/esquemas'

export async function listarOrganizaciones() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb.from('organizaciones').select('*').order('creada_en', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function aprobarOrganizacion(id: string) {
  const sb = await crearClienteServidor()
  const { error } = await sb.from('organizaciones').update({ estado: 'aprobada' }).eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}

export async function crearOrganizacion(entrada: unknown) {
  const p = esquemaOrganizacion.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb.from('organizaciones').insert({ ...p.data, estado: 'pendiente' })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}
```

- [ ] **Step 2: `src/lib/datos/acopios-org.ts`**

```ts
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { esquemaAcopio, erroresPorCampo, ESTADOS_ACOPIO } from '@/lib/validacion/esquemas'

export async function listarMisAcopios() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb.from('centros_acopio').select('*').order('actualizada_en', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function crearAcopio(entrada: unknown) {
  const perfil = await obtenerPerfil()
  if (!perfil?.organizacion_id) return { ok: false as const, errores: { _: ['sin_organizacion'] } }
  const p = esquemaAcopio.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb
    .from('centros_acopio')
    .insert({ ...p.data, organizacion_id: perfil.organizacion_id, estado: 'activo' })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

export async function cambiarEstadoAcopio(id: string, estado: string) {
  if (!ESTADOS_ACOPIO.includes(estado as (typeof ESTADOS_ACOPIO)[number])) {
    return { ok: false as const, motivo: 'estado_invalido' }
  }
  const sb = await crearClienteServidor()
  const { error } = await sb.from('centros_acopio').update({ estado }).eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit` → sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/datos/admin.ts src/lib/datos/acopios-org.ts
git commit -m "feat: data layer de administración de organizaciones y de acopios de una org"
```

---

### Task 5: Mensajes i18n de admin y org

**Files:**
- Modify: `src/messages/es.json`, `src/messages/en.json`

- [ ] **Step 1: Añadir a `es.json`**

```json
"admin": {
  "titulo": "Organizaciones",
  "pendientes": "Pendientes de aprobación",
  "aprobadas": "Aprobadas",
  "aprobar": "Aprobar",
  "aprobada": "Aprobada",
  "sinOrgs": "No hay organizaciones registradas."
},
"org": {
  "titulo": "Panel de organización",
  "paraTomar": "Solicitudes verificadas",
  "misAsignadas": "Las que atendemos",
  "tomar": "Tomar",
  "resolver": "Marcar resuelta",
  "liberar": "Liberar",
  "sinVerificadas": "No hay solicitudes verificadas por atender ahora.",
  "sinAsignadas": "Tu organización no tiene solicitudes en atención.",
  "misAcopios": "Nuestros centros de acopio",
  "nuevoAcopio": "Registrar centro de acopio",
  "recibe": "Qué recibe",
  "noNecesita": "Qué ya NO necesita",
  "guardarAcopio": "Guardar acopio",
  "estadoAcopio": "Estado"
}
```

- [ ] **Step 2: Añadir a `en.json`**

```json
"admin": {
  "titulo": "Organizations",
  "pendientes": "Pending approval",
  "aprobadas": "Approved",
  "aprobar": "Approve",
  "aprobada": "Approved",
  "sinOrgs": "No organizations registered."
},
"org": {
  "titulo": "Organization panel",
  "paraTomar": "Verified requests",
  "misAsignadas": "What we're handling",
  "tomar": "Take",
  "resolver": "Mark resolved",
  "liberar": "Release",
  "sinVerificadas": "No verified requests to handle right now.",
  "sinAsignadas": "Your organization has no requests in progress.",
  "misAcopios": "Our donation centers",
  "nuevoAcopio": "Register a donation center",
  "recibe": "Accepts",
  "noNecesita": "No longer needs",
  "guardarAcopio": "Save center",
  "estadoAcopio": "Status"
}
```

- [ ] **Step 3: Paridad**

Run: `npm test -- tests/unit/mensajes-paridad.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/messages/es.json src/messages/en.json
git commit -m "i18n: claves de administración de organizaciones y panel de org"
```

---

### Task 6: Página de aprobación de organizaciones (admin)

**Files:**
- Create: `src/app/[locale]/admin/organizaciones/{acciones.ts,FilaOrg.tsx,page.tsx}`

- [ ] **Step 1: `acciones.ts`**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { aprobarOrganizacion } from '@/lib/datos/admin'

export async function accionAprobar(id: string) {
  const r = await aprobarOrganizacion(id)
  revalidatePath('/[locale]/admin/organizaciones', 'page')
  return r
}
```

- [ ] **Step 2: `FilaOrg.tsx`**

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionAprobar } from './acciones'

type Org = { id: string; nombre: string; tipo: string; estado: string; descripcion: string | null }

export default function FilaOrg({ o }: { o: Org }) {
  const t = useTranslations('admin')
  const [pending, start] = useTransition()
  const [estado, setEstado] = useState(o.estado)
  return (
    <article className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <p className="font-bold">{o.nombre} <span className="text-xs font-normal text-gray-500">· {o.tipo}</span></p>
        {o.descripcion && <p className="text-sm text-gray-600">{o.descripcion}</p>}
      </div>
      {estado === 'aprobada' ? (
        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">✓ {t('aprobada')}</span>
      ) : (
        <button disabled={pending} onClick={() => start(async () => { const r = await accionAprobar(o.id); if (r.ok) setEstado('aprobada') })}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
          {t('aprobar')}
        </button>
      )}
    </article>
  )
}
```

- [ ] **Step 3: `page.tsx`** (protegida: solo admin)

```tsx
export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { listarOrganizaciones } from '@/lib/datos/admin'
import FilaOrg from './FilaOrg'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin')
  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && perfil.rol !== 'admin') {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">403</p></main>
  }
  const orgs = await listarOrganizaciones()
  const pendientes = orgs.filter((o) => o.estado === 'pendiente')
  const aprobadas = orgs.filter((o) => o.estado === 'aprobada')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('titulo')}</h1>
      {orgs.length === 0 && <p className="text-gray-500">{t('sinOrgs')}</p>}
      {pendientes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase text-gray-500">{t('pendientes')}</h2>
          <div className="grid gap-2">{pendientes.map((o) => <FilaOrg key={o.id} o={o} />)}</div>
        </section>
      )}
      {aprobadas.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase text-gray-500">{t('aprobadas')}</h2>
          <div className="grid gap-2">{aprobadas.map((o) => <FilaOrg key={o.id} o={o} />)}</div>
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 4: tsc + build + smoke**

Run: `npx tsc --noEmit && npm run build`
Smoke:
```bash
npm run dev > /tmp/p3bdev.log 2>&1 &
sleep 9
curl -s -o /dev/null -w "admin=%{http_code}\n" http://localhost:3000/es/admin/organizaciones
pkill -f "next dev"; pkill -f "next-server"
```
Expected: build exit 0; sin sesión, `admin=307` (redirige a /entrar). Matar server.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/admin"
git commit -m "feat: página de aprobación de organizaciones (solo admin)"
```

---

### Task 7: Panel de organización (tomar / resolver)

**Files:**
- Create: `src/app/[locale]/org/{acciones.ts,FilaTomar.tsx,FilaAsignada.tsx,page.tsx}`

- [ ] **Step 1: `acciones.ts`**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { accionSolicitudOrg, type AccionOrg } from '@/lib/datos/org'

export async function accionOrg(id: string, accion: AccionOrg) {
  const r = await accionSolicitudOrg(id, accion)
  revalidatePath('/[locale]/org', 'page')
  return r
}
```

- [ ] **Step 2: `FilaTomar.tsx`** (una verificada, sin contacto todavía)

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionOrg } from './acciones'

type S = { id: string; categoria: string; descripcion: string; urgencia: string; municipio_id: string }

export default function FilaTomar({ s }: { s: S }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [oculta, setOculta] = useState(false)
  if (oculta) return null
  const borde = s.urgencia === 'alta' ? 'border-l-red-500' : s.urgencia === 'media' ? 'border-l-amber-500' : 'border-l-gray-300'
  return (
    <article className={`rounded-lg border border-gray-200 border-l-4 ${borde} bg-white p-4`}>
      <p className="font-bold">{t(`categorias.${s.categoria}`)}</p>
      <p className="text-sm text-gray-700">{s.descripcion}</p>
      <p className="mt-1 text-xs text-gray-500">📍 {s.municipio_id}</p>
      <button disabled={pending} onClick={() => start(async () => { const r = await accionOrg(s.id, 'tomar'); if (r.ok) setOculta(true) })}
        className="mt-3 rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
        {t('org.tomar')}
      </button>
    </article>
  )
}
```

- [ ] **Step 3: `FilaAsignada.tsx`** (ya tomada: muestra contacto + resolver/liberar)

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionOrg } from './acciones'

type S = {
  id: string; categoria: string; descripcion: string; municipio_id: string
  contacto_nombre: string; contacto_telefono: string
}

export default function FilaAsignada({ s }: { s: S }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [oculta, setOculta] = useState(false)
  if (oculta) return null
  function actuar(accion: 'resolver' | 'liberar') {
    start(async () => { const r = await accionOrg(s.id, accion); if (r.ok) setOculta(true) })
  }
  return (
    <article className="rounded-lg border border-purple-200 bg-purple-50 p-4">
      <p className="font-bold">{t(`categorias.${s.categoria}`)}</p>
      <p className="text-sm text-gray-700">{s.descripcion}</p>
      <p className="mt-1 text-xs text-gray-600">📍 {s.municipio_id} · {t('panel.contacto')}: <b>{s.contacto_nombre} — {s.contacto_telefono}</b></p>
      <div className="mt-3 flex gap-2">
        <button disabled={pending} onClick={() => actuar('resolver')}
          className="rounded bg-green-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">{t('org.resolver')}</button>
        <button disabled={pending} onClick={() => actuar('liberar')}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">{t('org.liberar')}</button>
      </div>
    </article>
  )
}
```

- [ ] **Step 4: `page.tsx`** (protegida: solo rol org)

```tsx
export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { listarVerificadasParaTomar, listarMisAsignadas } from '@/lib/datos/org'
import { Link } from '@/i18n/navegacion'
import FilaTomar from './FilaTomar'
import FilaAsignada from './FilaAsignada'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && perfil.rol !== 'org') {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }
  const [paraTomar, asignadas] = await Promise.all([listarVerificadasParaTomar(), listarMisAsignadas()])
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t('org.titulo')}</h1>
        <Link href="/org/acopios" className="text-sm font-semibold text-blue-700">{t('org.misAcopios')} →</Link>
      </div>
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-bold uppercase text-gray-500">{t('org.misAsignadas')}</h2>
        {asignadas.length === 0 ? <p className="text-sm text-gray-500">{t('org.sinAsignadas')}</p> : (
          <div className="grid gap-3">{asignadas.map((s) => <FilaAsignada key={s.id} s={s} />)}</div>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase text-gray-500">{t('org.paraTomar')}</h2>
        {paraTomar.length === 0 ? <p className="text-sm text-gray-500">{t('org.sinVerificadas')}</p> : (
          <div className="grid gap-3">{paraTomar.map((s) => <FilaTomar key={s.id} s={s} />)}</div>
        )}
      </section>
    </main>
  )
}
```

- [ ] **Step 5: tsc + build + smoke**

Run: `npx tsc --noEmit && npm run build`
Smoke: `/es/org` sin sesión → 307. (Igual patrón que Task 6.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/org/acciones.ts" "src/app/[locale]/org/FilaTomar.tsx" "src/app/[locale]/org/FilaAsignada.tsx" "src/app/[locale]/org/page.tsx"
git commit -m "feat: panel de organización — tomar y resolver solicitudes verificadas"
```

---

### Task 8: Acopios de la org + caducidad + nav por rol + verificación final

**Files:**
- Create: `src/app/[locale]/org/acopios/{acciones.ts,FormularioAcopio.tsx,page.tsx}`, `scripts/caducar.mjs`
- Modify: `src/componentes/Navegacion.tsx`

- [ ] **Step 1: `scripts/caducar.mjs`**

```js
// Ejecuta la caducidad de 72h. Correr periódicamente (cron/tarea programada).
// Uso: node scripts/caducar.mjs
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await admin.rpc('caducar_solicitudes')
if (error) { console.error('❌', error.message); process.exit(1) }
console.log(`✅ Solicitudes caducadas a por_reconfirmar: ${data}`)
```

- [ ] **Step 2: `org/acopios/acciones.ts`**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { crearAcopio, cambiarEstadoAcopio } from '@/lib/datos/acopios-org'

export type EstadoAcopioForm = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionCrearAcopio(_prev: EstadoAcopioForm, formData: FormData): Promise<EstadoAcopioForm> {
  const entrada = {
    nombre: formData.get('nombre'),
    direccion: formData.get('direccion'),
    municipio_id: formData.get('municipio_id'),
    horarios: (formData.get('horarios') as string) || undefined,
    contacto_publico: (formData.get('contacto_publico') as string) || undefined,
    recibe: (formData.get('recibe') as string) || '',
    no_necesita: (formData.get('no_necesita') as string) || '',
  }
  const r = await crearAcopio(entrada)
  if (!r.ok) return { enviado: false, errores: r.errores }
  revalidatePath('/[locale]/org/acopios', 'page')
  return { enviado: true }
}

export async function accionEstadoAcopio(id: string, estado: string) {
  const r = await cambiarEstadoAcopio(id, estado)
  revalidatePath('/[locale]/org/acopios', 'page')
  return r
}
```

- [ ] **Step 3: `org/acopios/FormularioAcopio.tsx`**

```tsx
'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionCrearAcopio, type EstadoAcopioForm } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'

const inicial: EstadoAcopioForm = { enviado: false }

export default function FormularioAcopio({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionCrearAcopio, inicial)
  const e = estado.errores ?? {}
  return (
    <details className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer font-bold">➕ {t('org.nuevoAcopio')}</summary>
      {estado.enviado ? (
        <p className="mt-3 rounded bg-green-100 p-3 text-sm text-green-900">{t('formulario.gracias')}</p>
      ) : (
        <form action={accion} className="mt-4 max-w-lg">
          <Campo etiqueta={t('campos.nombre')} htmlFor="anombre" requerido errores={e.nombre}>
            <input id="anombre" name="nombre" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta="Dirección" htmlFor="adir" requerido errores={e.direccion}>
            <input id="adir" name="direccion" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.municipio')} htmlFor="amuni" requerido errores={e.municipio_id}>
            <SelectCatalogo id="amuni" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('org.recibe')} htmlFor="arecibe" ayuda="Separadas por coma" errores={e.recibe}>
            <input id="arecibe" name="recibe" placeholder="agua, alimentos, cobijas" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('org.noNecesita')} htmlFor="anono" ayuda="Separadas por coma" errores={e.no_necesita}>
            <input id="anono" name="no_necesita" placeholder="ropa usada" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <BotonEnviar texto={t('org.guardarAcopio')} textoEnviando={t('acciones.enviando')} />
        </form>
      )}
    </details>
  )
}
```

- [ ] **Step 4: `org/acopios/page.tsx`** (protegida: rol org)

```tsx
export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { listarMisAcopios } from '@/lib/datos/acopios-org'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioAcopio from './FormularioAcopio'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && perfil.rol !== 'org') {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }
  const [acopios, municipios] = await Promise.all([
    listarMisAcopios(),
    listarMunicipios().then((ms) => ms.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))),
  ])
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('org.misAcopios')}</h1>
      <FormularioAcopio municipios={municipios} />
      {acopios.length === 0 ? <p className="text-sm text-gray-500">—</p> : (
        <div className="grid gap-3">
          {acopios.map((a) => (
            <article key={a.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="font-bold">{a.nombre} <span className="text-xs font-normal text-gray-500">· {a.estado}</span></p>
              <p className="text-sm text-gray-600">📍 {a.municipio_id} · {a.direccion}</p>
              {a.recibe?.length > 0 && <p className="mt-1 text-sm"><b>{t('org.recibe')}:</b> {a.recibe.join(', ')}</p>}
              {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('org.noNecesita')}:</b> {a.no_necesita.join(', ')}</p>}
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 5: Enlaces por rol en la navegación** — en `src/componentes/Navegacion.tsx`, tras cargar traducciones, obtener el perfil y añadir enlaces condicionales. Añadir import `import { obtenerPerfil } from '@/lib/auth/sesion'`, y dentro de la función (que ya es async), tras `const tAuth = await getTranslations('auth')`:

```tsx
  const perfil = await obtenerPerfil()
```
Reemplazar el bloque del enlace "Entrar" por lógica según sesión/rol (colócalo donde estaba el `<Link href="/entrar">`):
```tsx
          {!perfil && <Link href="/entrar" className="text-gray-700 hover:text-blue-700">{tAuth('entrar')}</Link>}
          {perfil && (perfil.rol === 'moderador' || perfil.rol === 'admin') && (
            <Link href="/panel" className="font-semibold text-blue-700">{tAuth('panel')}</Link>
          )}
          {perfil?.rol === 'admin' && (
            <Link href="/admin/organizaciones" className="text-gray-700 hover:text-blue-700">{t('admin.titulo')}</Link>
          )}
          {perfil?.rol === 'org' && (
            <Link href="/org" className="font-semibold text-blue-700">{t('org.titulo')}</Link>
          )}
```
(El `t` es `getTranslations('nav')` existente — para `admin.titulo`/`org.titulo` usa un segundo `const tRoot = await getTranslations()` y cámbialos a `tRoot('admin.titulo')`, `tRoot('org.titulo')` para no chocar con el namespace `nav`.)

- [ ] **Step 6: Verificación final**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: todos los tests PASS (incluye caducidad, org, validación); tipos ok; build exit 0 con rutas `/[locale]/admin/organizaciones`, `/[locale]/org`, `/[locale]/org/acopios`.

- [ ] **Step 7: Smoke test**

```bash
npm run dev > /tmp/p3bdev.log 2>&1 &
sleep 9
for r in admin/organizaciones org org/acopios; do
  curl -s -o /dev/null -w "$r=%{http_code}\n" "http://localhost:3000/es/$r"
done
pkill -f "next dev"; pkill -f "next-server"
```
Expected: las 3 rutas devuelven 307 sin sesión (protegidas). Sin procesos next colgados.

- [ ] **Step 8: Commit + tag**

```bash
git add "src/app/[locale]/org/acopios" scripts/caducar.mjs src/componentes/Navegacion.tsx
git commit -m "feat: gestión de acopios de la org, script de caducidad y navegación por rol"
git tag organizaciones-v1
```

---

## Notas para el ejecutor

- **Requiere migraciones 0001-0003 aplicadas** (Planes 1) y `.env.local` con `SUPABASE_SERVICE_ROLE_KEY` (para el test de caducidad y el runner). La Task 1 aplica la 0004 con `node scripts/aplicar-migraciones.mjs 0004`.
- **Provisión de una org de prueba (manual, para probar el rol 'org'):** crear una organización aprobada y un perfil con rol 'org' apuntando a ella. Con `service_role` (o el script del Plan 3 extendido): insertar en `organizaciones` (estado 'aprobada'), y luego `crear-perfil.mjs correo org` — pero ese script no fija `organizacion_id`. Para pruebas, ajustar el `perfiles.organizacion_id` del usuario org al id de la organización (vía SQL Editor o extendiendo el script). Documentar en `BOOTSTRAP-ADMIN.md` si se desea.
- **Caducidad:** `scripts/caducar.mjs` se ejecuta manualmente o vía una tarea programada (cron del sistema, o una Edge Function de Supabase con `pg_cron` en el Plan 5). No hay job automático en este plan.
- **Testing de auth/org UI:** igual que el Plan 3, el flujo autenticado no se testea E2E (requeriría sesión real). Se cubre con: test de integración de `caducar_solicitudes` y de la migración, tests unitarios de `decidirAccionOrg` y validación, verificación de que las páginas protegidas redirigen sin sesión (smoke), y prueba manual con una cuenta org.
- **`revalidatePath('/[locale]/...', 'page')`** revalida rutas dinámicas; combinado con el ocultamiento optimista de filas, el panel refleja los cambios.

## Self-review (hecho)
- **Cobertura del spec (§4/§5):** admin aprueba orgs ✓; org toma verificada→en_atencion y ve contacto solo entonces ✓ (RLS `org_lee_solicitudes` + update condicional); org resuelve/libera ✓ (máquina de estados rol 'org'); org gestiona acopios con recibe/no_necesita ✓; caducidad 72h ✓ (`caducar_solicitudes` + test). solicitudes_personal: políticas creadas (UI en un plan posterior; anotado). No-doble-toma en carrera ✓ (update condicional `.eq('estado','verificada').is('organizacion_asignada',null)`).
- **Consistencia de tipos:** `AccionOrg`/`decidirAccionOrg`/`accionSolicitudOrg` en `org.ts` usados por `org/acciones.ts` y filas; `crearAcopio`/`cambiarEstadoAcopio` de `acopios-org.ts`; `esquemaAcopio`/`esquemaOrganizacion` de `esquemas.ts`; `obtenerPerfil().organizacion_id`/`rol` de `sesion.ts`; `Opcion` reutilizado. `es_admin()`/`mi_organizacion()` definidos en 0004 y usados por todas las políticas.
- **Sin placeholders:** cada paso trae código completo.
