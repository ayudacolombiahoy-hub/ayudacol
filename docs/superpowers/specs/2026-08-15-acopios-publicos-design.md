# Solicitud pública de centros de acopio + moderación (Opción A)

**Fecha:** 2026-08-15
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

Que cualquier persona u organización pueda **proponer un centro de acopio sin
iniciar sesión**. La propuesta queda **pendiente de verificación**; el equipo la
revisa y la publica (o la descarta). Así se cierra el vacío actual: hoy solo las
organizaciones provisionadas por el admin pueden registrar acopios.

## Contexto

- Tabla `centros_acopio`: `organizacion_id` **NOT NULL** (obligatorio), `estado`
  (activo/lleno/cerrado), nombre, direccion, municipio_id, horarios,
  contacto_publico, recibe[], no_necesita[], lat/lng.
- RLS actual:
  - `lectura_publica_acopios`: anon+auth `select using (true)` → muestra **todos**.
  - `org_inserta_acopio`: authenticated insert `with check (organizacion_id = mi_organizacion())` → solo orgs.
  - `org_edita_acopio`: authenticated update de sus propios acopios.
- La página `/org/acopios` exige `rol='org'` (por eso un admin ve "no tiene permiso").
- El patrón de "propuesta pública + moderación" ya existe y funciona en mascotas,
  desaparecidos y albergues. Esta feature lo aplica a acopios **reutilizando la tabla**.

## Decisiones (acordadas con el usuario)

- **Reutilizar `centros_acopio`** (no una tabla aparte). La propuesta *se convierte*
  en acopio al aprobarse (solo cambia una bandera).
- El botón "Registrar centro de acopio" de `/acopios` apunta al **formulario público**
  `/acopios/proponer`. Las organizaciones siguen usando su panel `/org/acopios` aparte.
- **Verificación con booleano, no con el enum.** En vez de agregar `pendiente` a
  `estado_acopio` (que en Postgres no se puede usar en la misma transacción que se
  crea), se añade `verificado boolean`. Esto además separa dos conceptos:
  - `estado` = operativo (activo/lleno/cerrado).
  - `verificado` = moderación (lo aprobó el equipo, sí/no).

## Arquitectura

### 1. Migración `supabase/migrations/0011_acopios_publicos.sql`

```sql
-- Propuesta pública de centros de acopio + moderación.
-- organizacion_id pasa a opcional (propuestas sin org); nueva bandera 'verificado'.

alter table centros_acopio alter column organizacion_id drop not null;
alter table centros_acopio add column verificado boolean not null default true;
-- Los acopios existentes (creados por orgs) quedan verificado=true → siguen públicos.

-- Inserción pública: anon inserta propuestas SIN org y SIN verificar.
create policy propuesta_publica_acopio on centros_acopio
  for insert to anon
  with check (organizacion_id is null and verificado = false);

-- Lectura pública: solo verificados (las propuestas pendientes no salen al público).
drop policy if exists lectura_publica_acopios on centros_acopio;
create policy lectura_publica_acopios on centros_acopio
  for select to anon, authenticated using (verificado = true);

-- El equipo (admin/moderador) ve y modera cualquier acopio.
create policy equipo_lee_acopios on centros_acopio
  for select to authenticated using (es_moderador_o_admin());
create policy equipo_edita_acopios on centros_acopio
  for update to authenticated using (es_moderador_o_admin());
create policy equipo_borra_acopios on centros_acopio
  for delete to authenticated using (es_moderador_o_admin());
```

Notas:
- La **org** sigue insertando con `org_inserta_acopio` (su `organizacion_id`), y
  `verificado` toma el default `true` → sus acopios salen publicados directo (son de
  confianza). Sin cambios para orgs.
- El **anon** solo puede insertar con `organizacion_id IS NULL AND verificado = false`
  (la propia política lo obliga; nunca se auto-publica).
- La migración se aplica con `node scripts/aplicar-migraciones.mjs 0011` (ya se
  registra en el runner como parte del plan).

### 2. Validación — `src/lib/validacion/esquemas.ts`

Reutiliza los campos de `esquemaAcopio`, pero para la propuesta pública el **contacto
es obligatorio** (el equipo necesita poder verificar y el público poder llamar):

```ts
export const esquemaAcopioPublico = z.object({
  nombre: z.string().trim().min(2).max(160),
  direccion: z.string().trim().min(3).max(300),
  municipio_id: z.string().trim().min(1),
  horarios: opcionalTexto(200),
  contacto_publico: z.string().trim().min(5).max(160), // requerido en propuestas públicas
  recibe: listaTexto,
  no_necesita: listaTexto,
})
export type DatosAcopioPublico = z.infer<typeof esquemaAcopioPublico>
```

### 3. Data layer — `src/lib/datos/acopios-publico.ts`

