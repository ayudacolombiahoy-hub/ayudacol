# Imágenes y botón de acción en Novedades — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir publicar afiches informativos en Novedades: subir varias imágenes + un botón de acción opcional, manteniendo el texto bilingüe existente.

**Architecture:** Se *extiende* la sección Novedades ya existente. Columnas nuevas en la tabla (`fotos text[]`, `enlace`, `enlace_texto_es/en`) reutilizando el patrón multi-foto de mascotas/desaparecidos. El formulario admin reutiliza el componente `SubirFotos`; la página pública muestra imágenes arriba + botón. Fotos y enlace son opcionales, así que las novedades solo-texto siguen funcionando.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Supabase (Postgres + RLS), zod, next-intl, Tailwind, vitest.

**Precondición de rama:** Este plan se ejecuta en una rama limpia `feat/novedades-imagenes`, creada **después** de que la otra sesión commitee su trabajo de acopios (migración `0020` + su edición a `scripts/aplicar-migraciones.mjs`). No empezar antes: `scripts/aplicar-migraciones.mjs` es un archivo compartido y editarlo con acopios sin commitear provocaría conflicto.

**Nota sobre tests:** El repo tiene 2 suites de integración (`tests/integracion/`) que golpean la BD real y pueden fallar por datos residuales, no por regresión. Por eso los pasos corren tests **unitarios puntuales** (`npx vitest run tests/unit/...`), no toda la suite.

---

## Estructura de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `supabase/migrations/0021_novedades_imagen.sql` | Columnas nuevas en `novedades` | Crear |
| `scripts/aplicar-migraciones.mjs` | Índice de migraciones a aplicar | Modificar (añadir 0021) |
| `src/lib/validacion/esquemas.ts` | `esquemaNovedad` (+ campos enlace) | Modificar |
| `src/lib/datos/fotos.ts` | Helper puro `fotosDe` (normaliza URLs del form) | Crear |
| `src/lib/datos/novedades.ts` | `crearNovedad` (mezcla fotos + enlace en el insert) | Modificar |
| `src/app/[locale]/admin/novedades/acciones.ts` | Leer campos nuevos del FormData | Modificar |
| `src/messages/es.json`, `src/messages/en.json` | Labels i18n (paridad exacta) | Modificar |
| `src/app/[locale]/admin/novedades/FormularioNovedad.tsx` | SubirFotos + inputs de enlace | Modificar |
| `src/app/[locale]/novedades/page.tsx` | Render de imágenes + botón | Modificar |
| `tests/unit/novedades.test.ts` | Tests de `esquemaNovedad` y `fotosDe` | Crear |

Fuera de este plan (nicety opcional, no bloquea): miniatura de `fotos[0]` en `FilaNovedad.tsx` del panel admin.

---

## Task 1: Migración 0021 — columnas nuevas en `novedades`

**Files:**
- Create: `supabase/migrations/0021_novedades_imagen.sql`
- Modify: `scripts/aplicar-migraciones.mjs` (array `TODAS`, tras la línea de `0020`)

- [ ] **Step 1: Crear la migración**

Crear `supabase/migrations/0021_novedades_imagen.sql` con:

```sql
-- Novedades: afiches informativos. Imágenes múltiples (patrón fotos[] de mascotas/
-- desaparecidos) + botón de acción opcional (enlace + etiqueta bilingüe).
-- Novedades no tiene vista pública (la página lee la tabla directo con RLS), así que
-- no hay vista que dropear/recrear. Idempotente.
alter table novedades add column if not exists fotos text[] not null default '{}';
alter table novedades add column if not exists enlace text;
alter table novedades add column if not exists enlace_texto_es text;
alter table novedades add column if not exists enlace_texto_en text;
```

- [ ] **Step 2: Registrar la migración en el aplicador**

En `scripts/aplicar-migraciones.mjs`, añadir al final del array `TODAS` (después de la línea `'supabase/migrations/0020_acopios_multi_foto.sql',`):

