# Casos aliados: enlazar necesidades de MiManizales.info

**Fecha:** 2026-08-15
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

Una sección pública **"Casos aliados"** en ayudacol que muestra los casos de
`mimanizales.info` (portal aliado sin ánimo de lucro) **enlazando a su ficha**,
sin copiar contacto ni datos de pago. La necesidad se ve en ayudacol; el contacto
ocurre en `mimanizales.info`, en los términos de ese sitio (que lo mantiene
detrás de un botón "Ver datos de contacto"). Se respeta su diseño de privacidad y
su política de datos.

## Contexto

- **Fuente**: `mimanizales.info` es WordPress; su portada renderiza tarjetas de
  "casos" alimentadas por un **API n8n** (GET, JSON):
  `https://n8n.srv1571385.hstgr.cloud/webhook/mimanizales/necesidades`
  Responde `{ ok, total, items[] }` con **32** casos. Campos por item:
  `case_id, estado, prioridad, titulo, resumen_corto, municipio, sector,
  grupos_objetivo, tipos_necesidad, descripcion_publica, necesidades_detalle,
  como_ayudar, contacto_publico, telefono_publico, breb_llave, breb_entidad,
  fecha_verificacion, fecha_actualizacion, destacado, orden, finalizado,
  imagen_1_url … imagen_10_url`.
- **Privacidad (define el diseño)**: `contacto_publico`, `telefono_publico`,
  `breb_llave` (llave Bre-B de pago) y `breb_entidad` vienen en el API, pero el
  sitio los muestra **solo tras "Ver datos de contacto"**. → El sync los
  **descarta**: no se guardan ni se muestran en ayudacol. No hacen falta: la
  tarjeta enlaza a la ficha de origen donde el usuario los consulta.
- **Cobertura**: los casos son multi-departamento (Caldas + aledaños; p. ej.
  *Santa Rosa de Cabal*, Risaralda). Se muestran todos los activos con su
  `municipio`; no se filtra por departamento (solo enlazamos).
- **Códigos**: `grupos_objetivo` y `tipos_necesidad` son códigos separados por `|`
  (p. ej. `ADULTOS|NINOS_ADOLESCENTES`, `CONSTRUCCION_REPARACIONES`). `prioridad`
  es `ALTA|MEDIA|BAJA`.
- **App**: secciones públicas = `src/app/[locale]/<seccion>/page.tsx` (server
  component + `getTranslations` + capa de datos en `src/lib/datos` que lee vistas
  públicas con `crearClienteAnonimo`). Nav en `src/componentes/Navegacion.tsx` +
  claves `nav.*`. Migraciones `supabase/migrations/00NN_*.sql`, registradas en
  `scripts/aplicar-migraciones.mjs`, aplicadas con `node
  scripts/aplicar-migraciones.mjs [sufijo]`. Vistas públicas: base con RLS + view
  + `grant select ... to anon, authenticated` (patrón `solicitudes_publicas`).

## Decisiones (acordadas con el usuario)

1. **Enlazar sin republicar**: se guardan solo campos públicos no-contacto. La
   miniatura es **hotlink** a la imagen de mimanizales (no se rehospeda).
2. **Tabla + script de sync**: los casos viven en `casos_aliados`; un script
   refresca desde el API (manual o cron). Actualiza sin redeploy. Una sola llamada
   al API por corrida (no golpea su servidor).
3. **Mostrar todos los activos** (`estado='ACTIVO'` y no `finalizado`), con su
   municipio; sin filtro por departamento.
4. **Atribución clara** + botón **"Ver caso en MiManizales"** que abre la ficha en
   nueva pestaña (`target="_blank" rel="noopener noreferrer"`).
5. **Descarte de contacto/pago**: `contacto_publico`, `telefono_publico`,
   `breb_llave`, `breb_entidad` **nunca** se guardan ni se muestran.

## Arquitectura

### 1. Migración `supabase/migrations/0012_casos_aliados.sql`

`0012` es el siguiente número libre en disco. (El diseño de moderación-necesidades
—sin implementar— también mencionaba `0012`; si se implementa después, toma el
siguiente número. Ambas features son independientes.)

