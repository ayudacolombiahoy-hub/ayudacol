# Detalle abrible de publicaciones (modal + página compartible)

**Fecha:** 2026-08-15
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

Que cualquier persona pueda **abrir una publicación** de un listado público y verla
en detalle: foto(s) completas sin recortar, toda la información y las acciones de
contacto/mapa. El clic desde el listado abre el detalle como **modal** (sin perder la
lista); el mismo detalle tiene una **URL propia compartible** (`/mascotas/<id>`) que,
al abrirse directo o al refrescar, muestra la **página completa**. Aplica a los siete
listados públicos.

## Problema

Hoy las tarjetas de todos los listados (`mascotas`, `acopios`, `desaparecidos`,
`necesidades`, `albergues`, `servicios`, `voluntarios`) se pintan como bloques planos:
no son clickeables y **no existe ninguna vista de detalle**. Consecuencias concretas:

- La foto se muestra recortada (`object-cover`, alto fijo `h-40`) → la imagen completa
  nunca se puede ver (p. ej. el cartel de una mascota queda cortado).
- En necesidades hay varias fotos (`fotos[]`) pero solo se pinta la primera, recortada.
- No se puede compartir una publicación individual por WhatsApp (no hay URL por ítem).

No es un bug: la capacidad simplemente no existe todavía. Es una función nueva.

## Alcance y decisiones (confirmadas con el usuario)

- **Mecanismo:** página compartible **+** modal encima, con **rutas interceptoras +
  paralelas** de Next 16 (patrón oficial "nextgram"). Construcción **páginas primero,
  modal después**: en cada corte queda algo funcionando y compartible.
- **Cobertura:** los 7 listados públicos.
- **Privacidad (se mantiene el modelo actual):** el detalle **solo lee de las vistas
  públicas**, nunca de las tablas base (que tienen `SELECT` revocado para `anon`). Por
  eso **Desaparecidos y Necesidades NO muestran contacto** (sus vistas no exponen
  teléfono; el contacto va por el equipo). Mascotas, Acopios y Albergues **sí** exponen
  contacto público.

## Qué expone cada listado (fuente de verdad = vista/tabla pública)

| Listado | Fuente pública (anon) | Foto | Contacto | Mapa (lat/lng) | Campos clave del detalle |
|---|---|---|---|---|---|
| **Mascotas** | vista `mascotas_publicas` | `foto_url` (1) | ✅ `contacto_nombre` + `contacto_telefono` (WhatsApp/llamar) | ❌ | `tipo_reporte`, `especie`, `nombre`, `estado`, `ultima_ubicacion`, `descripcion` |
| **Desaparecidos** | vista `personas_desaparecidas_publicas` | `foto_url` (1) | ❌ | ❌ | `nombre`, `edad`, `estado`, `ultima_ubicacion`, `descripcion` |
| **Necesidades** | vista `solicitudes_publicas` | **`fotos[]`** (galería) | ❌ | ✅ `lat`/`lng` | `categoria`, `urgencia`, `personas_afectadas`, `detalle_ubicacion`, `estado`, `verificada_en` |
| **Acopios** | tabla `centros_acopio` (`verificado=true`) | ❌ | ✅ `contacto_publico` | ✅ `lat`/`lng` | `direccion`, `horarios`, `recibe[]`, `no_necesita[]` |
| **Albergues** | tabla `albergues` | ❌ | ✅ `contacto_publico` | ⚠️ sin lat/lng (mapa por dirección) | `direccion`, `capacidad`/`ocupacion` (cupos), `estado` |
| **Servicios** | vista `ofertas_servicios_publicas` | ❌ | ❌ | ❌ | `tipo`, `descripcion`, `capacidad` |
| **Voluntarios** | vista `voluntarios_publicos` | ❌ | ❌ | ❌ | `habilidades[]`, `disponibilidad` |

Nota: las columnas exactas ya están fijadas por las migraciones existentes
(`0002_seguridad.sql`, `0007_features.sql`, `0008_mascotas.sql`, `0011_acopios_publicos.sql`)
y por el uso actual en las tarjetas. **No hay cambios de base de datos en esta función.**

## Arquitectura

### 1. Slot modal único para todos los listados

