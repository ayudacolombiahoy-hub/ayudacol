# Sección de mascotas perdidas y encontradas

**Fecha:** 2026-08-15
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

Que cualquier persona pueda reportar una mascota **perdida** (busco a mi mascota)
o **encontrada** (hallé una y busco a su dueño) durante la emergencia, verla en un
listado público con filtros, y contactar directamente al reportante para reunir a
la mascota con su familia.

## Contexto

El proyecto ya tiene un vertical muy parecido: **personas desaparecidas**
(`/desaparecidos`), con:
- Tabla `personas_desaparecidas` + RLS (inserción pública solo con `estado='buscando'`,
  lectura/edición del equipo vía `es_moderador_o_admin()`).
- Vista pública `personas_desaparecidas_publicas` que **oculta el contacto** y excluye
  `cerrado`.
- Data layer `lib/datos/desaparecidos.ts` (`listar`, `reportar`, `listarCola`, `cambiarEstado`).
- Páginas `/desaparecidos`, `/reportar/desaparecido`, `/panel/desaparecidos`.
- Formulario con `SubirFoto` + `Honeypot`; tarjeta `TarjetaDesaparecido`; i18n `desaparecidos`.

La sección de mascotas es un **espejo fiel** de ese vertical, con tres diferencias
deliberadas (decididas con el usuario):
1. **Dos direcciones:** campo `tipo_reporte` = `perdida` | `encontrada`, con filtro.
2. **Contacto visible:** la vista pública **incluye** teléfono y nombre del reportante
   (para llamar/WhatsApp directo). Es un dato que el reportante ofrece a propósito.
3. **Campos propios de mascota:** `especie`, `nombre` opcional (las encontradas rara vez
   lo tienen).

## Decisiones de diseño

- **Estados:** `activo → reunida → cerrado`. Se usa `reunida` (no `encontrada`) para no
  chocar con `tipo_reporte='encontrada'`. `activo` = reporte vigente; `reunida` = final
  feliz; `cerrado` = archivado/oculto.
- **Moderación:** los reportes aparecen de inmediato (como personas: la vista muestra
  `estado <> 'cerrado'`). El equipo modera **post-publicación** desde el panel
  (marcar `reunida` o `cerrado`). No hay aprobación previa.
- **Filtros:** `tipo_reporte`, `especie` y `municipio` (todos por query-params, mismo
  patrón que el resto de listados).
- **Foto:** opcional, reutiliza el componente `SubirFoto` y la columna `foto_url`
  (mismo mecanismo/almacenamiento que desaparecidos). Sin infraestructura nueva.
- **No entra** (por ahora, igual que desaparecidos): mapa operativo ni estadísticas.

## Arquitectura

### 1. Migración `supabase/migrations/0008_mascotas.sql`

```sql
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

-- Vista pública: INCLUYE contacto (decisión: contacto visible), excluye cerrado.
create view mascotas_publicas as
  select id, tipo_reporte, especie, nombre, descripcion, municipio_id, ultima_ubicacion,
         foto_url, estado, contacto_nombre, contacto_telefono, creada_en
  from mascotas where estado <> 'cerrado';
grant select on mascotas_publicas to anon, authenticated;

create trigger trg_mascotas_actualizada before update on mascotas
  for each row execute function set_actualizada_en();
```

Nota: la vista corre con los permisos de su dueño (mismo mecanismo que
`personas_desaparecidas_publicas`), por eso `anon` puede leerla aunque no tenga
`select` sobre la tabla base. La migración se aplica en Supabase igual que las
anteriores (0001–0007); el código funciona una vez exista la tabla.

### 2. Validación — `src/lib/validacion/esquemas.ts`

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
  contacto_nombre: nombre,       // helper existente (2..120)
  contacto_telefono: telefono,   // helper existente (7..30)
})
export type DatosMascota = z.infer<typeof esquemaMascota>
```

(`foto_url` se maneja aparte de la validación, como en desaparecidos.)

### 3. Data layer — `src/lib/datos/mascotas.ts`

Espejo de `desaparecidos.ts`:
- `listarMascotas({ municipio?, tipo?, especie? })` → lee `mascotas_publicas`, aplica
  `.eq('municipio_id', …)`, `.eq('tipo_reporte', …)`, `.eq('especie', …)` según se pasen.
- `reportarMascota(entrada)` → valida `esquemaMascota`; inserta en `mascotas` con
  `estado='activo'`, `foto_url` vía helper `fotoUrlDe`, `municipio_id`/`ultima_ubicacion`
  a `null` si vacíos.
- `listarColaMascotas()` → equipo; reportes `estado in ('activo','reunida')`.
- `cambiarEstadoMascota(id, estado)` → equipo; valida contra `ESTADOS_MASCOTA`; setea
  `verificada_por`.

### 4. Páginas

- `src/app/[locale]/mascotas/page.tsx` — listado público (mirror `/desaparecidos`), con
  control de filtros `tipo` + `especie` + `municipio` y tarjetas `TarjetaMascota`. Botón
  "Reportar mascota" hacia `/reportar/mascota`. Enlace a `/panel/mascotas` si el usuario
  es equipo.
- `src/app/[locale]/reportar/mascota/{page.tsx,formulario.tsx,acciones.ts}` — mirror de
  `/reportar/desaparecido`. Campos: `tipo_reporte` (select), `especie` (select), `nombre`
  (opcional), `municipio_id`, `ultima_ubicacion`, `descripcion`, `SubirFoto`,
  `contacto_nombre`, `contacto_telefono`. Con `Honeypot`.
- `src/app/[locale]/panel/mascotas/{page.tsx,FilaMascota.tsx,acciones.ts}` — mirror de
  `/panel/desaparecidos`. El equipo ve la cola (con contacto) y cambia estado
  (`reunida`/`cerrado`), con `revalidatePath` de `/mascotas` y `/panel/mascotas`.

### 5. Tarjeta — `src/componentes/listas/TarjetaMascota.tsx`

Mirror de `TarjetaDesaparecido`, más:
- Badge de `tipo_reporte`: "🐾 Perdida" / "🐾 Encontrada".
- `especie` + `nombre` (si hay).
- Foto (si hay), descripción, ubicación (`municipio · ultima_ubicacion`), estado, tiempo relativo.
- **Contacto visible:** `contacto_nombre` + botón **WhatsApp** (`https://wa.me/<telefono>`)
  y enlace `tel:<telefono>` (reutiliza el patrón de `BotonWhatsApp`; el teléfono se
  normaliza a dígitos para `wa.me`).