```js
  'supabase/migrations/0021_novedades_imagen.sql',
```

- [ ] **Step 3: Aplicar la migración a Supabase**

Run: `node scripts/aplicar-migraciones.mjs 0021`
Expected: `Aplicando supabase/migrations/0021_novedades_imagen.sql ... OK` y `✅ Migraciones aplicadas: 1`.
(Requiere `SUPABASE_DB_URL` en `.env.local`. Es idempotente: `add column if not exists`.)

- [ ] **Step 4: Verificar que las columnas existen**

Run:
```bash
node -e "import('dotenv').then(d=>{d.config({path:'.env.local'});import('pg').then(async({default:pg})=>{const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});await c.connect();const r=await c.query(\"select column_name from information_schema.columns where table_name='novedades' and column_name in ('fotos','enlace','enlace_texto_es','enlace_texto_en') order by column_name\");console.log(r.rows.map(x=>x.column_name));await c.end()})})"
```
Expected: `[ 'enlace', 'enlace_texto_en', 'enlace_texto_es', 'fotos' ]`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0021_novedades_imagen.sql scripts/aplicar-migraciones.mjs
git commit -m "feat(novedades): migración 0021 — imágenes + botón de acción"
```

---

## Task 2: Esquema de validación — campos de enlace en `esquemaNovedad`

**Files:**
- Test: `tests/unit/novedades.test.ts` (crear)
- Modify: `src/lib/validacion/esquemas.ts` (bloque `esquemaNovedad`, ~línea 105)

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/novedades.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { esquemaNovedad } from '../../src/lib/validacion/esquemas'

const base = {
  titulo_es: 'Subsidio de arrendamiento',
  titulo_en: 'Rent subsidy',
  contenido_es: 'Auxilio para damnificados del terremoto del 10 de agosto.',
  contenido_en: 'Aid for people affected by the August 10 earthquake.',
}

describe('esquemaNovedad', () => {
  test('acepta una novedad válida sin enlace', () => {
    expect(esquemaNovedad.safeParse(base).success).toBe(true)
  })

  test('acepta enlace y textos vacíos (opcionales)', () => {
    const r = esquemaNovedad.safeParse({ ...base, enlace: '', enlace_texto_es: '', enlace_texto_en: '' })
    expect(r.success).toBe(true)
  })

  test('acepta un enlace válido con texto de botón', () => {
    const r = esquemaNovedad.safeParse({ ...base, enlace: 'https://mizl.gov.co/turno', enlace_texto_es: 'Agenda tu turno', enlace_texto_en: 'Book your slot' })
    expect(r.success).toBe(true)
  })

  test('rechaza un enlace que no es URL', () => {
    expect(esquemaNovedad.safeParse({ ...base, enlace: 'no-soy-url' }).success).toBe(false)
  })

  test('rechaza texto de botón demasiado largo (>60)', () => {
    expect(esquemaNovedad.safeParse({ ...base, enlace_texto_es: 'x'.repeat(61) }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/novedades.test.ts`
Expected: FALLA — el caso "rechaza un enlace que no es URL" pasa `enlace` que hoy el esquema ignora (no valida), así que `success` es `true` cuando se espera `false`.

- [ ] **Step 3: Añadir los campos al esquema**

En `src/lib/validacion/esquemas.ts`, reemplazar el bloque `esquemaNovedad` por:

```ts
export const esquemaNovedad = z.object({
  titulo_es: z.string().trim().min(3).max(200),
  titulo_en: z.string().trim().min(3).max(200),
  contenido_es: z.string().trim().min(10).max(5000),
  contenido_en: z.string().trim().min(10).max(5000),
  enlace: z.string().trim().url().max(500).optional().or(z.literal('')),
  enlace_texto_es: z.string().trim().max(60).optional().or(z.literal('')),
  enlace_texto_en: z.string().trim().max(60).optional().or(z.literal('')),
})
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/novedades.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/unit/novedades.test.ts src/lib/validacion/esquemas.ts
git commit -m "feat(novedades): validar enlace opcional en esquemaNovedad"
```

