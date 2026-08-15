# Sección de mascotas perdidas y encontradas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una sección de mascotas perdidas/encontradas (reporte público, listado con filtros, contacto directo por WhatsApp/tel, y panel de moderación del equipo), calcada del vertical de personas desaparecidas.

**Architecture:** Espejo del vertical `desaparecidos`: tabla `mascotas` + RLS + vista pública (que **sí** incluye contacto) → data layer `mascotas.ts` → páginas `/mascotas`, `/reportar/mascota`, `/panel/mascotas` → tarjeta y filtros. Diferencias: campo `tipo_reporte` (perdida/encontrada), `especie`, estados `activo/reunida/cerrado`, contacto visible.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), next-intl v4, Supabase (Postgres + RLS + Storage), Zod, Vitest, Tailwind.

---

## File Structure

**Nuevos**
- `supabase/migrations/0008_mascotas.sql` — tabla, enums, RLS, vista pública, trigger.
- `src/lib/datos/mascotas.ts` — data layer (listar/reportar/cola/cambiarEstado).
- `src/componentes/listas/TarjetaMascota.tsx` — tarjeta pública (con contacto).
- `src/componentes/listas/FiltrosMascotas.tsx` — filtros tipo/especie/municipio (client).
- `src/app/[locale]/mascotas/page.tsx` — listado público.
- `src/app/[locale]/reportar/mascota/page.tsx` — página del formulario.
- `src/app/[locale]/reportar/mascota/formulario.tsx` — formulario (client).
- `src/app/[locale]/reportar/mascota/acciones.ts` — server action de reporte.
- `src/app/[locale]/panel/mascotas/page.tsx` — panel de moderación.
- `src/app/[locale]/panel/mascotas/FilaMascota.tsx` — fila de moderación (client).
- `src/app/[locale]/panel/mascotas/acciones.ts` — server action de cambio de estado.
- `tests/unit/mascotas.test.ts` — pruebas de `esquemaMascota`.

**Modificados**
- `src/lib/validacion/esquemas.ts` — `esquemaMascota` + enums.
- `src/messages/es.json`, `src/messages/en.json` — namespace `mascotas` + nav.
- `src/componentes/Navegacion.tsx` — enlace `/mascotas`.

**Nota sobre la migración:** el archivo SQL se crea en el repo, pero la tabla se crea al **aplicar la migración en Supabase** (editor SQL o CLI), igual que 0001–0007. Sin aplicarla, la app compila y corre, pero `/mascotas` sale vacía y el reporte fallará al insertar. Las pruebas unitarias y el build NO dependen de la BD.

---

## Task 1: Migración + esquema de validación (TDD del esquema)

**Files:**
- Create: `supabase/migrations/0008_mascotas.sql`
- Modify: `src/lib/validacion/esquemas.ts`
- Test: `tests/unit/mascotas.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

Create `tests/unit/mascotas.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { esquemaMascota } from '../../src/lib/validacion/esquemas'

const base = {
  tipo_reporte: 'perdida',
  especie: 'perro',
  descripcion: 'Perro café, mediano, collar rojo, se perdió cerca del río.',
  contacto_nombre: 'Ana',
  contacto_telefono: '+57 300 1234567',
}

