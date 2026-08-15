# Casos aliados (MiManizales.info) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sección pública `/casos-aliados` que muestra los casos de mimanizales.info (miniatura enlazada + prioridad + necesidad) enlazando a su ficha, sin copiar contacto ni datos de pago.

**Architecture:** Un script de sync trae los casos del API n8n de mimanizales, descarta contacto/breb, y hace upsert en una tabla `casos_aliados`. Una vista pública alimenta una página server-component (patrón `novedades`) con tarjetas que enlazan a la ficha de origen. Lógica pura de mapeo en `.mjs` testeable con vitest.

**Tech Stack:** Next.js 16 (App Router, server components, next-intl), Supabase (Postgres + vista pública + RLS), Node ESM (`.mjs`) con `pg` + `dotenv`, vitest v4. Sin dependencias nuevas.

---

## File Structure

- `scripts/casos-aliados/mapeo.mjs` — puro: `primeraImagen`, `mapearCaso` (descarta contacto/breb).
- `scripts/casos-aliados/sincronizar.mjs` — entry: fetch API → upsert vía `pg`.
- `supabase/migrations/0012_casos_aliados.sql` — tabla + vista pública + RLS.
- `src/lib/datos/casos-aliados.ts` — `listarCasosAliados()` (lee la vista con `crearClienteAnonimo`).
- `src/app/[locale]/casos-aliados/page.tsx` — server component con las tarjetas.
- `src/app/[locale]/casos-aliados/Miniatura.tsx` — client component (`<img>` con fallback `onError`).
- `src/messages/es.json`, `en.json` — `nav.casosAliados` + bloque `casosAliados`.
- `src/componentes/Navegacion.tsx` — enlace nuevo.
- `scripts/aplicar-migraciones.mjs` — registrar `0012`.
- `tests/unit/casos-aliados.test.ts` — tests de `mapeo.mjs`.

---

## Task 1: Mapeo puro + tests

**Files:**
- Create: `scripts/casos-aliados/mapeo.mjs`
- Test: `tests/unit/casos-aliados.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/casos-aliados.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { primeraImagen, mapearCaso } from '../../scripts/casos-aliados/mapeo.mjs'

const itemBase = {
  case_id: 'MI-T-ArjJAJB',
  estado: 'ACTIVO',
  prioridad: 'ALTA',
  titulo: 'Familia en Arauca (Palestina) necesita materiales',
  resumen_corto: 'El terremoto dejó la vivienda con grietas.',
  municipio: 'Palestina',
  sector: 'Arauca',
  grupos_objetivo: 'ADULTOS|NINOS_ADOLESCENTES',
  tipos_necesidad: 'CONSTRUCCION_REPARACIONES',
  necesidades_detalle: 'Materiales',
  descripcion_publica: 'Desde el terremoto…',
  como_ayudar: 'Usa el botón…',
  contacto_publico: 'Juan Pérez',
  telefono_publico: '3001234567',
  breb_llave: '3225158917',
  breb_entidad: '',
  fecha_verificacion: '2026-08-15T20:19:18.618Z',
  finalizado: false,
  orden: 100,
  imagen_1_url: '',
  imagen_2_url: 'https://mimanizales.info/wp-content/uploads/2026/08/b.jpg',
  imagen_3_url: 'https://mimanizales.info/wp-content/uploads/2026/08/c.jpg',
}

describe('casos-aliados mapeo', () => {
  it('primeraImagen devuelve la primera url no vacía', () => {
    expect(primeraImagen(itemBase)).toBe('https://mimanizales.info/wp-content/uploads/2026/08/b.jpg')
    expect(primeraImagen({ imagen_1_url: '', imagen_2_url: '' })).toBe('')
  })

  it('mapearCaso arma url_origen, imagen_url y campos públicos', () => {
    const r = mapearCaso(itemBase)
    expect(r.case_id).toBe('MI-T-ArjJAJB')
    expect(r.url_origen).toBe('https://mimanizales.info/caso/?id=MI-T-ArjJAJB')
    expect(r.imagen_url).toBe('https://mimanizales.info/wp-content/uploads/2026/08/b.jpg')
    expect(r.municipio).toBe('Palestina')
    expect(r.tipos_necesidad).toBe('CONSTRUCCION_REPARACIONES')
    expect(r.orden).toBe(100)
    expect(r.finalizado).toBe(false)
  })

  it('mapearCaso NO copia contacto ni datos de pago (garantía de privacidad)', () => {
    const claves = Object.keys(mapearCaso(itemBase))
    for (const prohibida of ['contacto_publico', 'telefono_publico', 'breb_llave', 'breb_entidad', 'descripcion_publica', 'como_ayudar']) {
      expect(claves).not.toContain(prohibida)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/casos-aliados.test.ts`