---

## Task 3: Helper `fotosDe` + capa de datos

**Files:**
- Create: `src/lib/datos/fotos.ts`
- Modify: `tests/unit/novedades.test.ts` (añadir bloque `fotosDe`)
- Modify: `src/lib/datos/novedades.ts` (`crearNovedad`)

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `tests/unit/novedades.test.ts`:

```ts
import { fotosDe } from '../../src/lib/datos/fotos'

describe('fotosDe', () => {
  test('devuelve el arreglo de URLs http(s) válidas', () => {
    expect(fotosDe({ fotos: ['https://x.co/a.jpg', 'http://x.co/b.png'] })).toEqual([
      'https://x.co/a.jpg', 'http://x.co/b.png',
    ])
  })

  test('acepta un valor suelto (no arreglo)', () => {
    expect(fotosDe({ fotos: 'https://x.co/a.jpg' })).toEqual(['https://x.co/a.jpg'])
  })

  test('descarta cadenas que no son URL http(s)', () => {
    expect(fotosDe({ fotos: ['no-url', '', 'https://x.co/ok.jpg'] })).toEqual(['https://x.co/ok.jpg'])
  })

  test('devuelve [] cuando no hay fotos', () => {
    expect(fotosDe({})).toEqual([])
    expect(fotosDe(null)).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/novedades.test.ts`
Expected: FALLA al importar — `Failed to resolve import '../../src/lib/datos/fotos'` (el archivo aún no existe).

- [ ] **Step 3: Crear el helper puro**

Crear `src/lib/datos/fotos.ts`:

```ts
// Normaliza la entrada del formulario múltiple (SubirFotos) a un arreglo de URLs
// válidas. Acepta un arreglo, un valor suelto o vacío; filtra lo que no sea http(s).
// Pura y sin dependencias de servidor, para poder testearla en unit.
// (mascotas/desaparecidos tienen su propia copia local; unificarlas es un cleanup aparte.)
export function fotosDe(entrada: unknown): string[] {
  const e = entrada as { fotos?: unknown } | null
  const raw = Array.isArray(e?.fotos) ? e!.fotos : e?.fotos ? [e!.fotos] : []
  return raw.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((s) => /^https?:\/\//.test(s))
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/novedades.test.ts`
Expected: PASS (9 tests en total).

- [ ] **Step 5: Mezclar fotos y enlace en el insert**

En `src/lib/datos/novedades.ts`, añadir el import al principio (junto a los otros imports):

```ts
import { fotosDe } from './fotos'
```

Y reemplazar la función `crearNovedad` por:

```ts
export async function crearNovedad(entrada: unknown) {
  const p = esquemaNovedad.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb.from('novedades').insert({
    ...p.data,
    enlace: p.data.enlace || null,
    enlace_texto_es: p.data.enlace_texto_es || null,
    enlace_texto_en: p.data.enlace_texto_en || null,
    fotos: fotosDe(entrada),
  })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}
```

- [ ] **Step 6: Verificar que compila (typecheck rápido)**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/lib/datos/fotos.ts src/lib/datos/novedades.ts tests/unit/novedades.test.ts
git commit -m "feat(novedades): guardar fotos[] y enlace en crearNovedad"
```

---

## Task 4: i18n — labels de imágenes y enlace (paridad es/en)

**Files:**
- Modify: `src/messages/es.json` (objeto `novedades`)
- Modify: `src/messages/en.json` (objeto `novedades`)

El test `tests/unit/mensajes-paridad.test.ts` exige que ambos archivos tengan **exactamente las mismas claves**, así que se añaden las 5 claves a los dos.

- [ ] **Step 1: Añadir claves en `src/messages/es.json`**

Dentro del objeto `"novedades"`, tras `"contenidoEn": "Contenido (inglés)"`, añadir la coma y estas claves:

```json
    "imagenes": "Imágenes (afiche, opcional)",
    "enlace": "Enlace del botón (opcional)",
    "enlaceTextoEs": "Texto del botón (español)",
    "enlaceTextoEn": "Texto del botón (inglés)",
    "verMas": "Ver más"