### 6. Filtros — `src/componentes/listas/FiltrosMascotas.tsx`

Client component que refleja el patrón URL-params de `BarraFiltros`: tres `select`
(`tipo`, `especie`, `municipio`) que actualizan el query-string. Se usa solo en
`/mascotas`. (No se modifica `BarraFiltros` para no acoplar el resto de listados.)

### 7. i18n y navegación

- Nuevo namespace `mascotas` en `src/messages/es.json` y `en.json`: `titulo`, `intro`,
  `reportar`, `gestionar`, `sin`, `gracias`, labels de `tipo` (perdida/encontrada),
  `especie` (perro/gato/ave/otro), `estado` (activo/reunida/cerrado), labels de campos
  (`nombreMascota`, `especie`, `ultimaUbicacion`…), y de contacto (`whatsapp`, `llamar`).
  Reutiliza `campos.*` donde aplique.
- Enlace `/mascotas` en `src/componentes/Navegacion.tsx` + su clave de nav en es/en.

## Datos y flujo

1. **Reportar:** `/reportar/mascota` → server action (honeypot) → `reportarMascota` →
   insert `estado='activo'` → aparece de inmediato en `/mascotas`.
2. **Ver/contactar:** `/mascotas` lee `mascotas_publicas` (incluye contacto) → tarjeta
   muestra teléfono + WhatsApp → el finder llama/escribe directo al reportante.
3. **Moderar:** equipo en `/panel/mascotas` → `cambiarEstadoMascota` → `reunida`/`cerrado`
   → `revalidatePath`.

## Manejo de errores / bordes

- Reporte inválido (zod) → errores por campo en el formulario (mirror desaparecidos).
- `foto_url` que no sea `http(s)` → se ignora (helper `fotoUrlDe`).
- `municipio_id`/`ultima_ubicacion`/`nombre` vacíos → `null`.
- Teléfono con espacios/símbolos → se muestra tal cual en `tel:`; para `wa.me` se
  normaliza a solo dígitos.
- `cambiarEstadoMascota` con estado fuera de `ESTADOS_MASCOTA` → rechazo.
- RLS: `anon` no puede leer la tabla base (solo la vista); solo puede insertar `activo`.

## Pruebas

Unit (vitest, en `tests/unit/validacion.test.ts` o `tests/unit/mascotas.test.ts`):
- `esquemaMascota` acepta un reporte válido (perdida y encontrada).
- Rechaza `tipo_reporte`/`especie` inválidos.
- Rechaza `descripcion` corta.
- Acepta `nombre`/`municipio_id` vacíos (opcionales).

Verificación manual: reportar una mascota perdida y una encontrada, verlas en
`/mascotas`, filtrar por tipo/especie, comprobar el botón de WhatsApp, y cambiar el
estado desde el panel (con usuario de equipo).

## Archivos afectados

**Nuevos**
- `supabase/migrations/0008_mascotas.sql`
- `src/lib/datos/mascotas.ts`
- `src/app/[locale]/mascotas/page.tsx`
- `src/app/[locale]/reportar/mascota/page.tsx`
- `src/app/[locale]/reportar/mascota/formulario.tsx`
- `src/app/[locale]/reportar/mascota/acciones.ts`
- `src/app/[locale]/panel/mascotas/page.tsx`
- `src/app/[locale]/panel/mascotas/FilaMascota.tsx`
- `src/app/[locale]/panel/mascotas/acciones.ts`
- `src/componentes/listas/TarjetaMascota.tsx`
- `src/componentes/listas/FiltrosMascotas.tsx`
- `tests/unit/mascotas.test.ts`

**Modificados**
- `src/lib/validacion/esquemas.ts` (esquemaMascota + enums)
- `src/messages/es.json`, `src/messages/en.json` (namespace `mascotas` + nav)
- `src/componentes/Navegacion.tsx` (enlace `/mascotas`)

## Fuera de alcance (posibles siguientes pasos)

- Mascotas en el mapa operativo y en estadísticas.
- Campos extra por especie (raza, tamaño, sexo, microchip).
- Emparejado automático perdida↔encontrada por municipio/especie.