```sql
-- Casos de portales aliados (MiManizales.info). Solo campos públicos, sin contacto.
create table casos_aliados (
  case_id text primary key,
  titulo text not null,
  resumen_corto text,
  municipio text,
  sector text,
  prioridad text,                 -- ALTA | MEDIA | BAJA (texto de la fuente)
  grupos_objetivo text,           -- códigos separados por '|'
  tipos_necesidad text,           -- códigos separados por '|'
  necesidades_detalle text,
  imagen_url text,                -- primera imagen no vacía (hotlink)
  url_origen text not null,       -- https://mimanizales.info/caso/?id=<case_id>
  estado text not null default 'ACTIVO',
  finalizado boolean not null default false,
  fecha_verificacion timestamptz,
  orden int not null default 100,
  sincronizado_en timestamptz not null default now()
);

alter table casos_aliados enable row level security;
-- Sin políticas de escritura para anon/authenticated: solo el script (conexión
-- de servicio vía SUPABASE_DB_URL) escribe, saltándose RLS.

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

Registrar `0012` en `scripts/aplicar-migraciones.mjs`; aplicar con
`node scripts/aplicar-migraciones.mjs 0012`.

### 2. Mapeo puro — `scripts/casos-aliados/mapeo.mjs`

Funciones puras (sin I/O), testeables:

- `primeraImagen(item)` → `string`. Primera `imagen_N_url` no vacía (`''` si
  ninguna).
- `mapearCaso(item)` → row para upsert. **Solo campos públicos**: toma
  `case_id, titulo, resumen_corto, municipio, sector, prioridad,
  grupos_objetivo, tipos_necesidad, necesidades_detalle, estado, finalizado,
  fecha_verificacion, orden`; calcula `imagen_url = primeraImagen(item)` y
  `url_origen = 'https://mimanizales.info/caso/?id=' + case_id`. **Nunca** copia
  `contacto_publico`, `telefono_publico`, `breb_llave`, `breb_entidad`,
  `descripcion_publica`, `como_ayudar` (no se usan).

### 3. Sync — `scripts/casos-aliados/sincronizar.mjs`

`node scripts/casos-aliados/sincronizar.mjs [--dry-run]`

Patrón de `aplicar-migraciones.mjs`: `dotenv` (`.env.local`) + `pg`
(`SUPABASE_DB_URL`). Node 18+ trae `fetch` global.

1. `fetch` al API → `items`. Si falla o `items` vacío → aborta con mensaje, sin
   tocar la base.
2. `mapearCaso` cada item (descarta contacto/breb).
3. `--dry-run` → imprime cuántos casos y termina, sin escribir.
4. `upsert` por `case_id`: `insert ... on conflict (case_id) do update set ...`
   (todas las columnas + `sincronizado_en = now()`).
5. **Marca ausentes**: `update casos_aliados set estado='AUSENTE',
   sincronizado_en=now() where case_id <> all($ids)` → los que ya no vienen del
   API salen de la vista pública (que filtra `estado='ACTIVO'`).
6. Imprime: sincronizados, marcados ausentes, total.

### 4. Capa de datos — `src/lib/datos/casos-aliados.ts`

```ts
import { crearClienteAnonimo } from '@/lib/supabase/cliente'