Los 7 listados cuelgan directo de `[locale]`, así que **un solo** slot paralelo `@modal`
en `src/app/[locale]/layout.tsx` los cubre a todos. El matcher de interceptación `(.)`
apunta al segmento del listado (hermano de `@modal` bajo `[locale]`; los slots `@…` no
cuentan como segmento), y `[id]` cuelga debajo — exactamente el patrón
`app/@modal/(.)photos/[id]/page.tsx` de la doc de Next.

```
src/app/[locale]/
  layout.tsx                        ← MOD: recibe prop `modal`, renderiza {modal} junto a {children}
  @modal/
    default.tsx                     ← NUEVO: return null (sin modal activo)
    [...catchAll]/page.tsx          ← NUEVO: return null (cierra al navegar a otra ruta)
    (.)mascotas/[id]/page.tsx       ← NUEVO: <Modal><DetalleMascota …/></Modal>
    (.)desaparecidos/[id]/page.tsx
    (.)necesidades/[id]/page.tsx
    (.)acopios/[id]/page.tsx
    (.)albergues/[id]/page.tsx
    (.)servicios/[id]/page.tsx
    (.)voluntarios/[id]/page.tsx
  mascotas/[id]/page.tsx            ← NUEVO: PÁGINA real (compartible, refresh-safe) → notFound() si no existe
  desaparecidos/[id]/page.tsx
  necesidades/[id]/page.tsx
  acopios/[id]/page.tsx
  albergues/[id]/page.tsx
  servicios/[id]/page.tsx
  voluntarios/[id]/page.tsx
```

`layout.tsx` queda:

```tsx
export default async function LocaleLayout({ children, modal, params }: {
  children: React.ReactNode
  modal: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  // …igual que hoy…
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Navegacion />
          {children}
          {modal}
          <BotonWhatsApp />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

Regla de paralelas: si un slot en un nivel es dinámico, todos deben serlo. Las páginas
ya son `force-dynamic`, así que no hay conflicto.

### 2. Cuerpo de detalle reutilizable (un componente por listado)

`src/componentes/detalle/DetalleMascota.tsx`, `DetalleDesaparecido.tsx`,
`DetalleNecesidad.tsx`, `DetalleAcopio.tsx`, `DetalleAlbergue.tsx`,
`DetalleServicio.tsx`, `DetalleVoluntario.tsx`.

- Server components. Reciben `{ item, municipio }` ya cargados y renderizan el detalle
  completo. **El mismo componente se usa en la página y en el modal** → cero
  duplicación de UI.
- Reutilizan `BotonesMaps`, el patrón de enlaces `wa.me`/`tel:` de `TarjetaMascota`, y
  `tiempoRelativo`.
- La foto/galería se muestra con `VisorFoto` (client, ver §4).

### 3. Acceso a datos por id (misma frontera de seguridad)

Añadir una función "obtener por id" en cada data layer, que consulta **la misma vista
pública** que el listado y filtra por id:

```ts
// src/lib/datos/mascotas.ts
export async function obtenerMascota(id: string) {
  const sb = crearClienteAnonimo()
  const { data, error } = await sb
    .from('mascotas_publicas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data // null si no existe / no público
}
```

Análogas: `obtenerDesaparecido` (`personas_desaparecidas_publicas`),
`obtenerNecesidad` (`solicitudes_publicas`), `obtenerAcopio` (`centros_acopio`,
sirve solo `verificado=true` vía RLS), `obtenerAlbergue` (`albergues`),
`obtenerServicio` (`ofertas_servicios_publicas`), `obtenerVoluntario`
(`voluntarios_publicos`). En cada `page.tsx`/intercept, si el resultado es `null` →
`notFound()`.

Los `[id]` son UUID: validar formato UUID antes de consultar (evita queries basura).

### 4. Piezas compartidas de UI

- **`src/componentes/detalle/Modal.tsx`** (client): overlay con fondo oscuro,
  `role="dialog"` + `aria-modal`, cierre por (a) clic en el fondo, (b) tecla `Esc`,
  (c) botón "×". Cierra con `router.back()`. Bloquea el scroll del body mientras está
  abierto y devuelve el foco al cerrar. Recibe `children` (el `Detalle…`).
- **`src/componentes/detalle/VisorFoto.tsx`** (client): muestra la imagen **sin
  recortar** (`object-contain`, alto máximo con scroll interno) y permite ampliarla a
  pantalla completa al hacer clic. Variante galería para `fotos[]` (necesidades): mini
  navegación anterior/siguiente. Un solo componente con prop `fotos: string[]`.
- **`src/componentes/detalle/CromoDetalle.tsx`** (opcional, server): contenedor de la
  **página** (no del modal) con enlace "← Volver" y `max-w-*`, para que la página suelta
  no quede desnuda.

### 5. Tarjetas clickeables (patrón *stretched-link*, sin anclas anidadas)

Cada tarjeta se vuelve clickeable con un `<Link>` **absoluto** que cubre la tarjeta
(`className="absolute inset-0"`, con `aria-label`), mientras los botones interactivos
(WhatsApp/Llamar/Mapas) llevan `relative z-10` y siguen funcionando de forma
independiente. La tarjeta contenedora lleva `relative`. Así el HTML es válido (el link
y los botones son hermanos, no anidados).

- `TarjetaMascota`, `TarjetaDesaparecido`, `TarjetaNecesidad`: añadir el stretched-link
  a `/<listado>/<id>` usando el `Link` localizado de `@/i18n/navegacion`.
- Acopios, albergues, servicios y voluntarios hoy son `<article>` inline en la página.
  Extraer `TarjetaAcopio`, `TarjetaAlbergue`, `TarjetaServicio`, `TarjetaVoluntario` en
  `src/componentes/listas/` (misma UI actual + stretched-link). Mejora enfocada, no
  refactor gratuito.

### 6. i18n

Nuevo namespace `detalle` en `src/messages/{es,en}.json` con claves compartidas:
`volver`, `cerrar`, `verFoto`, `fotoAnterior`, `fotoSiguiente`, `cerrarModal`, y
etiquetas de sección que el detalle necesite y no existan aún (p. ej.
`contacto`, `ubicacion`, `horarios`, `recibe`, `noNecesita`, `cupos`). Reutilizar las
claves ya existentes por namespace (`mascotas.*`, `desaparecidos.*`, `listas.*`,
`albergues.*`, `categorias.*`, `maps.*`) donde ya cubran el texto.

### 7. Metadatos por publicación (compartir en WhatsApp)

Cada `page.tsx` de detalle exporta `generateMetadata` para que el link compartido
muestre título + descripción + (si hay) `foto_url` como `openGraph.images`. Esto hace
que pegar `/mascotas/<id>` en WhatsApp muestre una tarjeta con la foto — muy valioso
para difundir mascotas/desaparecidos. Si el ítem no existe → metadatos neutros.

## Datos y flujo

1. **Listado → abrir:** el usuario hace clic en una tarjeta de `/mascotas`. El
   stretched-link navega a `/mascotas/<id>`; la interceptación `(.)mascotas/[id]` monta
   el detalle en el slot `@modal` **encima** de la lista. La URL cambia a
   `/mascotas/<id>` (compartible) sin desmontar la lista.
2. **Cerrar:** `Esc`/fondo/× → `router.back()` → vuelve a `/mascotas`, el slot
   `@modal` cae en `default.tsx` (null). Navegar a otra sección → catch-all null.
3. **Link directo / refresh:** abrir `/mascotas/<id>` de cero → no hay interceptación →
   se renderiza la **página completa** `mascotas/[id]/page.tsx`.
4. **Datos:** ambos caminos llaman `obtenerMascota(id)` sobre la vista pública →
   `notFound()` si null → `<DetalleMascota>`.

## Manejo de errores / bordes

- `id` con formato no-UUID → `notFound()` sin consultar.
- Ítem inexistente / no público (p. ej. mascota `cerrado`, acopio sin verificar) → la
  vista no lo devuelve → `null` → `notFound()`.
- Mascota sin foto / albergue sin lat-lng → el detalle omite esas secciones (mismos
  guards que las tarjetas actuales; `BotonesMaps` ya cae a búsqueda por dirección).
- Teléfono con símbolos → `tel:` tal cual; `wa.me` normaliza a solo dígitos (patrón
  existente).
- `next-intl` + interceptación: el `Link` localizado prefija `[locale]`. **Riesgo a
  verificar** en implementación (combinación algo quisquillosa): que la interceptación
  dispare con el prefijo de locale y que el back cierre limpio. Si la capa modal diera
  problemas, las **páginas** ya cumplen el objetivo — el modal es incremental.
- Scroll lock del modal: restaurar siempre al desmontar (evitar body bloqueado tras
  navegación rápida).
- Accesibilidad: `role="dialog"`, `aria-modal="true"`, foco inicial al modal, `Esc`
  cierra, foco de vuelta al disparador.

## Pruebas

Unit (vitest):
- Validador de UUID: acepta UUID válido, rechaza basura.
- `obtener<X>(id)`: dado un cliente mockeado, arma la query correcta (`from(vista).eq('id',…).maybeSingle()`) y propaga `null`.
- Render de un `Detalle<X>` (al menos mascota, necesidad, acopio) con datos de ejemplo:
  muestra los campos esperados y **oculta contacto** en desaparecidos/necesidades.

Verificación manual (con `next dev`):
- Clic en tarjeta abre modal; URL cambia; `Esc`/fondo/× cierra a la lista.
- Refrescar en `/mascotas/<id>` muestra página completa.
- Foto se ve completa; galería de necesidades navega.
- WhatsApp/Llamar en mascotas/acopios/albergues; sin contacto en desaparecidos/necesidades.
- Pegar el link en un chat muestra la tarjeta OG con foto.
- Repetir en es/en.

## Orden de construcción (fases)

1. **Infra compartida:** `Modal`, `VisorFoto`, slot `@modal` + `default.tsx` +
   `[...catchAll]`, `layout.tsx` con prop `modal`. Verificar el patrón con **un** listado
   de prueba (mascotas) de punta a punta antes de replicar.
2. **Con foto (mayor valor):** Mascotas, Desaparecidos, Necesidades (galería + mapa).
3. **Logística/contacto:** Acopios, Albergues (extraer tarjetas + mapa/contacto).
4. **Simples:** Servicios, Voluntarios (extraer tarjetas + detalle de texto).

Cada fase deja páginas de detalle funcionando y compartibles aunque el modal se
difiera.

## Archivos afectados

**Nuevos**
- `src/app/[locale]/@modal/default.tsx`
- `src/app/[locale]/@modal/[...catchAll]/page.tsx`
- `src/app/[locale]/@modal/(.)<listado>/[id]/page.tsx` × 7
- `src/app/[locale]/<listado>/[id]/page.tsx` × 7 (páginas de detalle)
- `src/componentes/detalle/Modal.tsx`
- `src/componentes/detalle/VisorFoto.tsx`
- `src/componentes/detalle/CromoDetalle.tsx`
- `src/componentes/detalle/Detalle<X>.tsx` × 7
- `src/componentes/listas/TarjetaAcopio.tsx`, `TarjetaAlbergue.tsx`, `TarjetaServicio.tsx`, `TarjetaVoluntario.tsx`
- `tests/unit/detalle.test.ts`

**Modificados**
- `src/app/[locale]/layout.tsx` (prop `modal` + render)
- `src/lib/datos/mascotas.ts`, `desaparecidos.ts`, `consultas.ts`, `albergues.ts` (funciones `obtener<X>`)
- `src/componentes/listas/TarjetaMascota.tsx`, `TarjetaDesaparecido.tsx`, `TarjetaNecesidad.tsx` (stretched-link)
- `src/app/[locale]/acopios/page.tsx`, `albergues/page.tsx`, `servicios/page.tsx`, `voluntarios/page.tsx` (usar las tarjetas extraídas)
- `src/messages/es.json`, `src/messages/en.json` (namespace `detalle`)

**Sin cambios de base de datos.** La función se apoya 100% en las vistas/tablas públicas ya existentes.

## Fuera de alcance (posibles siguientes pasos)

- Revisar si Desaparecidos/Necesidades deberían permitir contacto (decisión de producto
  aparte; hoy se mantiene el modelo privado).
- Detalle de novedades/campañas (no son listados con tarjeta pública tipo ítem).
- Compartir con botón nativo (`navigator.share`) y copiar-link.
- Emparejado o "publicaciones relacionadas" dentro del detalle.