Expected: FAIL — no puede resolver `mapeo.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/casos-aliados/mapeo.mjs`:

```js
// Mapeo puro de un caso del API de mimanizales a una fila de casos_aliados.
// Descarta a propósito contacto y datos de pago (breb): no se guardan.

export function primeraImagen(item) {
  for (let i = 1; i <= 10; i++) {
    const u = item['imagen_' + i + '_url']
    if (u && String(u).trim()) return String(u).trim()
  }
  return ''
}

export function mapearCaso(item) {
  const caseId = String(item.case_id ?? '').trim()
  return {
    case_id: caseId,
    titulo: String(item.titulo ?? '').trim(),
    resumen_corto: item.resumen_corto ?? null,
    municipio: item.municipio ?? null,
    sector: item.sector ?? null,
    prioridad: item.prioridad ?? null,
    grupos_objetivo: item.grupos_objetivo ?? null,
    tipos_necesidad: item.tipos_necesidad ?? null,
    necesidades_detalle: item.necesidades_detalle ?? null,
    imagen_url: primeraImagen(item),
    url_origen: 'https://mimanizales.info/caso/?id=' + caseId,
    estado: item.estado ?? 'ACTIVO',
    finalizado: item.finalizado === true,
    fecha_verificacion: item.fecha_verificacion ?? null,
    orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : 100,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/casos-aliados.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/casos-aliados/mapeo.mjs tests/unit/casos-aliados.test.ts
git commit -m "feat: mapeo puro de casos aliados (descarta contacto/pago)"
```

---

## Task 2: Migración `0012_casos_aliados.sql` + registro

**Files:**
- Create: `supabase/migrations/0012_casos_aliados.sql`
- Modify: `scripts/aplicar-migraciones.mjs`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0012_casos_aliados.sql`:

```sql
-- Casos de portales aliados (MiManizales.info). Solo campos públicos, sin contacto ni pago.
create table casos_aliados (
  case_id text primary key,
  titulo text not null,
  resumen_corto text,
  municipio text,
  sector text,
  prioridad text,
  grupos_objetivo text,
  tipos_necesidad text,
  necesidades_detalle text,
  imagen_url text,
  url_origen text not null,
  estado text not null default 'ACTIVO',
  finalizado boolean not null default false,
  fecha_verificacion timestamptz,
  orden int not null default 100,
  sincronizado_en timestamptz not null default now()
);

alter table casos_aliados enable row level security;
-- Sin políticas de escritura para anon/authenticated: solo el script de sync
-- (conexión de servicio vía SUPABASE_DB_URL) escribe, saltándose RLS.

create view casos_aliados_publicos as
  select case_id, titulo, resumen_corto, municipio, sector, prioridad,
         grupos_objetivo, tipos_necesidad, necesidades_detalle, imagen_url,
         url_origen, fecha_verificacion, sincronizado_en
  from casos_aliados
  where estado = 'ACTIVO' and not finalizado
  order by case prioridad when 'ALTA' then 0 when 'MEDIA' then 1 else 2 end,
           orden asc, fecha_verificacion desc nulls last;

