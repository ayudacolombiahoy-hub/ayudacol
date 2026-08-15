# Moderación de necesidades por voluntarios (mantenimiento de acopios y servicios)

**Fecha:** 2026-08-15
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

Que los **moderadores voluntarios** no solo aprueben/rechacen propuestas, sino que
**mantengan al día las necesidades** de los centros de acopio y los servicios ya
publicados. El moderador **confirma con el propio centro** (llamada/contacto) y luego
actualiza. Cada edición deja **rastro auditable**: qué moderador, cuándo, qué cambió y
con qué nota de confirmación.

## Contexto

- **Acopios** (`centros_acopio`): las necesidades son `recibe text[]` y `no_necesita
  text[]`, más `estado estado_acopio` (`activo`/`lleno`/`cerrado`). El equipo podrá
  editarlos con la política que llega en el 0011 (planeado, aún no implementado).
- **Servicios** (`ofertas_servicios`): no tienen arreglos de "necesidades"; ofrecen algo.
  Sus campos vivos son `descripcion`, `capacidad` y `estado estado_recurso`
  (`disponible`/`asignado`/`inactivo`). Hoy el equipo **solo los lee**
  (`equipo_lee_servicios`), no los edita.
- **Auditoría existente**: tabla `historial_cambios` (`entidad`, `entidad_id`,
  `estado_anterior`, `estado_nuevo`, `autor uuid`, `nota`, `creada_en`). Un trigger
  `registrar_cambio_estado()` (SECURITY DEFINER) ya registra **solo** los cambios de
  `estado` de `solicitudes_ayuda` y `centros_acopio`. `historial_cambios` **no acepta
  escrituras directas** (no hay política de INSERT; solo el trigger la escribe).
- El patrón "propuesta pública + moderación" (mascotas, desaparecidos, albergues,
  refugios) ya existe. Esta feature agrega la capa de **mantenimiento continuo** de lo
  publicado, separada de la cola aprobar/rechazar.

## Decisiones (acordadas con el usuario)

1. **Flujo unificado** acopios + servicios: un mismo feature, dos formularios. En acopios
   se editan `recibe`/`no_necesita`/`estado`; en servicios `descripcion`/`capacidad`/
   `estado`. Mismo patrón de confirmación y auditoría para ambos.
2. **Nota de confirmación obligatoria + sello de frescura**: cada edición exige una nota
   corta (con quién/cómo se confirmó). Se guarda `confirmado_por`/`confirmado_en` en el
   registro y el público ve "Actualizado hace X días" (panel y listas públicas). La
   **identidad del moderador** queda solo en el historial del equipo; el público solo ve
   la **fecha**.
3. **Diff legible por campo** en la auditoría: una entrada por campo cambiado
   (`campo`, antes → después, autor, fecha, nota).
4. **Mecanismo: RPC `security definer`** — una función SQL por entidad que verifica rol,
   exige la nota, actualiza y escribe el diff, todo atómico. El cliente llama `sb.rpc()`.
5. **Servicios editan sus campos reales** (`descripcion`/`capacidad`/`estado`); no se les
   agregan campos de "necesidades".
6. **Alcance estricto del formulario**: solo necesidades + estado. Horarios, dirección y
   contacto quedan fuera de este feature.
7. **Secuencia**: migración `0012`. Al ser la RPC `security definer`, este feature es
   **independiente del 0011**: no depende de la política de edición de equipo del 0011 y
   **crea `/panel/acopios` si aún no existe**. Si ambos aterrizan, la página aloja las dos
   secciones (cola de propuestas del 0011 + mantenimiento de este feature).

## Arquitectura

### 1. Migración `supabase/migrations/0012_moderacion_necesidades.sql`

