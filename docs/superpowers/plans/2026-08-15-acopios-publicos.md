# Solicitud pública de acopios + moderación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Permitir proponer centros de acopio sin login (quedan `verificado=false`), con moderación del equipo que los publica (`verificado=true`) o los rechaza (borra).

**Architecture:** Se reutiliza `centros_acopio` (org nullable + bandera `verificado`). Espejo del vertical de mascotas: migración → data layer → formulario público → panel de moderación → cablear la lista pública. El flujo de organizaciones (`/org/acopios`) queda intacto.

**Tech Stack:** Next.js 16 (App Router, server actions), next-intl v4, Supabase (Postgres + RLS), Zod, Vitest, Tailwind.

---

## File Structure

**Nuevos**
- `supabase/migrations/0011_acopios_publicos.sql`
- `src/lib/datos/acopios-publico.ts`
- `src/app/[locale]/acopios/proponer/{page.tsx,formulario.tsx,acciones.ts}`
- `src/app/[locale]/panel/acopios/{page.tsx,FilaAcopio.tsx,acciones.ts}`
- `tests/unit/acopios-publico.test.ts`

**Modificados**
- `src/lib/validacion/esquemas.ts` (esquemaAcopioPublico)
- `src/app/[locale]/acopios/page.tsx` (enlaces)
- `src/messages/es.json`, `src/messages/en.json` (bloque `acopiosPublico`)
- `scripts/aplicar-migraciones.mjs` (registrar 0011)

**Nota migración:** el `.sql` se crea en el repo; la tabla cambia al aplicar la migración
en Supabase con `node scripts/aplicar-migraciones.mjs 0011`. El código compila y las
pruebas unitarias corren sin BD; `/acopios/proponer` y `/panel/acopios` solo funcionan de
verdad una vez aplicada.

---

## Task A1: Migración 0011 + esquemaAcopioPublico + tests + runner

**Files:**
- Create: `supabase/migrations/0011_acopios_publicos.sql`
- Modify: `src/lib/validacion/esquemas.ts`, `scripts/aplicar-migraciones.mjs`
- Test: `tests/unit/acopios-publico.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

Create `tests/unit/acopios-publico.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { esquemaAcopioPublico } from '../../src/lib/validacion/esquemas'

const base = {
  nombre: 'Parroquia San José',
  direccion: 'Cra 5 # 10-20',
  municipio_id: '27001',
  contacto_publico: '+57 300 1234567',
  recibe: 'agua, alimentos',
  no_necesita: 'ropa usada',
}