export async function listarCasosAliados() {
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('casos_aliados_publicos').select('*')
  if (error) throw new Error(error.message)
  return data ?? []
}
```

El orden lo fija la vista (prioridad → orden → fecha).

### 5. Página `src/app/[locale]/casos-aliados/page.tsx`

Server component (patrón `novedades`): `export const dynamic = 'force-dynamic'`,
`setRequestLocale`, `getTranslations('casosAliados')`, `listarCasosAliados()`.

- **Encabezado**: título + intro + **atribución**: "Casos de nuestro aliado
  [MiManizales.info](https://mimanizales.info)" (enlace externo).
- **Tarjetas** (grid, estilo de las secciones existentes): por caso —
  - **miniatura** `<img src={imagen_url} loading="lazy" onerror="…oculta…">`
    (hotlink; `<img>` plano para no configurar `remotePatterns`); si no hay
    `imagen_url`, no se renderiza `<img>`.
  - `titulo`; `📍 municipio · sector`; **badge de prioridad** (color por
    ALTA/MEDIA/BAJA); chips de `grupos_objetivo`/`tipos_necesidad` mapeados a
    texto legible vía i18n; `necesidades_detalle`; `resumen_corto`.
  - botón **"Ver caso en MiManizales"** → `<a href={url_origen} target="_blank"
    rel="noopener noreferrer">`.
- **Estado vacío** si no hay casos.
- Los códigos `grupos_objetivo`/`tipos_necesidad` se parten con
  `str.split('|').filter(Boolean)` (inline) y cada código se traduce con `t()`;
  código desconocido → se muestra el código crudo (fallback).

**Nota i18n**: el contenido del caso (`titulo`, `resumen_corto`,
`necesidades_detalle`) viene en español de la fuente y se muestra tal cual en
ambos idiomas. Solo el "chrome" (encabezados, etiquetas de códigos, botones) es
bilingüe.

### 6. Nav e i18n

- `src/componentes/Navegacion.tsx`: enlace a `/casos-aliados` con
  `nav.casosAliados`, junto a los demás.
- `src/messages/es.json` / `en.json`: `nav.casosAliados` + bloque `casosAliados`:
  `titulo`, `intro`, `atribucion`, `verCaso`, `sinCasos`, `prioridad.{ALTA,MEDIA,
  BAJA}`, `grupos.{BEBES,NINOS_ADOLESCENTES,ADULTOS,ADULTOS_MAYORES,DISCAPACIDAD,
  MASCOTAS,FUNDACIONES}`, `tipos.{…}` (los códigos observados; desconocidos caen
  al crudo).

## Flujo resultante

1. `node scripts/casos-aliados/sincronizar.mjs` (manual o cron) trae los 32 casos
   del API, descarta contacto/breb, y hace upsert en `casos_aliados`.
2. `/casos-aliados` lista los activos desde `casos_aliados_publicos` con miniatura
   enlazada, prioridad y necesidad.
3. El usuario hace clic en **"Ver caso en MiManizales"** → va a la ficha de origen,
   donde consulta el contacto en los términos de mimanizales.

## Manejo de errores / bordes

- **API caído / respuesta no-JSON / `items` vacío** → el sync aborta sin escribir
  (no borra lo que ya hay).
- **Caso sin imágenes** → `imagen_url=''`; la tarjeta omite el `<img>`.
- **Imagen que 404** → `onerror` la oculta (sin romper la tarjeta).
- **Código de grupo/tipo desconocido** → se muestra el código crudo.
- **Caso retirado del API** → queda `estado='AUSENTE'` y desaparece de la vista.
- **Privacidad**: `contacto_publico`/`telefono_publico`/`breb_*` nunca llegan a la
  tabla ni a la página (garantía verificable por `grep`).
- **Re-sync** → idempotente por `upsert` en `case_id`.

## Pruebas

Unit (vitest, `tests/unit/casos-aliados.test.ts`), sobre `mapeo.mjs`:
- `primeraImagen`: devuelve la primera no vacía; `''` si todas vacías.
- `mapearCaso`: arma `url_origen` correcto, toma `imagen_url`, mapea campos
  públicos, y **NO** incluye `contacto_publico`/`telefono_publico`/`breb_llave`/
  `breb_entidad` (aserción explícita de ausencia de esas claves).

Verificación manual (tras aplicar 0012 y correr el sync):
- `--dry-run` no escribe; corrida real hace upsert; segunda corrida no duplica.
- `/casos-aliados` renderiza tarjetas con miniatura, prioridad, enlace externo que
  abre la ficha correcta.
- `select * from casos_aliados` no tiene ninguna columna de contacto/breb.
- Un caso `finalizado`/`AUSENTE` no aparece en la vista.

## Archivos afectados

**Nuevos**
- `supabase/migrations/0012_casos_aliados.sql`
- `scripts/casos-aliados/mapeo.mjs`
- `scripts/casos-aliados/sincronizar.mjs`
- `src/lib/datos/casos-aliados.ts`
- `src/app/[locale]/casos-aliados/page.tsx`
- `tests/unit/casos-aliados.test.ts`

**Modificados**
- `scripts/aplicar-migraciones.mjs` (registrar 0012)
- `src/componentes/Navegacion.tsx` (enlace)
- `src/messages/es.json`, `src/messages/en.json` (nav + bloque `casosAliados`)

## Fuera de alcance

- Guardar o mostrar contacto (`contacto_publico`/`telefono_publico`) o pago
  (`breb_*`).
- Rehospedar imágenes (solo hotlink).
- Sync en vivo por request (siempre vía tabla + script).
- Filtrar por departamento (se muestran todos los activos).
- Traducir el contenido del caso (viene en español; solo el chrome es bilingüe).
- Formulario de "reportar caso" (eso vive en mimanizales / su Tally).