```sql
-- Mantenimiento de necesidades por moderadores: sello de frescura + auditoría legible.

-- (a) Sello de "última confirmación con el centro"
alter table centros_acopio   add column confirmado_por uuid references perfiles(id);
alter table centros_acopio   add column confirmado_en  timestamptz;
alter table ofertas_servicios add column confirmado_por uuid references perfiles(id);
alter table ofertas_servicios add column confirmado_en  timestamptz;

-- (b) Qué campo cambió (antes/después quedan limpios; campo NULL = 'estado' por convención)
alter table historial_cambios add column campo text;

-- (c) El equipo puede editar servicios (acopios ya lo cubre el 0011; la RPC es la vía real)
create policy equipo_edita_servicios on ofertas_servicios
  for update to authenticated using (es_moderador_o_admin());

-- (d) Helper: inserta una fila de diff solo si el valor cambió; devuelve si insertó.
create or replace function public.registrar_diff(
  p_entidad text, p_id uuid, p_campo text,
  p_antes text, p_despues text, p_nota text
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_antes is distinct from p_despues then
    insert into historial_cambios (entidad, entidad_id, campo, estado_anterior, estado_nuevo, autor, nota)
    values (p_entidad, p_id, p_campo, p_antes, p_despues, auth.uid(), p_nota);
    return true;
  end if;
  return false;
end; $$;

-- (e) RPC acopios
create or replace function public.moderar_necesidades_acopio(
  p_id uuid, p_recibe text[], p_no_necesita text[], p_estado estado_acopio, p_nota text
) returns void language plpgsql security definer set search_path = public as $$
declare v_old centros_acopio; v_cambio boolean := false;
begin
  if not es_moderador_o_admin() then raise exception 'no_autorizado'; end if;
  if p_nota is null or btrim(p_nota) = '' then raise exception 'nota_requerida'; end if;
  select * into v_old from centros_acopio where id = p_id;
  if not found then raise exception 'no_encontrado'; end if;

  update centros_acopio
     set recibe = p_recibe, no_necesita = p_no_necesita, estado = p_estado,
         confirmado_por = auth.uid(), confirmado_en = now()
   where id = p_id;

  v_cambio := registrar_diff('centros_acopio', p_id, 'recibe',
                array_to_string(v_old.recibe, ', '), array_to_string(p_recibe, ', '), p_nota) or v_cambio;
  v_cambio := registrar_diff('centros_acopio', p_id, 'no_necesita',
                array_to_string(v_old.no_necesita, ', '), array_to_string(p_no_necesita, ', '), p_nota) or v_cambio;
  -- 'estado' lo audita el trigger existente (trg_acopios_historial); solo contamos si cambió.
  if v_old.estado is distinct from p_estado then v_cambio := true; end if;

  if not v_cambio then
    insert into historial_cambios (entidad, entidad_id, campo, estado_anterior, estado_nuevo, autor, nota)
    values ('centros_acopio', p_id, 'confirmacion', null, 'confirmado sin cambios', auth.uid(), p_nota);
  end if;
end; $$;

-- (f) RPC servicios (registra los tres campos: servicios no tienen trigger de estado)
create or replace function public.moderar_necesidades_servicio(
  p_id uuid, p_descripcion text, p_capacidad text, p_estado estado_recurso, p_nota text
) returns void language plpgsql security definer set search_path = public as $$
declare v_old ofertas_servicios; v_cambio boolean := false;
begin
  if not es_moderador_o_admin() then raise exception 'no_autorizado'; end if;
  if p_nota is null or btrim(p_nota) = '' then raise exception 'nota_requerida'; end if;
  select * into v_old from ofertas_servicios where id = p_id;
  if not found then raise exception 'no_encontrado'; end if;

  update ofertas_servicios
     set descripcion = p_descripcion, capacidad = p_capacidad, estado = p_estado,
         confirmado_por = auth.uid(), confirmado_en = now()
   where id = p_id;

  v_cambio := registrar_diff('ofertas_servicios', p_id, 'descripcion',
                v_old.descripcion, p_descripcion, p_nota) or v_cambio;
  v_cambio := registrar_diff('ofertas_servicios', p_id, 'capacidad',
                coalesce(v_old.capacidad, ''), coalesce(p_capacidad, ''), p_nota) or v_cambio;
  v_cambio := registrar_diff('ofertas_servicios', p_id, 'estado',
                v_old.estado::text, p_estado::text, p_nota) or v_cambio;

  if not v_cambio then
    insert into historial_cambios (entidad, entidad_id, campo, estado_anterior, estado_nuevo, autor, nota)
    values ('ofertas_servicios', p_id, 'confirmacion', null, 'confirmado sin cambios', auth.uid(), p_nota);
  end if;
end; $$;

grant execute on function public.moderar_necesidades_acopio  to authenticated;
grant execute on function public.moderar_necesidades_servicio to authenticated;

-- (g) Frescura al público en la vista de servicios (acopios se leen directo de la tabla)
create or replace view ofertas_servicios_publicas as
  select id, tipo, descripcion, capacidad, municipio_id, estado, creada_en, confirmado_en
  from ofertas_servicios
  where estado <> 'inactivo';
```

Notas:
- La RPC es `security definer`, así que **no depende** de `equipo_edita_acopios` (0011);
  verifica el rol por dentro. Es la **única vía** sancionada para el mantenimiento.
- `auth.uid()` sigue resolviendo al moderador dentro de la función/trigger (lee el claim
  del JWT de la petición, no cambia por `security definer`).
- **Sin doble registro de `estado` en acopios**: el trigger existente ya lo audita, por
  eso la RPC de acopios no lo re-registra (solo cuenta si cambió para el rastro de
  confirmación). En servicios no hay trigger, así que su RPC sí registra `estado`.
  Consecuencia menor y asumida: el cambio de `estado` de un acopio hecho por la RPC queda
  en el historial con `autor` y sin `nota` (lo pone el trigger); los cambios de
  `recibe`/`no_necesita` sí llevan la nota.