describe('esquemaAcopioPublico', () => {
  test('acepta una propuesta válida y parsea las listas', () => {
    const r = esquemaAcopioPublico.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.recibe).toEqual(['agua', 'alimentos'])
      expect(r.data.no_necesita).toEqual(['ropa usada'])
    }
  })

  test('rechaza sin contacto_publico (requerido en propuestas públicas)', () => {
    const { contacto_publico, ...sinContacto } = base
    expect(esquemaAcopioPublico.safeParse(sinContacto).success).toBe(false)
  })

  test('rechaza dirección faltante', () => {
    expect(esquemaAcopioPublico.safeParse({ ...base, direccion: '' }).success).toBe(false)
  })

  test('rechaza municipio faltante', () => {
    expect(esquemaAcopioPublico.safeParse({ ...base, municipio_id: '' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/unit/acopios-publico.test.ts`
Expected: FAIL (`esquemaAcopioPublico` no existe).

- [ ] **Step 3: Añadir el esquema al final de `src/lib/validacion/esquemas.ts`**

```ts
// Propuesta pública de acopio: mismos campos que esquemaAcopio pero el contacto es
// obligatorio (el equipo verifica y el público llama). Reutiliza el helper listaTexto.
export const esquemaAcopioPublico = z.object({
  nombre: z.string().trim().min(2).max(160),
  direccion: z.string().trim().min(3).max(300),
  municipio_id: z.string().trim().min(1),
  horarios: opcionalTexto(200),
  contacto_publico: z.string().trim().min(5).max(160),
  recibe: listaTexto,
  no_necesita: listaTexto,
})

export type DatosAcopioPublico = z.infer<typeof esquemaAcopioPublico>
```

Nota: `z`, `opcionalTexto` y `listaTexto` ya están definidos en el archivo. `listaTexto`
es una const del módulo (no exportada) pero es accesible dentro del mismo archivo — úsala,
no la redefinas.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/unit/acopios-publico.test.ts`
Expected: PASS (4 pruebas).

- [ ] **Step 5: Crear la migración `supabase/migrations/0011_acopios_publicos.sql`**

```sql
-- Propuesta pública de centros de acopio + moderación.
-- organizacion_id pasa a opcional (propuestas sin org); nueva bandera 'verificado'.

alter table centros_acopio alter column organizacion_id drop not null;
alter table centros_acopio add column verificado boolean not null default true;
-- Los acopios existentes quedan verificado=true → siguen públicos.

-- Inserción pública: anon inserta propuestas SIN org y SIN verificar.
create policy propuesta_publica_acopio on centros_acopio
  for insert to anon
  with check (organizacion_id is null and verificado = false);

-- Lectura pública: solo verificados.
drop policy if exists lectura_publica_acopios on centros_acopio;
create policy lectura_publica_acopios on centros_acopio
  for select to anon, authenticated using (verificado = true);

-- El equipo (admin/moderador) ve, edita y borra cualquier acopio (moderación).
create policy equipo_lee_acopios on centros_acopio
  for select to authenticated using (es_moderador_o_admin());
create policy equipo_edita_acopios on centros_acopio
  for update to authenticated using (es_moderador_o_admin());
create policy equipo_borra_acopios on centros_acopio
  for delete to authenticated using (es_moderador_o_admin());
```

- [ ] **Step 6: Registrar la migración en el runner**

En `scripts/aplicar-migraciones.mjs`, dentro del arreglo `TODAS`, después de la línea
`'supabase/migrations/0010_refugios_animales.sql',` añadir:

```js
  'supabase/migrations/0011_acopios_publicos.sql',
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0011_acopios_publicos.sql src/lib/validacion/esquemas.ts tests/unit/acopios-publico.test.ts scripts/aplicar-migraciones.mjs
git commit -m "feat: migración acopios públicos + esquemaAcopioPublico"
```

---

## Task A2: Data layer `acopios-publico.ts`

**Files:**
- Create: `src/lib/datos/acopios-publico.ts`

- [ ] **Step 1: Crear el archivo**

Create `src/lib/datos/acopios-publico.ts`:

```ts
import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaAcopioPublico, erroresPorCampo } from '@/lib/validacion/esquemas'

// Propuesta pública: cualquiera inserta; la RLS exige organizacion_id null y verificado=false.
export async function proponerAcopio(entrada: unknown) {
  const p = esquemaAcopioPublico.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('centros_acopio').insert({
    ...p.data,
    organizacion_id: null,
    verificado: false,
    estado: 'activo',
  })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

// Cola de moderación: propuestas sin verificar (RLS: solo equipo lee no verificados).
export async function listarColaAcopios() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('centros_acopio')
    .select('*')
    .eq('verificado', false)
    .order('actualizada_en', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Modera una propuesta: aprobar (verificado=true) o rechazar (borrar). Solo equipo (RLS).
export async function moderarAcopio(id: string, accion: 'aprobar' | 'rechazar') {
  const sb = await crearClienteServidor()
  if (accion === 'aprobar') {
    const { error } = await sb.from('centros_acopio').update({ verificado: true }).eq('id', id)
    if (error) return { ok: false as const, motivo: error.message }
    return { ok: true as const }
  }
  const { error } = await sb.from('centros_acopio').delete().eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/datos/acopios-publico.ts
git commit -m "feat: data layer de acopios públicos"
```

---

## Task A3: i18n `acopiosPublico`

**Files:**
- Modify: `src/messages/es.json`, `src/messages/en.json`

- [ ] **Step 1: Español — añadir el bloque al final**

En `src/messages/es.json`, reemplazar el final del archivo:

```json
    "comoLlegar": "Cómo llegar"
  }
}
```

por:

```json
    "comoLlegar": "Cómo llegar"
  },
  "acopiosPublico": {
    "proponerTitulo": "Proponer un centro de acopio",
    "intro": "Registra un punto donde la gente pueda dejar donaciones. Tu propuesta será revisada por el equipo antes de publicarse.",
    "gracias": "¡Gracias! Tu propuesta quedó registrada. El equipo la revisará antes de publicarla.",
    "gestionar": "Moderar acopios",
    "sinCola": "No hay propuestas de acopio pendientes.",
    "aprobar": "Aprobar y publicar",
    "rechazar": "Rechazar",
    "nombreCentro": "Nombre del centro de acopio",
    "horarios": "Horarios (ej. 8am–6pm)",
    "contacto": "Contacto público (teléfono)"
  }
}
```

> Nota: el bloque `maps` fue el último namespace agregado; si el archivo termina con otro
> namespace, inserta `"acopiosPublico": { … }` igual como último namespace de nivel superior,
> con una coma después del `}` del namespace anterior.

- [ ] **Step 2: Inglés — añadir el bloque al final**

En `src/messages/en.json`, reemplazar el final del archivo:

```json
    "comoLlegar": "Get directions"
  }
}
```

por:

```json
    "comoLlegar": "Get directions"
  },
  "acopiosPublico": {
    "proponerTitulo": "Propose a collection center",
    "intro": "Register a place where people can drop off donations. Your proposal will be reviewed by the team before it goes public.",
    "gracias": "Thank you! Your proposal was submitted. The team will review it before publishing.",
    "gestionar": "Moderate centers",
    "sinCola": "No pending collection center proposals.",
    "aprobar": "Approve & publish",
    "rechazar": "Reject",
    "nombreCentro": "Collection center name",
    "horarios": "Hours (e.g. 8am–6pm)",
    "contacto": "Public contact (phone)"
  }
}
```

- [ ] **Step 3: Validar JSON**

Run: `node -e "const es=require('./src/messages/es.json'),en=require('./src/messages/en.json');if(!es.acopiosPublico||!en.acopiosPublico)throw new Error('falta acopiosPublico');console.log('JSON OK')"`
Expected: `JSON OK`

- [ ] **Step 4: Commit**

```bash
git add src/messages/es.json src/messages/en.json
git commit -m "feat: i18n de acopios públicos"
```

---

## Task A4: Formulario público `/acopios/proponer`

**Files:**
- Create: `src/app/[locale]/acopios/proponer/acciones.ts`
- Create: `src/app/[locale]/acopios/proponer/formulario.tsx`
- Create: `src/app/[locale]/acopios/proponer/page.tsx`

- [ ] **Step 1: Crear la server action**

Create `src/app/[locale]/acopios/proponer/acciones.ts`:

```ts
'use server'
import { proponerAcopio } from '@/lib/datos/acopios-publico'

export type EstadoFormulario = {
  enviado: boolean
  errores?: Record<string, string[]>
}

export async function accionProponerAcopio(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true } // bot: descartar en silencio
  const entrada = {
    nombre: formData.get('nombre'),
    direccion: formData.get('direccion'),
    municipio_id: formData.get('municipio_id'),
    horarios: (formData.get('horarios') as string) || undefined,
    contacto_publico: formData.get('contacto_publico'),
    recibe: (formData.get('recibe') as string) || '',
    no_necesita: (formData.get('no_necesita') as string) || '',
  }
  const res = await proponerAcopio(entrada)
  if (!res.ok) return { enviado: false, errores: res.errores }
  return { enviado: true }
}
```

- [ ] **Step 2: Crear el formulario (client)**

Create `src/app/[locale]/acopios/proponer/formulario.tsx`:

```tsx
'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionProponerAcopio, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioProponerAcopio({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionProponerAcopio, inicial)

  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('acopiosPublico.gracias')}</p>
  }

  const e = estado.errores ?? {}
  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('acopiosPublico.nombreCentro')} htmlFor="nombre" requerido errores={e.nombre}>
        <input id="nombre" name="nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.direccion')} htmlFor="direccion" requerido errores={e.direccion}>
        <input id="direccion" name="direccion" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" requerido errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('acopiosPublico.horarios')} htmlFor="horarios" errores={e.horarios}>
        <input id="horarios" name="horarios" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('acopiosPublico.contacto')} htmlFor="contacto_publico" requerido errores={e.contacto_publico}>
        <input id="contacto_publico" name="contacto_publico" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('org.recibe')} htmlFor="recibe" ayuda="Separadas por coma" errores={e.recibe}>
        <input id="recibe" name="recibe" placeholder="agua, alimentos, cobijas"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('org.noNecesita')} htmlFor="no_necesita" ayuda="Separadas por coma" errores={e.no_necesita}>
        <input id="no_necesita" name="no_necesita" placeholder="ropa usada"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
      <BotonEnviar texto={t('acciones.enviar')} textoEnviando={t('acciones.enviando')} />
    </form>
  )
}
```

- [ ] **Step 3: Crear la página**

Create `src/app/[locale]/acopios/proponer/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioProponerAcopio from './formulario'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('acopiosPublico')
  const municipios = (await listarMunicipios()).map((m) => ({
    valor: m.codigo_dane,
    texto: `${m.nombre} — ${m.departamento}`,
  }))
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-extrabold">{t('proponerTitulo')}</h1>
      <p className="mb-6 text-sm text-gray-600">{t('intro')}</p>
      <FormularioProponerAcopio municipios={municipios} />
    </main>
  )
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/acopios/proponer"
git commit -m "feat: formulario público para proponer acopios"
```

---

## Task A5: Panel de moderación `/panel/acopios`

**Files:**
- Create: `src/app/[locale]/panel/acopios/acciones.ts`
- Create: `src/app/[locale]/panel/acopios/FilaAcopio.tsx`
- Create: `src/app/[locale]/panel/acopios/page.tsx`

- [ ] **Step 1: Crear la server action**

Create `src/app/[locale]/panel/acopios/acciones.ts`:

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { moderarAcopio } from '@/lib/datos/acopios-publico'

export async function accionModerarAcopio(id: string, accion: 'aprobar' | 'rechazar') {
  const r = await moderarAcopio(id, accion)
  revalidatePath('/[locale]/panel/acopios', 'page')
  revalidatePath('/[locale]/acopios', 'page')
  return r
}
```

- [ ] **Step 2: Crear la fila (client)**

Create `src/app/[locale]/panel/acopios/FilaAcopio.tsx`:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionModerarAcopio } from './acciones'

type Acopio = {
  id: string; nombre: string; direccion: string; municipio_id: string
  horarios: string | null; contacto_publico: string | null
  recibe: string[]; no_necesita: string[]; creada_en: string
}

export default function FilaAcopio({ a, municipio }: { a: Acopio; municipio?: string }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [oculta, setOculta] = useState(false)

  function moderar(accion: 'aprobar' | 'rechazar') {
    start(async () => {
      const r = await accionModerarAcopio(a.id, accion)
      if (r.ok) setOculta(true)
    })
  }
  if (oculta) return null

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="font-bold">{a.nombre}</p>
      <p className="text-sm text-gray-600">📍 {municipio ?? a.municipio_id} · {a.direccion}</p>
      {a.horarios && <p className="text-sm text-gray-600">🕓 {a.horarios}</p>}
      {a.contacto_publico && <p className="text-sm text-gray-600">☎️ {a.contacto_publico}</p>}
      {a.recibe?.length > 0 && <p className="mt-2 text-sm"><b>{t('org.recibe')}:</b> {a.recibe.join(', ')}</p>}
      {a.no_necesita?.length > 0 && <p className="text-sm text-red-700"><b>{t('org.noNecesita')}:</b> {a.no_necesita.join(', ')}</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={pending} onClick={() => moderar('aprobar')}
          className="rounded bg-green-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
          ✓ {t('acopiosPublico.aprobar')}
        </button>
        <button disabled={pending} onClick={() => moderar('rechazar')}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {t('acopiosPublico.rechazar')}
        </button>
      </div>
    </article>
  )
}
```

- [ ] **Step 3: Crear la página del panel**

Create `src/app/[locale]/panel/acopios/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { listarColaAcopios } from '@/lib/datos/acopios-publico'
import { listarMunicipios } from '@/lib/datos/consultas'
import FilaAcopio from './FilaAcopio'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && !ROLES_PANEL.includes(perfil.rol)) {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }

  const [cola, municipiosRaw] = await Promise.all([listarColaAcopios(), listarMunicipios()])
  const mapaMuni = new Map(municipiosRaw.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('acopiosPublico.gestionar')}</h1>
      {cola.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('acopiosPublico.sinCola')}</p>
      ) : (
        <div className="grid gap-3">
          {cola.map((a) => <FilaAcopio key={a.id} a={a} municipio={mapaMuni.get(a.municipio_id)} />)}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/panel/acopios"
git commit -m "feat: panel de moderación de acopios"
```

---

## Task A6: Cablear la lista pública `/acopios` + verificación final

**Files:**
- Modify: `src/app/[locale]/acopios/page.tsx`

- [ ] **Step 1: Cambiar el enlace público y añadir el de moderación**

El archivo actual `src/app/[locale]/acopios/page.tsx` tiene, cerca del inicio del `return`:

```tsx
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('tituloAcopios')}</h1>
        <Link href="/org/acopios" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          📦 {tRoot('org.nuevoAcopio')}
        </Link>
      </div>
      <p className="mb-4 text-xs text-gray-500">{tRoot('org.acopioSoloOrgs')}</p>
```

Reemplazarlo por (el botón lleva al formulario público; se agrega enlace de moderación para el equipo; se quita el texto "solo orgs"):

```tsx
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('tituloAcopios')}</h1>
        <div className="flex flex-wrap gap-2">
          {esEquipo && (
            <Link href="/panel/acopios" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
              {tRoot('acopiosPublico.gestionar')}
            </Link>
          )}
          <Link href="/acopios/proponer" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">
            📦 {tRoot('org.nuevoAcopio')}
          </Link>
        </div>
      </div>
```

Y en el bloque de "vacío" (más abajo), reemplazar el enlace:

```tsx
            <Link href="/org/acopios" className="font-semibold text-slate-700 hover:underline">📦 {tRoot('org.nuevoAcopio')}</Link>
```

por:

```tsx
            <Link href="/acopios/proponer" className="font-semibold text-slate-700 hover:underline">📦 {tRoot('org.nuevoAcopio')}</Link>
```

- [ ] **Step 2: Cargar `esEquipo` (perfil) en la página**

La página actual `acopios/page.tsx` NO carga el perfil. Añadir el import y el cálculo.

En los imports, añadir:

```tsx
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
```

Reemplazar:

```tsx
  const [acopios, municipios] = await Promise.all([listarAcopios(f), listarMunicipios()])
```

por:

```tsx
  const [acopios, municipios, perfil] = await Promise.all([listarAcopios(f), listarMunicipios(), obtenerPerfil()])
  const esEquipo = !!perfil && ROLES_PANEL.includes(perfil.rol)
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificación completa**

Run: `npm test`
Expected: PASS (incluye `acopios-publico.test.ts`).

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores NUEVOS (los 3 de `server.js` son PREEXISTENTES; no tocarlos).

Run: `npm run build`
Expected: build OK; deben aparecer `/[locale]/acopios/proponer` y `/[locale]/panel/acopios`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/acopios/page.tsx"
git commit -m "feat: enlaces público (proponer) y de moderación en /acopios"
```

- [ ] **Step 6: Verificación manual (requiere aplicar migración 0011 en Supabase)**

1. Aplicar: `node scripts/aplicar-migraciones.mjs 0011`.
2. `npm run dev` → `/es/acopios/proponer`: proponer un acopio sin login → mensaje de gracias.
3. `/es/acopios`: la propuesta **no** aparece (verificado=false).
4. Entrar como equipo → `/es/panel/acopios`: ver la propuesta → **Aprobar** → ahora sí aparece en `/es/acopios`.
5. Proponer otra → **Rechazar** → desaparece de la cola.

---

## Self-Review (cobertura del spec)

- Migración: org nullable + `verificado` + RLS (inserción pública, lectura solo verificados, equipo modera/borra) → A1. ✅
- `esquemaAcopioPublico` (contacto requerido) + tests + runner → A1. ✅
- Data layer (proponer, cola, moderar aprobar/rechazar) → A2. ✅
- i18n `acopiosPublico` (es/en) → A3. ✅
- Formulario público sin login + honeypot → A4. ✅
- Panel de moderación (aprobar/rechazar) → A5. ✅
- Enlace público → /acopios/proponer + enlace equipo → /panel/acopios; se quita "solo orgs" → A6. ✅
- Flujo org intacto (`/org/acopios` no se toca). ✅
- Consistencia de nombres: `verificado`, `esquemaAcopioPublico`, `proponerAcopio`/`listarColaAcopios`/`moderarAcopio`, acción `aprobar`/`rechazar`. ✅
```
