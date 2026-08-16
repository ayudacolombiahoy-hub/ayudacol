# Cargador por captura — Fase 2: router genérico (mascotas, desaparecidos, acopios, albergues)

**Fecha:** 2026-08-16
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

Extender el cargador por captura (`/panel/capturas`, hoy solo necesidades) a un
**router genérico**: la IA de visión **clasifica** cada publicación de la captura
en uno de 5 tipos —`necesidad`, `mascota`, `desaparecido`, `acopio`,
`albergue`— y extrae sus campos; el moderador revisa **tarjetas por tipo** (con
un **selector de tipo** para corregir la clasificación) y, al guardar, cada
tarjeta se **enruta** al helper de inserción de su entidad.

## Contexto

- **Fase 1 en producción**: `necesidad` funciona extremo a extremo (extracción
  con Claude visión → normalización → tarjetas editables → insert como
  `sin_verificar`). La imagen se guarda en `fotos[]` y el contacto es genérico
  (teléfono/@IG/link). Piezas: `src/lib/ia/extraer.ts`,
  `src/lib/ia/borrador.ts`, `src/lib/datos/capturas.ts`,
  `src/app/[locale]/panel/capturas/{acciones,CargadorCapturas,page}.tsx`,
  `src/lib/contacto.ts`, `src/lib/importacion/mapeo.ts`.
- **Hoy NO hay router**: `accionExtraerCapturas`/`accionGuardarLote` llaman
  `normalizarBorradores` + `guardarLoteNecesidades` directamente (un solo tipo).
  Fase 2 introduce el router real.
- **Los 4 helpers de inserción ya existen** (validan con su Zod y fuerzan el
  estado inicial — gran reuso):
  - `reportarMascota(entrada)` (`src/lib/datos/mascotas.ts`) — cliente anónimo,
    fuerza `estado='activo'`; lee `foto_url` aparte. Zod `esquemaMascota`:
    `tipo_reporte` (perdida/encontrada), `especie` (perro/gato/ave/otro),
    `nombre?`, `descripcion` (5–2000), `municipio_id?`, `ultima_ubicacion?`,
    `contacto_nombre`, `contacto_telefono`.
  - `reportarDesaparecido(entrada)` (`src/lib/datos/desaparecidos.ts`) — anónimo,
    fuerza `estado='buscando'`; lee `foto_url`. Zod `esquemaDesaparecido`:
    `nombre`, `edad?`, `descripcion` (5–2000), `municipio_id?`,
    `ultima_ubicacion?`, `contacto_nombre`, `contacto_telefono`.
  - `proponerAcopio(entrada)` (`src/lib/datos/acopios-publico.ts`) — anónimo,
    fuerza `organizacion_id=null, verificado=false, estado='activo'`. Zod
    `esquemaAcopioPublico`: `nombre`, `direccion`, `municipio_id`, `horarios?`,
    `contacto_publico` (5–160, **requerido**), `recibe[]`, `no_necesita[]`.
  - `crearAlbergue(entrada)` (`src/lib/datos/albergues.ts`) — **autenticado**
    (revisa moderador/admin internamente); `estado`/`ocupacion` quedan en su
    default de BD. Zod `esquemaAlbergue`: `nombre`, `direccion`, `municipio_id`,
    `capacidad?`, `ocupacion?`, `contacto_publico?`, `estado?`.
- **Columnas de foto**: `solicitudes_ayuda.fotos[]`, `mascotas.foto_url`,
  `personas_desaparecidas.foto_url`. **`centros_acopio` y `albergues` NO tienen
  columna de foto.**

## Decisiones (acordadas con el usuario)

1. **Los 4 tipos nuevos** + necesidad = router genérico de 5.
2. **La IA auto-clasifica** el tipo por publicación; el moderador **corrige** con
   un selector de tipo en la tarjeta.
3. **Imagen**: se guarda solo en `necesidad`/`mascota`/`desaparecido` (tienen
   columna). En `acopio`/`albergue` la captura se usa solo para leer; **no se
   guarda imagen**.
4. **Contacto**: `acopio`/`albergue` usan `contacto_publico` (un solo campo).
   `mascota`/`desaparecido` quedan con **teléfono** por ahora (el contacto
   genérico @IG para ellos es follow-up).