grant select on casos_aliados_publicos to anon, authenticated;
```

- [ ] **Step 2: Register the migration**

In `scripts/aplicar-migraciones.mjs`, find the `TODAS` array (lista de rutas de migraciones) and add the new entry after `'supabase/migrations/0011_acopios_publicos.sql'`:

```js
  'supabase/migrations/0012_casos_aliados.sql',
```

- [ ] **Step 3: Verify registration**

Run: `grep -n "0012_casos_aliados" scripts/aplicar-migraciones.mjs`
Expected: una línea con la ruta registrada.

(Aplicar la migración es un paso con base de datos: `node scripts/aplicar-migraciones.mjs 0012`. Requiere `SUPABASE_DB_URL` en `.env.local`; lo corre el usuario/entorno con acceso a la base — no forma parte de la verificación automática de este task.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_casos_aliados.sql scripts/aplicar-migraciones.mjs
git commit -m "feat: migración 0012 casos_aliados (tabla + vista pública)"
```

---

## Task 3: Script de sync

**Files:**
- Create: `scripts/casos-aliados/sincronizar.mjs`

- [ ] **Step 1: Write the sync script**

Create `scripts/casos-aliados/sincronizar.mjs`:

```js
// Sincroniza casos_aliados desde el API de mimanizales.info.
// Uso: node scripts/casos-aliados/sincronizar.mjs [--dry-run]
// Descarta contacto/pago vía mapearCaso. Una sola llamada al API por corrida.
import { config } from 'dotenv'
import pg from 'pg'
import { mapearCaso } from './mapeo.mjs'

config({ path: '.env.local' })

const API = 'https://n8n.srv1571385.hstgr.cloud/webhook/mimanizales/necesidades'
const dryRun = process.argv.includes('--dry-run')

let items
try {
  const r = await fetch(API, { headers: { Accept: 'application/json' } })
  const j = await r.json()
  items = j.items || []
} catch (e) {
  console.error('❌ No se pudo leer el API:', e.message)
  process.exit(1)
}
if (!items.length) { console.error('❌ El API no devolvió casos; no se toca la base.'); process.exit(1) }

const filas = items.map(mapearCaso).filter((f) => f.case_id)
console.log(`ℹ️  ${filas.length} casos recibidos del API`)
if (dryRun) { console.log('🧪 dry-run: no se escribió nada'); process.exit(0) }

const url = process.env.SUPABASE_DB_URL
if (!url) { console.error('❌ Falta SUPABASE_DB_URL en .env.local'); process.exit(1) }

const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
} catch (e) {
  console.error('❌ No se pudo conectar a la base:', e.message)
  process.exit(1)
}
let n = 0
try {
  for (const f of filas) {
    await client.query(
      `insert into casos_aliados
         (case_id, titulo, resumen_corto, municipio, sector, prioridad, grupos_objetivo,
          tipos_necesidad, necesidades_detalle, imagen_url, url_origen, estado, finalizado,
          fecha_verificacion, orden, sincronizado_en)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
       on conflict (case_id) do update set
         titulo = excluded.titulo, resumen_corto = excluded.resumen_corto,
         municipio = excluded.municipio, sector = excluded.sector,
         prioridad = excluded.prioridad, grupos_objetivo = excluded.grupos_objetivo,
         tipos_necesidad = excluded.tipos_necesidad, necesidades_detalle = excluded.necesidades_detalle,
         imagen_url = excluded.imagen_url, url_origen = excluded.url_origen,
         estado = excluded.estado, finalizado = excluded.finalizado,
         fecha_verificacion = excluded.fecha_verificacion, orden = excluded.orden,
         sincronizado_en = now()`,
      [f.case_id, f.titulo, f.resumen_corto, f.municipio, f.sector, f.prioridad, f.grupos_objetivo,
       f.tipos_necesidad, f.necesidades_detalle, f.imagen_url, f.url_origen, f.estado, f.finalizado,
       f.fecha_verificacion, f.orden],
    )
    n++
  }
  const ids = filas.map((f) => f.case_id)
  const aus = await client.query(
    `update casos_aliados set estado = 'AUSENTE', sincronizado_en = now() where not (case_id = any($1))`,
    [ids],
  )
  console.log(`✅ sincronizados: ${n} | marcados ausentes: ${aus.rowCount}`)
} finally {
  await client.end()
}
```