- **Re-confirmación sin cambios**: igual se sella `confirmado_por/en` y se registra una
  entrada `campo='confirmacion'` con la nota → siempre queda rastro de que se re-confirmó.
- `create or replace view` solo permite **añadir** columnas al final: `confirmado_en` va
  después de `creada_en`.
- Registrar `0012` en `scripts/aplicar-migraciones.mjs` y aplicar con
  `node scripts/aplicar-migraciones.mjs 0012`.

### 2. Validación — `src/lib/validacion/esquemas.ts`

```ts
export const esquemaMantenimientoAcopio = z.object({
  recibe: listaTexto,
  no_necesita: listaTexto,
  estado: z.enum(['activo', 'lleno', 'cerrado']),
  nota: z.string().trim().min(5).max(300),
})
export type DatosMantenimientoAcopio = z.infer<typeof esquemaMantenimientoAcopio>

export const esquemaMantenimientoServicio = z.object({
  descripcion: z.string().trim().min(10).max(2000), // respeta el check de la tabla
  capacidad: opcionalTexto(160),
  estado: z.enum(['disponible', 'asignado', 'inactivo']),
  nota: z.string().trim().min(5).max(300),
})
export type DatosMantenimientoServicio = z.infer<typeof esquemaMantenimientoServicio>
```

### 3. Capa de datos — `src/lib/datos/moderacion-recursos.ts` (nuevo)

Cliente servidor; RLS/RPC controlan el acceso (solo equipo).

- `listarAcopiosParaMantenimiento()` → `select id, nombre, municipio_id, recibe,
  no_necesita, estado, confirmado_en from centros_acopio order by confirmado_en asc nulls
  first` (lo nunca-confirmado o más viejo, primero).
- `listarServiciosParaMantenimiento()` → equivalente sobre `ofertas_servicios`
  (`descripcion, capacidad, estado, confirmado_en`).
- `actualizarNecesidadesAcopio(id, entrada)` → valida `esquemaMantenimientoAcopio`;
  `sb.rpc('moderar_necesidades_acopio', { p_id: id, p_recibe, p_no_necesita, p_estado,
  p_nota })`. Mapea errores de la RPC (`no_autorizado`, `nota_requerida`, `no_encontrado`)
  a `{ ok: false, motivo }`.
- `actualizarNecesidadesServicio(id, entrada)` → análogo con
  `moderar_necesidades_servicio`.
- `listarHistorialRecurso(entidad, id)` → `select campo, estado_anterior, estado_nuevo,
  autor, nota, creada_en from historial_cambios where entidad = $1 and entidad_id = $2
  order by creada_en desc` (RLS `equipo_lee_historial`).

### 4. Páginas / UI del panel

Sigue el patrón existente de `/panel/albergues` (`FormularioAlbergue.tsx` +
`FilaAlbergue.tsx` + `acciones.ts`).