```

- [ ] **Step 2: Añadir las mismas claves en `src/messages/en.json`**

Dentro del objeto `"novedades"`, tras `"contenidoEn": "Content (English)"`, añadir la coma y estas claves:

```json
    "imagenes": "Images (flyer, optional)",
    "enlace": "Button link (optional)",
    "enlaceTextoEs": "Button text (Spanish)",
    "enlaceTextoEn": "Button text (English)",
    "verMas": "Learn more"
```

- [ ] **Step 3: Verificar paridad de claves**

Run: `npx vitest run tests/unit/mensajes-paridad.test.ts`
Expected: PASS (es.json y en.json tienen exactamente las mismas claves).

- [ ] **Step 4: Commit**

```bash
git add src/messages/es.json src/messages/en.json
git commit -m "feat(novedades): i18n para imágenes y botón de acción"
```

---

## Task 5: Acción del formulario — leer los campos nuevos

**Files:**
- Modify: `src/app/[locale]/admin/novedades/acciones.ts` (`accionCrearNovedad`)

- [ ] **Step 1: Añadir los campos nuevos al objeto `entrada`**

En `src/app/[locale]/admin/novedades/acciones.ts`, reemplazar la construcción de `entrada` dentro de `accionCrearNovedad` por:

```ts
  const entrada = {
    titulo_es: formData.get('titulo_es'), titulo_en: formData.get('titulo_en'),
    contenido_es: formData.get('contenido_es'), contenido_en: formData.get('contenido_en'),
    enlace: formData.get('enlace'),
    enlace_texto_es: formData.get('enlace_texto_es'),
    enlace_texto_en: formData.get('enlace_texto_en'),
    fotos: formData.getAll('fotos') as string[],
  }
```

(El resto de la función —`crearNovedad`, `revalidatePath`, `return`— no cambia.)

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/admin/novedades/acciones.ts"
git commit -m "feat(novedades): la acción lee fotos y enlace del formulario"
```

---

## Task 6: Formulario admin — SubirFotos + inputs de enlace

**Files:**
- Modify: `src/app/[locale]/admin/novedades/FormularioNovedad.tsx`

- [ ] **Step 1: Importar `SubirFotos`**

En `src/app/[locale]/admin/novedades/FormularioNovedad.tsx`, añadir junto a los otros imports:

```tsx
import SubirFotos from '@/componentes/formularios/SubirFotos'
```

- [ ] **Step 2: Añadir los campos al formulario**

Insertar, justo **después** del `<Campo>` de `contenido_en` (línea del `</Campo>` que cierra el textarea `contenido_en`) y **antes** de la línea `{e._ && ...}`:

```tsx
      <SubirFotos name="fotos" label={t('imagenes')} max={8} />
      <Campo etiqueta={t('enlace')} htmlFor="enlace" errores={e.enlace}>
        <input id="enlace" name="enlace" type="url" placeholder="https://…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('enlaceTextoEs')} htmlFor="enlace_texto_es" errores={e.enlace_texto_es}>
        <input id="enlace_texto_es" name="enlace_texto_es" type="text" maxLength={60}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('enlaceTextoEn')} htmlFor="enlace_texto_en" errores={e.enlace_texto_en}>
        <input id="enlace_texto_en" name="enlace_texto_en" type="text" maxLength={60}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/admin/novedades/FormularioNovedad.tsx"
git commit -m "feat(novedades): subida de imágenes y campos de enlace en el formulario"
```

