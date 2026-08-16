# Imágenes y botón de acción en Novedades

**Fecha:** 2026-08-16
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

Que el admin pueda publicar **afiches informativos** (ej. el subsidio de arrendamiento
para damnificados del terremoto) en la sección **Novedades**: subir una o varias
imágenes, mantener el texto bilingüe (título + contenido en es/en) y, opcionalmente,
un **botón de acción** con enlace (ej. "Agenda tu turno"). Hoy Novedades es solo texto;
esto llena ese vacío reutilizando los patrones que ya existen en el repo.

## Contexto

La sección Novedades ya existe y funciona:
- Tabla `novedades` (`0007_features.sql`): `titulo_es/en`, `contenido_es/en`,
  `publicada`, `autor`, `creada_en`. RLS: lectura pública si `publicada = true`;
  el admin gestiona todo vía `es_admin()`.
- Página pública `/novedades` (`src/app/[locale]/novedades/page.tsx`): lista tarjetas
  con `select *` (las columnas nuevas fluyen solas).
- Panel admin `/admin/novedades`: `FormularioNovedad` (crear), `FilaNovedad` (listar +
  borrar), `acciones.ts`, `lib/datos/novedades.ts`, `esquemaNovedad` en `esquemas.ts`.
- **Limitación:** no soporta imágenes. El afiche del subsidio no se puede publicar hoy.

Patrones reutilizables ya presentes:
- **Subida múltiple:** `SubirFotos.tsx` sube al bucket público `fotos` y deja cada URL
  en un `<input type="hidden" name="fotos">` → la acción lee `formData.getAll('fotos')`.
- **Columna `fotos text[]`:** estrenada en mascotas (`0017`) y desaparecidos (`0018`),
  con un helper `fotosDe(entrada)` en la capa de datos que normaliza a `string[]`
  (valida `^https?://`) y lo mezcla en el insert, **aparte** del esquema zod.

## Decisiones de diseño

- **Extender Novedades, no crear tabla/sección nueva.** El afiche *es* una novedad; solo
  le faltaba imagen y enlace.
- **Varias imágenes** (`fotos text[]`), reutilizando `SubirFotos` — sirve para carruseles
  de Instagram (afiches de varias diapositivas). Consistente con mascotas/desaparecidos.
- **Botón de acción opcional:** `enlace` (URL) + `enlace_texto_es/en`. En el celular el
  QR del afiche no se escanea, pero un botón sí se toca. Útil para trámites/subsidios.
- **Fotos y enlace son opcionales.** Las novedades solo-texto que ya existan siguen
  funcionando; el default de `fotos` es `'{}'` y `enlace` es `null`.
- **Carga manual** (el admin sube la imagen y escribe el texto es/en). La extracción con
  IA desde la captura queda para una fase 2 (ver "Fuera de alcance").
- **Sin edición in-place.** Se mantiene el comportamiento actual: crear + borrar. (Editar
  se puede añadir después si molesta rehacer un post por un typo.)

## Modelo de datos — `supabase/migrations/0021_novedades_imagen.sql`

Novedades **no tiene vista pública** (la página lee la tabla directo con RLS), así que
no hay vista que dropear/recrear. La migración es solo agregar columnas, idempotente:

```sql
-- Novedades: afiches informativos. Imágenes múltiples (patrón fotos[] de mascotas/
-- desaparecidos) + botón de acción opcional (enlace + etiqueta bilingüe).
alter table novedades add column if not exists fotos text[] not null default '{}';
alter table novedades add column if not exists enlace text;
alter table novedades add column if not exists enlace_texto_es text;
alter table novedades add column if not exists enlace_texto_en text;
```

Las políticas RLS actuales (`lectura_publica_novedades`, `admin_gestiona_novedades`)
ya cubren las columnas nuevas — no hay que tocarlas.

## Validación — `src/lib/validacion/esquemas.ts`

`esquemaNovedad` mantiene título/contenido requeridos y suma el enlace (opcional). Las
**fotos NO van en el esquema** (se normalizan con `fotosDe`, igual que mascotas/desap.):

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