5. **Dedup + "agrega imagen a existente"** se mantiene **solo para necesidad**
   (lógica actual en `guardarLoteNecesidades`). Los demás tipos usan su helper
   público tal cual (sin dedup).
6. **Reuso máximo**: no se tocan los helpers ni los Zod existentes; el router
   arma la `entrada` que cada helper espera y lo llama.

## Arquitectura

### Extracción (`src/lib/ia/extraer.ts`)

Esquema de salida **superset** con `tipo` + campos comunes + campos por tipo
(todos nullable salvo `tipo`/`confianza`). La IA llena los del tipo que detecta.
`BorradorCrudo` gana:
```
tipo: 'necesidad'|'mascota'|'desaparecido'|'acopio'|'albergue'|'desconocido'
descripcion, ubicacion_texto, confianza
contacto?, contacto_nombre?            (necesidad/mascota/desaparecido)
contacto_publico?                      (acopio/albergue)
categoria?, urgencia?, personas_afectadas?          (necesidad)
especie?, tipo_reporte?, nombre_mascota?            (mascota)
nombre_persona?, edad?                              (desaparecido)
nombre_lugar?, direccion?, recibe?, no_necesita?, horarios?, capacidad?  (acopio/albergue)
foto_url?                              (estampado por la Server Action, como hoy)
```
El prompt describe los 5 tipos y qué extraer para cada uno; el texto de la
imagen sigue siendo dato, no instrucción.

### Normalización (`src/lib/ia/borrador.ts`)

`normalizarBorradores` produce un `Borrador` **superset** con `tipo`, `municipio_id`
resuelto (vía `mapearMunicipio` para todos), contacto limpio (necesidad genérico;
mascota/desaparecido = dígitos si es teléfono), `banderas` (incluye
`municipio_sin_mapear`, `sin_contacto`, y nuevas por campos faltantes clave del
tipo, p. ej. `mascota` sin `especie`), y `foto_url`. Descarta `desconocido`
(cuenta en `descartados`).

### Router (`src/lib/ia/enrutar.ts`, NUEVO)

`armarEntrada(borrador)` → objeto que espera el helper del tipo. Pura y testeable
(mapea campos del Borrador a la forma de cada Zod). El guardado
(`src/lib/datos/capturas.ts` → `guardarLote`) itera y enruta:
- `necesidad` → lógica actual (dedup + agrega imagen a existente).
- `mascota` → `reportarMascota({ ...entrada, foto_url })`.
- `desaparecido` → `reportarDesaparecido({ ...entrada, foto_url })`.
- `acopio` → `proponerAcopio(entrada)`.
- `albergue` → `crearAlbergue(entrada)`.
Agrega un `ResumenGuardado` por tipo (o total con desglose).

### UI de revisión (`CargadorCapturas.tsx`)

La tarjeta **ramifica por `tipo`**:
- **Selector de tipo** (dropdown) arriba; al cambiarlo se re-renderizan los
  campos de ese tipo (los vacíos los llena el moderador).
- Campos comunes: municipio (con aviso si no mapeó), y contacto según tipo.
- Campos por tipo (categoría/urgencia; especie/tipo_reporte/nombre; nombre/edad;
  nombre/dirección/recibe/horarios; nombre/dirección/capacidad).
Estado controlado en React (como hoy).

### i18n

Namespace `capturas` gana etiquetas de tipos y de los campos nuevos, en ES/EN.

## Estrategia de pruebas

- **Puras (vitest), sin llamar a la IA:**
  - `normalizarBorradores` por tipo: municipio, contacto, banderas de campos
    faltantes, descarte de `desconocido`.
  - `enrutar.armarEntrada`: por `tipo` produce la forma correcta (campos y
    nombres que cada Zod espera); `desconocido`/no soportado no se enruta.
  - Validación cruzada: la `entrada` armada pasa el Zod del tipo con datos válidos.
- **La llamada a Claude no se testea** (se mockea); se valida a mano con capturas
  reales por tipo.

## Fuera de alcance (follow-up)

- Contacto genérico (@IG/link) para mascotas/desaparecidos.
- Dedup para tipos distintos de necesidad.
- `refugios_animales`, `servicios`, `voluntarios` como tipos del router.
- Guardar imagen para acopios/albergues (no tienen columna).