- **`src/app/[locale]/panel/acopios/`** — sección **"Mantenimiento de publicados"**:
  - `MantenimientoAcopios.tsx` (lista) + `FilaMantenimientoAcopio.tsx`: por fila, nombre,
    municipio, `recibe`/`no_necesita` actuales, **"Confirmado hace X"** (o "sin
    confirmar"), botón **Editar necesidades** y **Ver historial**.
  - `FormularioNecesidadesAcopio.tsx`: `recibe`, `no_necesita`, `estado`, **`nota`
    (requerida)**. Envía a la acción → RPC.
  - `HistorialRecurso.tsx` (compartido): render legible del diff (`campo: antes →
    después`, autor, fecha, nota).
  - Si el 0011 ya creó `page.tsx` con la cola, se añade esta sección; si no, este feature
    crea `page.tsx` con solo la sección de mantenimiento.
- **`src/app/[locale]/panel/servicios/`** (nuevo): `page.tsx`, `FilaMantenimientoServicio.tsx`,
  `FormularioNecesidadesServicio.tsx` (`descripcion`, `capacidad`, `estado`, `nota`),
  reusa `HistorialRecurso.tsx`, `acciones.ts`.
- `acciones.ts` (server actions): llaman a la capa de datos; revalidan la ruta del panel.

### 5. Frescura en el público

- **Acopios**: la lista/tarjetas públicas de `/acopios` añaden `confirmado_en` al select y
  muestran "Actualizado hace X días" (o nada si es null). No cambia la RLS.
- **Servicios**: la vista `ofertas_servicios_publicas` ya expone `confirmado_en` (migración
  1.g); la tarjeta pública lo muestra igual.
- Un helper de formato **`hace(fecha)` → "hace 3 días" / "hoy" / "sin confirmar"** (TS puro,
  testeable) centraliza el texto (i18n es/en).

### 6. i18n y navegación

- Bloque `mantenimiento` en `src/messages/es.json` / `en.json`: `tituloAcopios`,
  `tituloServicios`, `editarNecesidades`, `notaConfirmacion`, `notaPlaceholder`,
  `confirmadoHace`, `sinConfirmar`, `verHistorial`, `guardar`, `guardado`, `sinCambios`,
  y mensajes de validación/errores de RPC.
- Enlace del equipo "Gestionar servicios" → `/panel/servicios` desde donde corresponda
  (junto al de acopios/mascotas del panel). No se agregan enlaces de nav públicos.

## Flujo resultante

1. Moderador entra a `/panel/acopios` (o `/panel/servicios`) → ve la lista ordenada por
   frescura (lo más viejo primero).
2. Llama/contacta al centro y **confirma** las necesidades.
3. Abre **Editar necesidades**, ajusta campos y escribe la **nota** ("confirmé con Ana
   por tel, 15/08"). Guarda.
4. La RPC valida rol + nota, actualiza, sella `confirmado_por/en` y escribe el **diff** en
   `historial_cambios`.
5. El público ve "Actualizado hace X días". El equipo ve el **historial legible** por
   centro (quién, cuándo, qué, nota).

## Manejo de errores / bordes

- No-moderador que invoca la RPC → excepción `no_autorizado` → `{ ok: false }`.
- Nota vacía → rechazada por zod (cliente) **y** por la RPC (servidor).
- Sin cambios reales pero con nota → se sella la frescura y se registra `confirmacion`.
- `id` inexistente → `no_encontrado`.
- Concurrencia → last-write-wins (aceptado).
- `descripcion` de servicio < 10 chars → rechazada por zod y por el check de la tabla.
- Privacidad: `confirmado_por` (moderador) **no** se expone al público; solo la fecha.

## Pruebas

Unit (vitest, `tests/unit/moderacion-recursos.test.ts`):
- `esquemaMantenimientoAcopio` acepta datos válidos; rechaza `nota` < 5; parsea listas.
- `esquemaMantenimientoServicio` acepta válidos; rechaza `descripcion` < 10 y `nota` vacía.
- Helper `hace(fecha)` → "hoy" / "hace N días" / "sin confirmar" (con fecha fija inyectada).

Verificación manual (tras aplicar 0012):
- Como moderador: editar un acopio → `confirmado_en` se sella y aparecen filas de diff con
  nota; editar un servicio → ídem; re-confirmar sin cambios → entrada `confirmacion`.
- Como usuario sin rol (o anon): `sb.rpc(...)` → `no_autorizado`.
- Nota vacía → `nota_requerida`.
- Público: la tarjeta muestra "Actualizado hace X"; **no** muestra el moderador.

## Archivos afectados

**Nuevos**
- `supabase/migrations/0012_moderacion_necesidades.sql`
- `src/lib/datos/moderacion-recursos.ts`
- `src/app/[locale]/panel/acopios/MantenimientoAcopios.tsx`
- `src/app/[locale]/panel/acopios/FilaMantenimientoAcopio.tsx`
- `src/app/[locale]/panel/acopios/FormularioNecesidadesAcopio.tsx`
- `src/app/[locale]/panel/servicios/page.tsx`
- `src/app/[locale]/panel/servicios/FilaMantenimientoServicio.tsx`
- `src/app/[locale]/panel/servicios/FormularioNecesidadesServicio.tsx`
- `src/app/[locale]/panel/servicios/acciones.ts`
- `src/app/[locale]/panel/_componentes/HistorialRecurso.tsx` (compartido)
- `tests/unit/moderacion-recursos.test.ts`

**Modificados**
- `src/lib/validacion/esquemas.ts` (esquemas de mantenimiento)
- `src/app/[locale]/panel/acopios/page.tsx` + `acciones.ts` (crear si no existe; añadir sección)
- Lista pública de `/acopios` (mostrar frescura)
- `src/messages/es.json`, `src/messages/en.json` (bloque `mantenimiento`)
- `scripts/aplicar-migraciones.mjs` (registrar 0012)
- Helper de formato de tiempo relativo (nuevo o en util existente)

## Fuera de alcance

- Editar horarios, dirección o contacto (solo necesidades + estado).
- Que el propio centro edite sus necesidades (lo hace el moderador tras confirmar).
- Notificar al público cuando cambian las necesidades.
- Agregar campos de "necesidades" a los servicios (editan sus campos reales).
- Flujo de aprobar/rechazar propuestas (eso es del 0011).