## Guardado — `acciones.ts` + `lib/datos/novedades.ts`

`accionCrearNovedad` suma los campos nuevos al objeto `entrada`:
```ts
fotos: formData.getAll('fotos') as string[],
enlace: formData.get('enlace'),
enlace_texto_es: formData.get('enlace_texto_es'),
enlace_texto_en: formData.get('enlace_texto_en'),
```

`crearNovedad` añade un helper `fotosDe(entrada)` (calcado de `desaparecidos.ts`) y
mezcla en el insert, normalizando vacíos a `null`:
```ts
const { error } = await sb.from('novedades').insert({
  ...p.data,
  enlace: p.data.enlace || null,
  enlace_texto_es: p.data.enlace_texto_es || null,
  enlace_texto_en: p.data.enlace_texto_en || null,
  fotos: fotosDe(entrada),
})
```

## Formulario admin — `FormularioNovedad.tsx`

Se añade, tras los campos de texto:
- `<SubirFotos name="fotos" max={8} />` (label desde i18n).
- Campos opcionales: `enlace` (input url), `enlace_texto_es`, `enlace_texto_en` (inputs
  de texto cortos), envueltos en `Campo` como el resto.

## Vista pública — `novedades/page.tsx`

En cada `<article>`, las imágenes van **arriba** (antes del texto), como una tarjeta de
noticia:
- Si `n.fotos?.length`: renderizar la(s) imagen(es) con `<img>` (responsive, ancho
  completo de la tarjeta, `rounded-lg`, `object-contain` para no recortar el afiche).
  Varias → **apiladas verticalmente** (los afiches suelen ser altos; una grilla los
  recortaría o encogería demasiado).
- Título + contenido en el idioma activo (como hoy).
- Si `n.enlace`: un `<a>` estilo botón con la etiqueta `enlace_texto_es/en` (fallback a un
  texto i18n genérico "Ver más / Learn more"), `target="_blank" rel="noopener noreferrer"`.
- Fecha relativa (como hoy).

El listado admin (`FilaNovedad`) puede mostrar una miniatura de `fotos[0]` (opcional, menor).

## i18n — `messages/es.json` + `messages/en.json`

Namespace `novedades`: añadir `enlace` (label), `enlaceTexto` (label), y `verMas`
(texto por defecto del botón). El namespace `foto` (usado por `SubirFotos`) ya existe.

## Fuera de alcance (v1) / Fase 2

- **Extracción con IA** desde la captura (subir el afiche → IA extrae título/pasos/datos
  y traduce a inglés → el admin revisa). Reutilizaría el patrón de `/panel/capturas`.
- Fijar/destacar publicaciones, categorías, mostrarlas en la portada o en `/emergencia`,
  y edición in-place. Nada de esto bloquea la v1.

## Pruebas

- **Unit (vitest):** `fotosDe` sobre entradas mixtas (arreglo, string suelto, vacío, URL
  inválida) y `esquemaNovedad` con/sin enlace (URL válida, vacía, inválida).
- **Manual:** crear una novedad con 1 imagen, con varias, y con enlace; verificar que se
  ve en `/novedades` en es y en en, y que el botón abre el enlace. Confirmar que una
  novedad vieja (solo texto) sigue renderizando bien.

## Archivos tocados

- `supabase/migrations/0021_novedades_imagen.sql` (nuevo)
- `src/lib/validacion/esquemas.ts` (esquemaNovedad)
- `src/lib/datos/novedades.ts` (helper `fotosDe` + insert)
- `src/app/[locale]/admin/novedades/acciones.ts` (leer campos nuevos)
- `src/app/[locale]/admin/novedades/FormularioNovedad.tsx` (SubirFotos + enlace)
- `src/app/[locale]/novedades/page.tsx` (render imágenes + botón)
- `src/app/[locale]/admin/novedades/FilaNovedad.tsx` (miniatura, opcional)
- `messages/es.json`, `messages/en.json` (labels)