- [ ] **Step 2: Verify with --dry-run (necesita red, no base)**

Run: `node scripts/casos-aliados/sincronizar.mjs --dry-run`
Expected: `ℹ️  32 casos recibidos del API` seguido de `🧪 dry-run: no se escribió nada`. (El número puede variar según cuántos casos activos haya; debe ser > 0.)

- [ ] **Step 3: Commit**

```bash
git add scripts/casos-aliados/sincronizar.mjs
git commit -m "feat: sync de casos aliados desde el API de mimanizales"
```

---

## Task 4: Capa de datos + i18n + navegación

**Files:**
- Create: `src/lib/datos/casos-aliados.ts`
- Modify: `src/messages/es.json`, `src/messages/en.json`
- Modify: `src/componentes/Navegacion.tsx`

- [ ] **Step 1: Data layer**

Create `src/lib/datos/casos-aliados.ts`:

```ts
import { crearClienteAnonimo } from '@/lib/supabase/cliente'

export async function listarCasosAliados() {
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('casos_aliados_publicos').select('*')
  if (error) throw new Error(error.message)
  return data ?? []
}
```

- [ ] **Step 2: i18n — español**

In `src/messages/es.json`, add `"casosAliados": "Casos aliados"` inside the `nav` object, and add this top-level block (junto a los otros bloques de sección):

```json
"casosAliados": {
  "titulo": "Casos aliados",
  "intro": "Casos de personas y familias que necesitan apoyo, publicados por nuestro aliado. Al abrir un caso verás sus datos de contacto en el sitio de origen.",
  "atribucion": "Casos de nuestro aliado",
  "verCaso": "Ver caso en MiManizales",
  "sinCasos": "No hay casos aliados por ahora.",
  "prioridad": { "ALTA": "Alta", "MEDIA": "Media", "BAJA": "Baja" },
  "grupos": {
    "BEBES": "Bebés",
    "NINOS_ADOLESCENTES": "Niños y adolescentes",
    "ADULTOS": "Adultos",
    "ADULTOS_MAYORES": "Adultos mayores",
    "DISCAPACIDAD_DEPENDENCIA": "Discapacidad o dependencia",
    "MASCOTAS_ANIMALES": "Mascotas y animales",
    "FUNDACIONES_ENTIDADES": "Fundaciones / Entidades"
  },
  "tipos": {
    "ALIMENTACION": "Alimentación",
    "CONSTRUCCION_REPARACIONES": "Construcción / reparaciones",
    "EDUCACION_UTILES": "Educación / útiles",
    "ENSERES_HOGAR": "Enseres del hogar",
    "HIGIENE_CUIDADO": "Higiene y cuidado",
    "MOVILIDAD_AYUDAS_TECNICAS": "Movilidad / ayudas técnicas",
    "ROPA_CALZADO": "Ropa y calzado",
    "SALUD_MEDICAMENTOS": "Salud / medicamentos",
    "SERVICIOS_BASICOS": "Servicios básicos",
    "VIVIENDA": "Vivienda"
  }
}
```

- [ ] **Step 3: i18n — inglés**

In `src/messages/en.json`, add `"casosAliados": "Allied cases"` inside the `nav` object, and add:

```json
"casosAliados": {
  "titulo": "Allied cases",
  "intro": "People and families needing support, posted by our ally. Open a case to see its contact details on the source site.",
  "atribucion": "Cases from our ally",
  "verCaso": "View case on MiManizales",
  "sinCasos": "No allied cases right now.",
  "prioridad": { "ALTA": "High", "MEDIA": "Medium", "BAJA": "Low" },
  "grupos": {
    "BEBES": "Babies",
    "NINOS_ADOLESCENTES": "Children & teens",
    "ADULTOS": "Adults",
    "ADULTOS_MAYORES": "Older adults",
    "DISCAPACIDAD_DEPENDENCIA": "Disability or dependency",
    "MASCOTAS_ANIMALES": "Pets & animals",
    "FUNDACIONES_ENTIDADES": "Foundations / Entities"
  },
  "tipos": {
    "ALIMENTACION": "Food",
    "CONSTRUCCION_REPARACIONES": "Construction / repairs",
    "EDUCACION_UTILES": "Education / supplies",
    "ENSERES_HOGAR": "Household goods",
    "HIGIENE_CUIDADO": "Hygiene & care",
    "MOVILIDAD_AYUDAS_TECNICAS": "Mobility / assistive devices",
    "ROPA_CALZADO": "Clothing & footwear",
    "SALUD_MEDICAMENTOS": "Health / medicine",
    "SERVICIOS_BASICOS": "Basic utilities",
    "VIVIENDA": "Housing"
  }
}
```

- [ ] **Step 4: Verify JSON is valid**

Run: `node -e "const es=require('./src/messages/es.json'), en=require('./src/messages/en.json'); if(!es.casosAliados||!en.casosAliados||!es.nav.casosAliados||!en.nav.casosAliados) throw new Error('falta bloque'); console.log('i18n OK')"`
Expected: `i18n OK`

- [ ] **Step 5: Navegación**

Read `src/componentes/Navegacion.tsx`. Find where the existing nav links are rendered (e.g. the entry for `nav.novedades` → `/novedades`) and add an entry for casos aliados **matching that exact pattern** (same component/markup the file already uses), pointing to `/casos-aliados` with the label `t('casosAliados')` (from the `nav` namespace). Do not restructure the file — mirror one existing link.

- [ ] **Step 6: Commit**

```bash
git add src/lib/datos/casos-aliados.ts src/messages/es.json src/messages/en.json src/componentes/Navegacion.tsx
git commit -m "feat: capa de datos, i18n y nav de casos aliados"
```

---

## Task 5: Página + miniatura

**Files:**
- Create: `src/app/[locale]/casos-aliados/Miniatura.tsx`
- Create: `src/app/[locale]/casos-aliados/page.tsx`

- [ ] **Step 1: Client component de la miniatura (para el fallback onError)**

Create `src/app/[locale]/casos-aliados/Miniatura.tsx`:

```tsx
'use client'

// Miniatura hotlinked desde mimanizales; si la imagen falla, se oculta.
export function Miniatura({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-40 w-full object-cover"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}
```

- [ ] **Step 2: Página**