Espejo del patrón de mascotas:
- `proponerAcopio(entrada)` → valida `esquemaAcopioPublico`; inserta con
  `organizacion_id: null`, `verificado: false`, `estado: 'activo'`. Cliente anónimo.
- `listarColaAcopios()` → equipo; `select * from centros_acopio where verificado = false`
  (cliente servidor; RLS: solo equipo lee no verificados).
- `moderarAcopio(id, accion)` → equipo:
  - `aprobar` → `update set verificado = true`.
  - `rechazar` → `delete` de la fila.

### 4. Páginas

- `src/app/[locale]/acopios/proponer/{page.tsx,formulario.tsx,acciones.ts}` — formulario
  público (mirror de `/reportar/mascota`). Campos: nombre, dirección, municipio,
  horarios, contacto público, recibe, no_necesita. Con `Honeypot`. Sin login.
- `src/app/[locale]/panel/acopios/{page.tsx,FilaAcopio.tsx,acciones.ts}` — moderación
  (mirror de `/panel/mascotas`). El equipo ve la cola de `verificado=false`, con
  botones **Aprobar** (verificado=true) y **Rechazar** (borrar).

### 5. Cambios en la lista pública `/acopios`

- El enlace "📦 Registrar centro de acopio" pasa a apuntar a **`/acopios/proponer`**
  (hoy va a `/org/acopios`).
- Añadir, para el equipo, un enlace "Gestionar" → `/panel/acopios` (como en mascotas).
- La lista en sí no cambia su query: la RLS nueva ya oculta los no verificados.

### 6. i18n y navegación

- Nuevo bloque `acopiosPublico` en `es.json`/`en.json`: `proponerTitulo`, `intro`,
  `gracias`, `gestionar`, `sinCola`, `aprobar`, `rechazar`, labels de campos que no
  estén ya en `campos`/`org`.
- No se agrega enlace de nav nuevo para `/acopios/proponer` (se llega desde `/acopios`).
  El panel `/panel/acopios` se alcanza desde el enlace "Gestionar" en `/acopios`.

## Flujo resultante

1. **Persona/org sin cuenta** → `/acopios/proponer` → inserta `verificado=false` →
   no aparece en público → equipo lo revisa.
2. **Equipo** → `/panel/acopios` → Aprobar (`verificado=true`, ya sale público) o
   Rechazar (borra).
3. **Org con cuenta** → `/org/acopios` (sin cambios): crea acopios `verificado=true`
   directo.

## Manejo de errores / bordes

- Propuesta inválida (zod) → errores por campo (mirror mascotas).
- `contacto_publico` vacío → rechazado por el esquema (es requerido en propuestas).
- Anon intentando insertar `verificado=true` o con `organizacion_id` → lo bloquea la
  política `propuesta_publica_acopio`.
- Acopios existentes (pre-migración) → `verificado=true` por el default → siguen públicos.
- Rechazar = borrar: solo el equipo (política `equipo_borra_acopios`).

## Pruebas

Unit (vitest, `tests/unit/acopios-publico.test.ts`):
- `esquemaAcopioPublico` acepta una propuesta válida.
- Rechaza sin `contacto_publico`.
- Rechaza `direccion`/`nombre`/`municipio_id` faltantes.
- `recibe`/`no_necesita` como coma-separado → array.

Verificación manual (tras aplicar 0011): proponer un acopio sin login → no aparece en
`/acopios` → entrar como equipo a `/panel/acopios` → aprobar → aparece en `/acopios`.
Proponer otro → rechazar → desaparece de la cola.

## Archivos afectados

**Nuevos**
- `supabase/migrations/0011_acopios_publicos.sql`
- `src/lib/datos/acopios-publico.ts`
- `src/app/[locale]/acopios/proponer/page.tsx`
- `src/app/[locale]/acopios/proponer/formulario.tsx`
- `src/app/[locale]/acopios/proponer/acciones.ts`
- `src/app/[locale]/panel/acopios/page.tsx`
- `src/app/[locale]/panel/acopios/FilaAcopio.tsx`
- `src/app/[locale]/panel/acopios/acciones.ts`
- `tests/unit/acopios-publico.test.ts`

**Modificados**
- `src/lib/validacion/esquemas.ts` (esquemaAcopioPublico)
- `src/app/[locale]/acopios/page.tsx` (enlace público → /acopios/proponer + enlace equipo → /panel/acopios)
- `src/messages/es.json`, `src/messages/en.json` (bloque `acopiosPublico`)
- `scripts/aplicar-migraciones.mjs` (registrar 0011)

## Fuera de alcance

- Que el proponente edite su acopio después (lo gestiona el equipo o una org).
- Convertir una propuesta aprobada en cuenta de organización.
- Acopios en estadísticas/mapa más allá de lo que ya existe.