describe('esquemaMascota', () => {
  test('acepta un reporte de mascota perdida válido', () => {
    expect(esquemaMascota.safeParse(base).success).toBe(true)
  })

  test('acepta un reporte de mascota encontrada', () => {
    expect(esquemaMascota.safeParse({ ...base, tipo_reporte: 'encontrada', especie: 'gato' }).success).toBe(true)
  })

  test('acepta nombre y municipio vacíos (opcionales)', () => {
    const r = esquemaMascota.safeParse({ ...base, nombre: '', municipio_id: '' })
    expect(r.success).toBe(true)
  })

  test('rechaza tipo_reporte inválido', () => {
    expect(esquemaMascota.safeParse({ ...base, tipo_reporte: 'otro' }).success).toBe(false)
  })

  test('rechaza especie inválida', () => {
    expect(esquemaMascota.safeParse({ ...base, especie: 'dinosaurio' }).success).toBe(false)
  })

  test('rechaza descripción demasiado corta', () => {
    expect(esquemaMascota.safeParse({ ...base, descripcion: 'x' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `npx vitest run tests/unit/mascotas.test.ts`
Expected: FAIL — `esquemaMascota` no existe (no exportado).

- [ ] **Step 3: Añadir el esquema y los enums**

En `src/lib/validacion/esquemas.ts`, al final del archivo, añadir:

```ts
export const TIPOS_REPORTE_MASCOTA = ['perdida', 'encontrada'] as const
export const ESPECIES_MASCOTA = ['perro', 'gato', 'ave', 'otro'] as const
export const ESTADOS_MASCOTA = ['activo', 'reunida', 'cerrado'] as const

export const esquemaMascota = z.object({
  tipo_reporte: z.enum(TIPOS_REPORTE_MASCOTA),
  especie: z.enum(ESPECIES_MASCOTA),
  nombre: opcionalTexto(120),
  descripcion: z.string().trim().min(5).max(2000),
  municipio_id: z.string().trim().max(20).optional().or(z.literal('')),
  ultima_ubicacion: opcionalTexto(500),
  contacto_nombre: nombre,
  contacto_telefono: telefono,
})

export type DatosMascota = z.infer<typeof esquemaMascota>
```

(Usa los helpers ya existentes en el archivo: `opcionalTexto`, `nombre`, `telefono`.)

- [ ] **Step 4: Correr la prueba y ver que pasa**

Run: `npx vitest run tests/unit/mascotas.test.ts`
Expected: PASS (6 pruebas).

- [ ] **Step 5: Crear la migración**

Create `supabase/migrations/0008_mascotas.sql`:

```sql
-- Mascotas perdidas y encontradas. Espejo de personas_desaparecidas, pero la
-- vista pública INCLUYE el contacto (para llamar/WhatsApp directo al reportante).

create type tipo_reporte_mascota as enum ('perdida', 'encontrada');
create type especie_mascota as enum ('perro', 'gato', 'ave', 'otro');
create type estado_mascota as enum ('activo', 'reunida', 'cerrado');

create table mascotas (
  id uuid primary key default gen_random_uuid(),
  tipo_reporte tipo_reporte_mascota not null,
  especie especie_mascota not null,
  nombre text,
  descripcion text not null check (char_length(descripcion) between 5 and 2000),
  municipio_id text references municipios(codigo_dane),
  ultima_ubicacion text,
  foto_url text,
  estado estado_mascota not null default 'activo',
  contacto_nombre text not null,
  contacto_telefono text not null,
  verificada_por uuid references perfiles(id),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
create index idx_mascotas_municipio on mascotas (municipio_id);

alter table mascotas enable row level security;
revoke select on mascotas from anon;
create policy reporte_publico_mascotas on mascotas
  for insert to anon, authenticated with check (estado = 'activo');
create policy equipo_lee_mascotas on mascotas
  for select to authenticated using (es_moderador_o_admin());
create policy equipo_edita_mascotas on mascotas
  for update to authenticated using (es_moderador_o_admin());

-- Vista pública: INCLUYE contacto (decisión de diseño), excluye 'cerrado'.
create view mascotas_publicas as
  select id, tipo_reporte, especie, nombre, descripcion, municipio_id, ultima_ubicacion,
         foto_url, estado, contacto_nombre, contacto_telefono, creada_en
  from mascotas where estado <> 'cerrado';
grant select on mascotas_publicas to anon, authenticated;

create trigger trg_mascotas_actualizada before update on mascotas
  for each row execute function set_actualizada_en();
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0008_mascotas.sql src/lib/validacion/esquemas.ts tests/unit/mascotas.test.ts
git commit -m "feat: migración mascotas + esquemaMascota"
```

---

## Task 2: Data layer `mascotas.ts`

**Files:**
- Create: `src/lib/datos/mascotas.ts`

- [ ] **Step 1: Crear el data layer**

Create `src/lib/datos/mascotas.ts`:

```ts
import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaMascota, erroresPorCampo, ESTADOS_MASCOTA } from '@/lib/validacion/esquemas'

export type FiltrosMascotas = { municipio?: string; tipo?: string; especie?: string }

// Lectura pública desde la vista (RLS: la vista es legible por anónimo e incluye contacto).
export async function listarMascotas(f: FiltrosMascotas = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('mascotas_publicas').select('*').order('creada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  if (f.tipo) q = q.eq('tipo_reporte', f.tipo)
  if (f.especie) q = q.eq('especie', f.especie)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

// La foto es opcional y no forma parte de esquemaMascota: se lee cruda y se guarda aparte.
function fotoUrlDe(entrada: unknown): string | undefined {
  const v = (entrada as { foto_url?: unknown } | null)?.foto_url
  const s = typeof v === 'string' ? v.trim() : ''
  return /^https?:\/\//.test(s) ? s : undefined
}

// Reporte público: cualquiera inserta; la RLS exige estado='activo'.
export async function reportarMascota(entrada: unknown) {
  const p = esquemaMascota.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('mascotas').insert({
    ...p.data,
    nombre: p.data.nombre || null,
    municipio_id: p.data.municipio_id || null,
    ultima_ubicacion: p.data.ultima_ubicacion || null,
    foto_url: fotoUrlDe(entrada) ?? null,
    estado: 'activo',
  })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

// Cola de moderación: reportes vigentes (activo/reunida) con contacto (RLS: solo equipo).
export async function listarColaMascotas() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('mascotas')
    .select('*')
    .in('estado', ['activo', 'reunida'])
    .order('creada_en', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Cambia el estado de un reporte (reunida/cerrado/activo): solo equipo, aplicado vía RLS.
export async function cambiarEstadoMascota(id: string, estado: string) {
  if (!ESTADOS_MASCOTA.includes(estado as (typeof ESTADOS_MASCOTA)[number])) {
    return { ok: false as const, motivo: 'estado_invalido' }
  }
  const sb = await crearClienteServidor()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, motivo: 'sin_sesion' }

  const { error } = await sb
    .from('mascotas')
    .update({ estado, verificada_por: user.id })
    .eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/datos/mascotas.ts
git commit -m "feat: data layer de mascotas"
```

---

## Task 3: i18n (`mascotas`) + clave de navegación

**Files:**
- Modify: `src/messages/es.json`
- Modify: `src/messages/en.json`

- [ ] **Step 1: Español — añadir el namespace `mascotas`**

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
  "mascotas": {
    "titulo": "Mascotas perdidas y encontradas",
    "intro": "Reporta una mascota perdida o encontrada durante la emergencia y contacta directamente para reunirla con su familia.",
    "reportar": "Reportar mascota",
    "formTitulo": "Reportar una mascota",
    "gracias": "¡Gracias! El reporte quedó publicado.",
    "gestionar": "Gestionar mascotas",
    "sin": "Aún no hay mascotas reportadas.",
    "sinCola": "No hay reportes de mascotas pendientes.",
    "contacto": "Contacto",
    "whatsapp": "WhatsApp",
    "llamar": "Llamar",
    "telefonoPublico": "Tu teléfono será visible para que puedan contactarte si ven a tu mascota.",
    "marcarReunida": "Marcar reunida",
    "cerrar": "Cerrar reporte",
    "campoTipo": "Tipo de reporte",
    "campoEspecie": "Especie",
    "nombreMascota": "Nombre de la mascota (si lo sabes)",
    "ultimaUbicacion": "¿Dónde se perdió o se encontró?",
    "filtroTipo": "Tipo",
    "filtroEspecie": "Especie",
    "tipo_perdida": "Perdida",
    "tipo_encontrada": "Encontrada",
    "especie_perro": "Perro",
    "especie_gato": "Gato",
    "especie_ave": "Ave",
    "especie_otro": "Otro",
    "estado_activo": "Activo",
    "estado_reunida": "Reunida",
    "estado_cerrado": "Cerrado"
  }
}
```

- [ ] **Step 2: Español — añadir la clave de navegación**

En `src/messages/es.json`, dentro del objeto `"nav"`, reemplazar:

```json
    "desaparecidos": "Desaparecidos",
```

por:

```json
    "desaparecidos": "Desaparecidos",
    "mascotas": "Mascotas",
```

- [ ] **Step 3: Inglés — añadir el namespace `mascotas`**

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
  "mascotas": {
    "titulo": "Lost and found pets",
    "intro": "Report a lost or found pet during the emergency and get in touch directly to reunite it with its family.",
    "reportar": "Report a pet",
    "formTitulo": "Report a pet",
    "gracias": "Thank you! Your report is now published.",
    "gestionar": "Manage pets",
    "sin": "No pets reported yet.",
    "sinCola": "No pending pet reports.",
    "contacto": "Contact",
    "whatsapp": "WhatsApp",
    "llamar": "Call",
    "telefonoPublico": "Your phone number will be visible so people can reach you if they see your pet.",
    "marcarReunida": "Mark reunited",
    "cerrar": "Close report",
    "campoTipo": "Report type",
    "campoEspecie": "Species",
    "nombreMascota": "Pet name (if known)",
    "ultimaUbicacion": "Where was it lost or found?",
    "filtroTipo": "Type",
    "filtroEspecie": "Species",
    "tipo_perdida": "Lost",
    "tipo_encontrada": "Found",
    "especie_perro": "Dog",
    "especie_gato": "Cat",
    "especie_ave": "Bird",
    "especie_otro": "Other",
    "estado_activo": "Active",
    "estado_reunida": "Reunited",
    "estado_cerrado": "Closed"
  }
}
```

- [ ] **Step 4: Inglés — añadir la clave de navegación**

En `src/messages/en.json`, dentro del objeto `"nav"`, reemplazar la línea de `"desaparecidos"` (su valor en inglés) añadiendo debajo `"mascotas": "Pets",`. Por ejemplo, si dice `"desaparecidos": "Missing people",`, debe quedar:

```json
    "desaparecidos": "Missing people",
    "mascotas": "Pets",
```

(Conserva el valor en inglés que ya exista para `desaparecidos`; solo añade la línea `mascotas`.)

- [ ] **Step 5: Validar JSON**

Run: `node -e "const es=require('./src/messages/es.json'),en=require('./src/messages/en.json');if(!es.mascotas||!en.mascotas||!es.nav.mascotas||!en.nav.mascotas)throw new Error('faltan claves');console.log('JSON OK', es.nav.mascotas, '/', en.nav.mascotas)"`
Expected: `JSON OK Mascotas / Pets`

- [ ] **Step 6: Commit**

```bash
git add src/messages/es.json src/messages/en.json
git commit -m "feat: i18n de mascotas + clave de navegación"
```

---

## Task 4: Componentes de lista (`TarjetaMascota` + `FiltrosMascotas`)

**Files:**
- Create: `src/componentes/listas/TarjetaMascota.tsx`
- Create: `src/componentes/listas/FiltrosMascotas.tsx`

- [ ] **Step 1: Crear `TarjetaMascota`**

Create `src/componentes/listas/TarjetaMascota.tsx`:

```tsx
import { useLocale, useTranslations } from 'next-intl'
import { tiempoRelativo } from '@/lib/formato'

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
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm">
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

- [ ] **Step 2: Crear `FiltrosMascotas`**

Create `src/componentes/listas/FiltrosMascotas.tsx`:

```tsx
'use client'
import { useRouter, usePathname } from '@/i18n/navegacion'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Opcion } from '@/componentes/formularios/SelectCatalogo'

const TIPOS = ['perdida', 'encontrada'] as const
const ESPECIES = ['perro', 'gato', 'ave', 'otro'] as const

export default function FiltrosMascotas({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations('mascotas')
  const tListas = useTranslations('listas')
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
      <select className={sel} defaultValue={params.get('tipo') ?? ''} onChange={(e) => cambiar('tipo', e.target.value)}>
        <option value="">{t('filtroTipo')}: {tListas('filtroTodos')}</option>
        {TIPOS.map((v) => <option key={v} value={v}>{t(`tipo_${v}`)}</option>)}
      </select>
      <select className={sel} defaultValue={params.get('especie') ?? ''} onChange={(e) => cambiar('especie', e.target.value)}>
        <option value="">{t('filtroEspecie')}: {tListas('filtroTodos')}</option>
        {ESPECIES.map((v) => <option key={v} value={v}>{t(`especie_${v}`)}</option>)}
      </select>
      <select className={sel} defaultValue={params.get('municipio') ?? ''} onChange={(e) => cambiar('municipio', e.target.value)}>
        <option value="">{tListas('filtroMunicipio')}: {tListas('filtroTodos')}</option>
        {municipios.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
      </select>
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/componentes/listas/TarjetaMascota.tsx src/componentes/listas/FiltrosMascotas.tsx
git commit -m "feat: TarjetaMascota + FiltrosMascotas"
```

---

## Task 5: Página pública `/mascotas`

**Files:**
- Create: `src/app/[locale]/mascotas/page.tsx`

- [ ] **Step 1: Crear la página**

Create `src/app/[locale]/mascotas/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarMascotas } from '@/lib/datos/mascotas'
import { listarMunicipios } from '@/lib/datos/consultas'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { Link } from '@/i18n/navegacion'
import TarjetaMascota from '@/componentes/listas/TarjetaMascota'
import FiltrosMascotas from '@/componentes/listas/FiltrosMascotas'
import Vacio from '@/componentes/listas/Vacio'

export default async function Pagina({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ municipio?: string; tipo?: string; especie?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const f = await searchParams
  const t = await getTranslations('mascotas')
  const [mascotas, municipios, perfil] = await Promise.all([
    listarMascotas(f),
    listarMunicipios(),
    obtenerPerfil(),
  ])
  const mapaMuni = new Map(municipios.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))
  const opcMuni = municipios.map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
  const esEquipo = !!perfil && ROLES_PANEL.includes(perfil.rol)

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('titulo')}</h1>
        {esEquipo && (
          <Link href="/panel/mascotas" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
            {t('gestionar')}
          </Link>
        )}
      </div>
      <p className="mb-4 text-sm text-gray-600">{t('intro')}</p>
      <div className="mb-4">
        <Link href="/reportar/mascota" className="inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">
          🐾 {t('reportar')}
        </Link>
      </div>
      <FiltrosMascotas municipios={opcMuni} />
      {mascotas.length === 0 ? (
        <div>
          <Vacio mensaje={t('sin')} />
          <p className="mt-4 text-center">
            <Link href="/reportar/mascota" className="font-semibold text-blue-700 hover:underline">🐾 {t('reportar')}</Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {mascotas.map((m) => (
            <TarjetaMascota key={m.id} m={m} municipio={mapaMuni.get(m.municipio_id)} />
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/mascotas/page.tsx"
git commit -m "feat: página pública /mascotas"
```

---

## Task 6: Flujo de reporte `/reportar/mascota`

**Files:**
- Create: `src/app/[locale]/reportar/mascota/acciones.ts`
- Create: `src/app/[locale]/reportar/mascota/formulario.tsx`
- Create: `src/app/[locale]/reportar/mascota/page.tsx`

- [ ] **Step 1: Crear la server action**

Create `src/app/[locale]/reportar/mascota/acciones.ts`:

```ts
'use server'
import { reportarMascota } from '@/lib/datos/mascotas'

export type EstadoFormulario = {
  enviado: boolean
  errores?: Record<string, string[]>
}

export async function accionReportarMascota(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true } // bot: descartar en silencio
  const entrada = {
    tipo_reporte: formData.get('tipo_reporte'),
    especie: formData.get('especie'),
    nombre: (formData.get('nombre') as string) || undefined,
    municipio_id: (formData.get('municipio_id') as string) || undefined,
    ultima_ubicacion: (formData.get('ultima_ubicacion') as string) || undefined,
    descripcion: formData.get('descripcion'),
    contacto_nombre: formData.get('contacto_nombre'),
    contacto_telefono: formData.get('contacto_telefono'),
    foto_url: (formData.get('foto_url') as string) || undefined,
  }
  const res = await reportarMascota(entrada)
  if (!res.ok) return { enviado: false, errores: res.errores }
  return { enviado: true }
}
```

- [ ] **Step 2: Crear el formulario (client)**

Create `src/app/[locale]/reportar/mascota/formulario.tsx`:

```tsx
'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionReportarMascota, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import SubirFoto from '@/componentes/formularios/SubirFoto'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioMascota({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionReportarMascota, inicial)

  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('mascotas.gracias')}</p>
  }

  const e = estado.errores ?? {}
  const tipos: Opcion[] = [
    { valor: 'perdida', texto: t('mascotas.tipo_perdida') },
    { valor: 'encontrada', texto: t('mascotas.tipo_encontrada') },
  ]
  const especies: Opcion[] = [
    { valor: 'perro', texto: t('mascotas.especie_perro') },
    { valor: 'gato', texto: t('mascotas.especie_gato') },
    { valor: 'ave', texto: t('mascotas.especie_ave') },
    { valor: 'otro', texto: t('mascotas.especie_otro') },
  ]

  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('mascotas.campoTipo')} htmlFor="tipo_reporte" requerido errores={e.tipo_reporte}>
        <SelectCatalogo id="tipo_reporte" name="tipo_reporte" opciones={tipos} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('mascotas.campoEspecie')} htmlFor="especie" requerido errores={e.especie}>
        <SelectCatalogo id="especie" name="especie" opciones={especies} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('mascotas.nombreMascota')} htmlFor="nombre" errores={e.nombre}>
        <input id="nombre" name="nombre" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} />
      </Campo>
      <Campo etiqueta={t('mascotas.ultimaUbicacion')} htmlFor="ultima_ubicacion" errores={e.ultima_ubicacion}>
        <input id="ultima_ubicacion" name="ultima_ubicacion" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.descripcion')} htmlFor="descripcion" requerido errores={e.descripcion}>
        <textarea id="descripcion" name="descripcion" rows={4} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <SubirFoto name="foto_url" />
      <Campo etiqueta={t('campos.contactoNombre')} htmlFor="contacto_nombre" requerido errores={e.contacto_nombre}>
        <input id="contacto_nombre" name="contacto_nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.contactoTelefono')} htmlFor="contacto_telefono" requerido
        ayuda={t('mascotas.telefonoPublico')} errores={e.contacto_telefono}>
        <input id="contacto_telefono" name="contacto_telefono" type="tel" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
      <BotonEnviar texto={t('acciones.enviar')} textoEnviando={t('acciones.enviando')} />
    </form>
  )
}
```

- [ ] **Step 3: Crear la página del formulario**

Create `src/app/[locale]/reportar/mascota/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioMascota from './formulario'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('mascotas')
  const municipios = (await listarMunicipios()).map((m) => ({
    valor: m.codigo_dane,
    texto: `${m.nombre} — ${m.departamento}`,
  }))
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-extrabold">{t('formTitulo')}</h1>
      <FormularioMascota municipios={municipios} />
    </main>
  )
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/reportar/mascota"
git commit -m "feat: formulario de reporte de mascotas"
```

---

## Task 7: Panel de moderación `/panel/mascotas`

**Files:**
- Create: `src/app/[locale]/panel/mascotas/acciones.ts`
- Create: `src/app/[locale]/panel/mascotas/FilaMascota.tsx`
- Create: `src/app/[locale]/panel/mascotas/page.tsx`

- [ ] **Step 1: Crear la server action**

Create `src/app/[locale]/panel/mascotas/acciones.ts`:

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { cambiarEstadoMascota } from '@/lib/datos/mascotas'

export async function accionCambiarEstadoMascota(id: string, estado: string) {
  const r = await cambiarEstadoMascota(id, estado)
  revalidatePath('/[locale]/panel/mascotas', 'page')
  revalidatePath('/[locale]/mascotas', 'page')
  return r
}
```

- [ ] **Step 2: Crear la fila de moderación (client)**

Create `src/app/[locale]/panel/mascotas/FilaMascota.tsx`:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionCambiarEstadoMascota } from './acciones'

type Mascota = {
  id: string; tipo_reporte: string; especie: string; nombre: string | null; descripcion: string
  municipio_id: string | null; ultima_ubicacion: string | null
  estado: string; contacto_nombre: string; contacto_telefono: string; creada_en: string
}

const COLOR_TIPO: Record<string, string> = {
  perdida: 'bg-amber-100 text-amber-800',
  encontrada: 'bg-green-100 text-green-800',
}

export default function FilaMascota({ m, municipio }: { m: Mascota; municipio?: string }) {
  const t = useTranslations('mascotas')
  const [pending, start] = useTransition()
  const [estado, setEstado] = useState(m.estado)
  const [oculta, setOculta] = useState(false)

  function cambiar(nuevo: 'reunida' | 'cerrado') {
    start(async () => {
      const r = await accionCambiarEstadoMascota(m.id, nuevo)
      if (r.ok) {
        if (nuevo === 'cerrado') setOculta(true)
        else setEstado(nuevo)
      }
    })
  }
  if (oculta) return null

  const ubicacion = [municipio, m.ultima_ubicacion].filter(Boolean).join(' · ')
  const titulo = [t(`especie_${m.especie}`), m.nombre].filter(Boolean).join(' · ')

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-bold">🐾 {titulo}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_TIPO[m.tipo_reporte] ?? 'bg-gray-100 text-gray-600'}`}>
          {t(`tipo_${m.tipo_reporte}`)} · {t(`estado_${estado}`)}
        </span>
      </div>
      <p className="text-sm text-gray-700">{m.descripcion}</p>
      {ubicacion && <p className="mt-2 text-xs text-gray-600">📍 {ubicacion}</p>}
      <p className="mt-1 text-xs text-gray-600">
        {t('contacto')}: <b>{m.contacto_nombre} — {m.contacto_telefono}</b>
      </p>
      <div className="mt-3 flex gap-2">
        {estado === 'activo' && (
          <button disabled={pending} onClick={() => cambiar('reunida')}
            className="rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
            ✓ {t('marcarReunida')}
          </button>
        )}
        <button disabled={pending} onClick={() => cambiar('cerrado')}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {t('cerrar')}
        </button>
      </div>
    </article>
  )
}
```

- [ ] **Step 3: Crear la página del panel**

Create `src/app/[locale]/panel/mascotas/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { listarColaMascotas } from '@/lib/datos/mascotas'
import { listarMunicipios } from '@/lib/datos/consultas'
import FilaMascota from './FilaMascota'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && !ROLES_PANEL.includes(perfil.rol)) {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }

  const [cola, municipiosRaw] = await Promise.all([listarColaMascotas(), listarMunicipios()])
  const mapaMuni = new Map(municipiosRaw.map((m) => [m.codigo_dane, `${m.nombre} — ${m.departamento}`]))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-2xl font-extrabold">{t('mascotas.gestionar')}</h1>
      {cola.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('mascotas.sinCola')}</p>
      ) : (
        <div className="grid gap-3">
          {cola.map((m) => <FilaMascota key={m.id} m={m} municipio={mapaMuni.get(m.municipio_id)} />)}
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
git add "src/app/[locale]/panel/mascotas"
git commit -m "feat: panel de moderación de mascotas"
```

---

## Task 8: Enlace en navegación + verificación final

**Files:**
- Modify: `src/componentes/Navegacion.tsx`

- [ ] **Step 1: Añadir el enlace `/mascotas` en la navegación**

En `src/componentes/Navegacion.tsx`, dentro del arreglo `enlaces`, reemplazar:

```tsx
    ['/desaparecidos', t('desaparecidos')],
```

por:

```tsx
    ['/desaparecidos', t('desaparecidos')],
    ['/mascotas', t('mascotas')],
```

- [ ] **Step 2: Verificación completa**

Run: `npm test`
Expected: PASS (incluye `mascotas.test.ts` y las suites previas).

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores NUEVOS. (Nota: `server.js` tiene 3 errores `require()` PREEXISTENTES ajenos a este cambio; no deben tocarse aquí.)

Run: `npm run build`
Expected: build exitoso; deben aparecer las rutas `/[locale]/mascotas`, `/[locale]/reportar/mascota`, `/[locale]/panel/mascotas`.

- [ ] **Step 3: Commit**

```bash
git add src/componentes/Navegacion.tsx
git commit -m "feat: enlace de mascotas en la navegación"
```

- [ ] **Step 4: Verificación manual (requiere aplicar la migración 0008 en Supabase)**

1. Aplicar `supabase/migrations/0008_mascotas.sql` en el editor SQL de Supabase.
2. Con `npm run dev`:
   - `/es/reportar/mascota`: reportar una **perdida** (perro) y una **encontrada** (gato) con teléfono.
   - `/es/mascotas`: ver ambas; filtrar por tipo y por especie; comprobar el botón de **WhatsApp** (abre `wa.me/<dígitos>`) y el enlace **Llamar** (`tel:`).
   - Iniciar sesión como equipo → `/es/panel/mascotas`: marcar una **reunida** y **cerrar** otra; verificar que la cerrada desaparece de `/mascotas`.
   - Repetir en `/en/...` para confirmar los textos en inglés.

---

## Self-Review (cobertura del spec)

- Migración `mascotas` (enums, RLS igual a personas, vista pública CON contacto, trigger) → Task 1. ✅
- `esquemaMascota` + enums + tests → Task 1. ✅
- Data layer (listar con filtros tipo/especie/municipio, reportar, cola, cambiarEstado) → Task 2. ✅
- i18n `mascotas` (es/en) + nav → Task 3. ✅
- `TarjetaMascota` (contacto visible + WhatsApp/tel) + `FiltrosMascotas` → Task 4. ✅
- Página `/mascotas` con filtros → Task 5. ✅
- Flujo de reporte con `tipo_reporte`, `especie`, `SubirFoto`, honeypot, y ayuda de teléfono PÚBLICO → Task 6. ✅
- Panel de moderación (reunida/cerrado) → Task 7. ✅
- Enlace en navegación → Task 8. ✅
- Consistencia de nombres entre tareas: tabla `mascotas`/vista `mascotas_publicas`; estados `activo`/`reunida`/`cerrado`; claves i18n `tipo_*`/`especie_*`/`estado_*`; `esquemaMascota`. ✅
- Fuera de alcance (mapa, estadísticas, campos extra) — no se implementa. ✅
```