Create `src/app/[locale]/casos-aliados/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarCasosAliados } from '@/lib/datos/casos-aliados'
import { Miniatura } from './Miniatura'

const COLOR_PRIORIDAD: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800',
  MEDIA: 'bg-amber-100 text-amber-800',
  BAJA: 'bg-gray-100 text-gray-700',
}

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('casosAliados')
  const casos = await listarCasosAliados()

  const etiqueta = (grupo: 'grupos' | 'tipos' | 'prioridad', codigo: string) =>
    t.has(`${grupo}.${codigo}`) ? t(`${grupo}.${codigo}`) : codigo
  const codigos = (s: string | null) => (s ?? '').split('|').filter(Boolean)

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-extrabold">{t('titulo')}</h1>
      <p className="mb-1 text-gray-600">{t('intro')}</p>
      <p className="mb-6 text-sm text-gray-500">
        {t('atribucion')}{' '}
        <a
          href="https://mimanizales.info"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline"
        >
          MiManizales.info
        </a>
      </p>

      {casos.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('sinCasos')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {casos.map((c) => (
            <article
              key={c.case_id}
              className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              {c.imagen_url ? <Miniatura src={c.imagen_url} /> : null}
              <div className="flex flex-1 flex-col p-4">
                {c.prioridad ? (
                  <span
                    className={`mb-2 w-fit rounded-full px-2 py-0.5 text-xs font-bold ${
                      COLOR_PRIORIDAD[c.prioridad] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {etiqueta('prioridad', c.prioridad)}
                  </span>
                ) : null}
                <h2 className="text-base font-bold">{c.titulo}</h2>
                {c.municipio || c.sector ? (
                  <p className="mt-1 text-xs text-gray-500">
                    📍 {[c.sector, c.municipio].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                {codigos(c.tipos_necesidad).length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {codigos(c.tipos_necesidad).map((code) => (
                      <span key={code} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {etiqueta('tipos', code)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {c.necesidades_detalle ? (
                  <p className="mt-2 text-sm text-gray-700">{c.necesidades_detalle}</p>
                ) : null}
                {c.resumen_corto ? (
                  <p className="mt-1 line-clamp-3 text-sm text-gray-600">{c.resumen_corto}</p>
                ) : null}
                <a
                  href={c.url_origen}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {t('verCaso')}
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/casos-aliados/
git commit -m "feat: página /casos-aliados con miniatura enlazada y enlace externo"
```

---

## Task 6: Verificación completa

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: toda la suite en verde, incluida `casos-aliados.test.ts`.

- [ ] **Step 2: Build (typecheck + compilación)**

Run: `npm run build`
Expected: build exitoso, con la ruta `/[locale]/casos-aliados` en la lista de rutas. Si hay error de tipos por `t.has`, confirmar que la versión de next-intl del repo lo soporta; si no, reemplazar `t.has(k) ? t(k) : codigo` por un mapa local de etiquetas en el componente (mismo contenido que el i18n) — pero primero intentar `t.has`, que es estándar en next-intl v3+.

- [ ] **Step 3: Commit (si el build requirió algún ajuste)**

```bash
git add -A
git commit -m "chore: ajustes de verificación de casos aliados"
```

(Si no hubo ajustes, omitir este commit.)

---

## Self-Review

**Spec coverage:**
- Fuente API + descarte de contacto/breb: `mapearCaso` (Task 1) + test de ausencia de claves. ✓
- Tabla + vista pública + RLS: migración 0012 (Task 2). ✓
- Sync idempotente + ausentes: `sincronizar.mjs` (Task 3). ✓
- Capa de datos desde la vista: `casos-aliados.ts` (Task 4). ✓
- Página con miniatura enlazada, prioridad, tipos, enlace externo + atribución: Task 5. ✓
- Nav + i18n bilingüe (7 grupos, 10 tipos, prioridades): Task 4. ✓
- Fallback de imagen: `Miniatura.tsx` client component (Task 5). ✓
- Verificación (tests + build): Task 6. ✓

**Placeholder scan:** sin TBD/TODO; todo el código está completo. Único punto "condicional": el fallback de `t.has` en Task 6, con instrucción concreta si fallara.

**Type consistency:** `mapearCaso` emite las columnas que el `insert` de `sincronizar.mjs` lista y que la tabla `0012` define; la vista `casos_aliados_publicos` expone el subconjunto que la página consume (`case_id, titulo, resumen_corto, municipio, sector, prioridad, grupos_objetivo, tipos_necesidad, necesidades_detalle, imagen_url, url_origen, fecha_verificacion, sincronizado_en`). Claves i18n (`grupos.*`, `tipos.*`, `prioridad.*`) coinciden entre es.json/en.json y los `etiqueta(...)` del componente.

---

## Notas de ejecución

- **Aplicar la migración y correr el sync tocan la base de producción** (ayudacol.org). Están fuera de la verificación automática; los corre el usuario (o quien tenga `SUPABASE_DB_URL` y permiso). Orden: (1) `node scripts/aplicar-migraciones.mjs 0012`; (2) `node scripts/casos-aliados/sincronizar.mjs --dry-run`; (3) `node scripts/casos-aliados/sincronizar.mjs`.
- **Despliegue:** la página nueva sale en vivo al hacer push a `main` (Vercel).