---

## Task 7: Vista pública — imágenes arriba + botón de acción

**Files:**
- Modify: `src/app/[locale]/novedades/page.tsx` (el `<article>` dentro del `.map`)

- [ ] **Step 1: Reemplazar el `<article>` por la versión con imágenes y botón**

En `src/app/[locale]/novedades/page.tsx`, reemplazar el bloque `<article key={n.id} ...> ... </article>` por:

```tsx
            <article key={n.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {n.fotos?.length > 0 && (
                <div className="flex flex-col">
                  {n.fotos.map((url: string) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" className="w-full object-contain" />
                  ))}
                </div>
              )}
              <div className="p-5">
                <h2 className="text-lg font-bold">{es ? n.titulo_es : n.titulo_en}</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{es ? n.contenido_es : n.contenido_en}</p>
                {n.enlace && (
                  <a href={n.enlace} target="_blank" rel="noopener noreferrer"
                    className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                    {(es ? n.enlace_texto_es : n.enlace_texto_en) || t('verMas')} →
                  </a>
                )}
                <p className="mt-3 text-xs text-gray-500">🕓 {tiempoRelativo(n.creada_en, localeActual)}</p>
              </div>
            </article>
```

Nota: se movió el `p-5` del `<article>` a un `<div>` interior para que las imágenes ocupen todo el ancho de la tarjeta. `object-contain` evita recortar los afiches (suelen ser altos).

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificar lint (uso de `<img>`)**

Run: `npm run lint`
Expected: sin errores (el `eslint-disable-next-line @next/next/no-img-element` cubre el `<img>`, igual que en `SubirFotos.tsx`).

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/novedades/page.tsx"
git commit -m "feat(novedades): mostrar imágenes y botón de acción en la página pública"
```

---

## Task 8: Verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Correr los tests unitarios nuevos + paridad**

Run: `npx vitest run tests/unit/novedades.test.ts tests/unit/mensajes-paridad.test.ts`
Expected: PASS (9 + 1).

- [ ] **Step 2: Typecheck y lint completos**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Prueba manual en el navegador**

Run: `npm run dev`
- Ir a `/es/admin/novedades` (requiere sesión admin). Crear una novedad con: 1 imagen, luego probar con varias, y con enlace + texto de botón.
- Ir a `/es/novedades` y `/en/novedades`: verificar que se ven las imágenes arriba, el texto en cada idioma, y que el botón abre el enlace en pestaña nueva.
- Verificar que una novedad vieja (solo texto, sin imagen ni enlace) sigue renderizando bien.

- [ ] **Step 4 (si aplica): Confirmar con el usuario y cerrar la rama**

Seguir la skill `superpowers:finishing-a-development-branch` para decidir merge/PR.

---

## Self-review (cobertura del spec)

- Migración `0021` con `fotos[]` + `enlace` + `enlace_texto_es/en` → Task 1. ✅
- No hay vista pública que recrear → confirmado en la migración. ✅
- `esquemaNovedad` con enlace opcional (fotos fuera del esquema) → Task 2. ✅
- Helper `fotosDe` calcado + insert que mezcla fotos/enlace → Task 3. ✅
- Acción lee `getAll('fotos')` + enlace → Task 5. ✅
- Formulario con `SubirFotos` + campos de enlace → Task 6. ✅
- Página pública: imágenes arriba (apiladas, `object-contain`) + botón si hay enlace → Task 7. ✅
- i18n con paridad es/en → Task 4. ✅
- Fotos/enlace opcionales → las novedades solo-texto siguen funcionando (Task 7 usa `n.fotos?.length` y `n.enlace &&`). ✅
- Pruebas unitarias (`esquemaNovedad`, `fotosDe`) + manual → Tasks 2, 3, 8. ✅
- IA de extracción explícitamente fuera de alcance (fase 2). ✅
