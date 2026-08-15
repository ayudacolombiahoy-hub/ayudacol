# Botones de Google Maps en acopios y albergues

**Fecha:** 2026-08-15
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

Permitir que cualquier persona, desde una tarjeta de centro de acopio o de
albergue, abra la ubicación en Google Maps y obtenga indicaciones para llegar,
con un par de clics y sin depender de coordenadas cargadas manualmente.

## Contexto

- La tabla `centros_acopio` tiene `direccion` (texto, obligatorio) y columnas
  `lat`/`lng` **opcionales que hoy nadie llena** (el formulario no las captura).
  La tabla `albergues` es análoga: `direccion` + `municipio_id`, sin coordenadas.
- El mapa operativo (`src/app/[locale]/mapa/page.tsx`) dibuja necesidades y
  acopios; cuando falta `lat/lng` cae al centroide del municipio. **Los albergues
  no se dibujan en el mapa.**
- Por eso el enlace se construye a partir del **texto de la dirección**
  (+ municipio + departamento + país), que Google geocodifica. Si en el futuro
  un registro trae `lat/lng`, se usan para un pin exacto.

## Alcance (decidido con el usuario)

- **Dos botones** por ubicación: "Ver ubicación" y "Cómo llegar".
- **Acopios** (lista): botones en cada tarjeta.
- **Albergues** (lista): botones en cada tarjeta.
- **Popup del mapa**: enlaces solo para puntos de tipo `acopio` (los que tienen
  dirección real). Las necesidades no tienen dirección de calle → sin botón.
- **Fuera de alcance:** dibujar albergues en el mapa (se mantiene solo la lista).

## Arquitectura

### 1. Helper puro — `src/lib/geo/maps.ts`

```ts
export type EntradaMaps = {
  direccion: string
  municipioTexto?: string   // "Salgar — Antioquia"
  lat?: number | null
  lng?: number | null
}
export type EnlacesMaps = { ver: string; comoLlegar: string }

export function enlacesMaps(e: EntradaMaps): EnlacesMaps
```

- Si `lat` y `lng` son números finitos → `query`/`destination` = `"<lat>,<lng>"`.
- Si no → `query` = `"<direccion>, <municipioTexto>, Colombia"` (se omiten las
  partes vacías y se colapsan comas/espacios sobrantes).
- URLs con formato documentado `?api=1`, con `encodeURIComponent`:
  - `ver`: `https://www.google.com/maps/search/?api=1&query=<q>`
  - `comoLlegar`: `https://www.google.com/maps/dir/?api=1&destination=<q>`
- Función pura, sin dependencias, testeable de forma aislada.

### 2. Componente presentacional — `src/componentes/BotonesMaps.tsx`

- Recibe `{ direccion, municipioTexto?, lat?, lng?, textoVer, textoComoLlegar }`.
- Llama a `enlacesMaps()` y renderiza dos `<a>`:
  - `target="_blank"`, `rel="noopener noreferrer"`.
  - Estilo de botón pequeño coherente con los existentes (bordes redondeados,
    `text-xs`/`text-sm`, hover). Iconos: 📍 Ver ubicación, 🧭 Cómo llegar.
- Sin estado; puede usarse dentro de server components (recibe textos por props,
  ya que `getTranslations` corre en el servidor).
- Si `direccion` viene vacía, no renderiza nada (guarda defensiva).

### 3. Integración en listas (server components)

- `src/app/[locale]/acopios/page.tsx`: dentro de cada `<article>`, al pie,
  `<BotonesMaps direccion={a.direccion} municipioTexto={mapaMuni.get(a.municipio_id)} lat={a.lat} lng={a.lng} textoVer=… textoComoLlegar=… />`.
- `src/app/[locale]/albergues/page.tsx`: igual, dentro de cada tarjeta.
- Textos vía `getTranslations('maps')` en cada página.

### 4. Integración en el popup del mapa

- `src/app/[locale]/mapa/page.tsx`:
  - Cargar también `listarMunicipios()` para armar el texto de municipio.
  - Para cada punto de tipo `acopio`, calcular `enlacesMaps(...)` y adjuntar
    `mapsVer` y `mapsDir` (strings) a las `properties` del punto.
  - Extender el tipo `Punto` con `mapsVer?: string; mapsDir?: string`.
  - Pasar las etiquetas (`verUbicacion`, `comoLlegar`) a `MapaOperativo` como prop.
- `src/componentes/mapa/MapaOperativo.tsx`:
  - Propagar `mapsVer`/`mapsDir` en el `properties` del GeoJSON.
  - En el `setHTML` del popup, si hay `mapsVer`, añadir los dos enlaces bajo el
    título (mismos `target`/`rel`). Escapar el título (ya se inserta como HTML).

### 5. i18n — `src/messages/es.json` y `en.json`

Nuevo namespace de nivel superior `maps`:

```jsonc
"maps": {
  "verUbicacion": "Ver ubicación",   // en: "View location"
  "comoLlegar": "Cómo llegar"         // en: "Get directions"
}
```

## Datos y flujo

1. Página lista (servidor) → consulta acopios/albergues (ya existe) → arma
   `municipioTexto` con el `Map` de municipios que ya construye → pasa props a
   `BotonesMaps`.
2. `BotonesMaps` → `enlacesMaps()` → dos `<a>` a Google Maps.
3. Mapa → URLs precalculadas en el servidor viajan como `properties` GeoJSON →
   el popup las pinta al hacer clic en un acopio.

## Manejo de errores / bordes

- `direccion` vacía o solo espacios → `BotonesMaps` no renderiza (no debería
  pasar: la BD la exige, pero se protege igual).
- `lat`/`lng` presentes pero no finitos (NaN) → se ignoran y se usa la dirección.
- Texto con comas/tildes/espacios → `encodeURIComponent` lo maneja; el helper
  normaliza comas duplicadas antes de codificar.
- El popup del mapa inserta HTML: los valores provienen de URLs ya codificadas y
  de etiquetas fijas de i18n (no de entrada de usuario sin escapar).

## Pruebas

Unit (vitest, `tests/unit/maps.test.ts`):

- Prioriza `lat,lng` cuando ambos son finitos.
- Cae a dirección + municipio + "Colombia" cuando faltan coordenadas.
- Codifica correctamente tildes/espacios/comas.
- Omite `municipioTexto` vacío sin dejar comas colgando.
- Genera los dos endpoints (`/maps/search` y `/maps/dir`) con `?api=1`.

Verificación manual: abrir un acopio real y comprobar que "Ver ubicación" centra
el pin y "Cómo llegar" ofrece la ruta, en móvil y escritorio.

## Archivos afectados

**Nuevos**
- `src/lib/geo/maps.ts`
- `src/componentes/BotonesMaps.tsx`
- `tests/unit/maps.test.ts`

**Modificados**
- `src/app/[locale]/acopios/page.tsx`
- `src/app/[locale]/albergues/page.tsx`
- `src/app/[locale]/mapa/page.tsx`
- `src/componentes/mapa/MapaOperativo.tsx`
- `src/messages/es.json`
- `src/messages/en.json`

## Fuera de alcance (posibles siguientes pasos)

- Dibujar albergues en el mapa operativo (tercer tipo de punto + leyenda).
- Capturar `lat/lng` en los formularios (pin exacto en vez de geocodificado).
