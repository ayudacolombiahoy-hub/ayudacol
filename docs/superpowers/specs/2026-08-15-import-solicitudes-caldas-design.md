# Import puntual de solicitudes de Caldas desde redayudamanizales.com

**Fecha:** 2026-08-15
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

Traer a `solicitudes_ayuda` las **necesidades (🆘)** publicadas en
`https://redayudamanizales.com/resultados` que sean de **Caldas** y sigan
**vigentes**, como un **import puntual y revisable**: extraer → normalizar →
**CSV que el usuario revisa** → cargar como `sin_verificar`. Un moderador
reconfirma por WhatsApp antes de que se publiquen con contacto (flujo ya
existente en la app). No se toca el esquema, ni la UI, ni se publica contacto.

## Contexto

- **Fuente**: `/resultados` es una SPA (React + Firebase) con ~249 tarjetas que
  mezclan tres tipos: **🆘 Necesitan**, **🤝 Ofrecen** y **🐾 Mascotas**. Cada
  tarjeta trae: nombre de persona, tipo, descripción, ubicación (a veces
  dirección exacta con apto), fecha/hora y botón **"Contactar por WhatsApp"**
  (enlace `wa.me` con el teléfono). Interesa **solo el tipo 🆘**.
- **Destino** `solicitudes_ayuda` (0001): `categoria categoria_necesidad`,
  `descripcion` (check 10–2000), `personas_afectadas int?`, `urgencia`,
  `municipio_id → municipios(codigo_dane)`, `detalle_ubicacion`, `lat/lng`,
  `estado estado_solicitud` (default `sin_verificar`), `origen origen_reporte`
  (`web`/`whatsapp`), `fotos text[]`, `contacto_nombre` (not null),
  `contacto_telefono` (not null).
- **Análogo existente**: `crearTranscripcion()` en `src/lib/datos/moderacion.ts`
  inserta un reporte capturado por el moderador con
  `{ ...datos, estado: 'sin_verificar', origen: 'whatsapp' }`, validado con
  `esquemaNecesidad`. El import es, en esencia, un `crearTranscripcion` en lote.
- **Municipios de Caldas en catálogo** (0003/0005) — **19**, no los 27 del
  departamento: Manizales `17001`, Chinchiná `17174`, Villamaría `17873`, Neira
  `17486`, Palestina `17524`, Anserma `17042`, Aguadas `17013`, Aranzazu
  `17050`, La Dorada `17380`, Manzanares `17433`, Marmato `17442`, Marquetalia
  `17444`, Pensilvania `17541`, Riosucio `17614`, Salamina `17653`, Samaná
  `17662`, San José `17665`, Supía `17777`, Viterbo `17877`. `municipio_id` es
  FK: solo se puede cargar a uno de estos.
- **Hallazgo de privacidad (define el diseño)**: la vista pública
  `solicitudes_publicas` (0002) expone
  `categoria, descripcion, personas_afectadas, urgencia, municipio_id,
  detalle_ubicacion, lat, lng, estado, origen, fotos, verificada_en, creada_en,
  actualizada_en` para todo estado **excepto** `rechazada`/`duplicada` — es
  decir, **`sin_verificar` es público**. La vista **NO** incluye
  `contacto_nombre` ni `contacto_telefono` (nunca públicos), pero **SÍ**
  `descripcion` y `detalle_ubicacion`. En la fuente, algunas descripciones traen
  teléfono embebido y muchas ubicaciones traen dirección exacta → esos campos
  públicos deben **limpiarse** antes de cargar.

## Decisiones (acordadas con el usuario)

1. **Enfoque A: import puntual revisable.** El entregable intermedio es un
   **CSV** que el usuario revisa/edita antes de cargar nada. No hay sync
   recurrente (sería fase 2).
2. **Solo 🆘 y solo Caldas** de los **19 municipios del catálogo**. Ubicaciones
   de barrios/veredas se resuelven al municipio contenedor (p. ej. *"Fátima"*,
   *"Las Américas"*, *"La Enea"* → Manizales `17001`; *"Pueblo Rico, Neira"* →
   Neira `17486`). Lo que no se pueda mapear queda **marcado** para decisión
   manual, no se adivina.
3. **Vigencia por fecha**: se importan las de los **últimos 14 días** (parámetro
   ajustable `--dias`). La fuente no marca "resuelta", así que la vigencia real
   la confirma el moderador; el corte de fecha solo reduce ruido. En la revisión
   el usuario descarta las que ya se resolvieron.
4. **Privacidad concreta**:
   - `contacto_nombre` / `contacto_telefono` → columnas de contacto (la vista
     pública nunca las expone).
   - `descripcion` pública → **teléfonos removidos** (regex).
   - `detalle_ubicacion` público → **solo sector/barrio**, sin número de
     casa/apto.
   - La **dirección exacta** viaja únicamente en una **columna privada del CSV**
     (`direccion_exacta_privada`) para que el moderador la use al reconfirmar;
     **no se carga** a la base.
5. **Insert idéntico al análogo**: `estado='sin_verificar'`, `origen='whatsapp'`,
   `fotos='{}'`, `lat/lng` nulos.
6. **Artefactos con PII no se commitean**: `datos-crudos.json` y los `.csv`
   quedan en `.gitignore`. Solo se versiona el código (scripts + tests).
7. **Funciones puras en `.mjs`** (no hay `tsx`): el mapeo/limpieza vive en un
   módulo `.mjs` con exports nombrados, importable tanto por los scripts como
   por vitest, sin paso de build.

## Arquitectura

### 1. Extracción → `datos-crudos.json`

Extracción asistida por navegador (una vez): cargar `/resultados`, filtrar a
**🆘 Necesitan**, hacer scroll hasta cargar todas, y leer de cada tarjeta los
campos crudos, incluido el teléfono del `href` de WhatsApp (`wa.me/57…` o
`api.whatsapp.com/send?phone=…`). Resultado: un arreglo JSON, una entrada por
tarjeta:

```json
{
  "tipo": "necesita",
  "nombre": "Elizabeth Cárdenas Cardona",
  "descripcion": "Mi apartamento resultó afectado ...",
  "ubicacion": "Villa María, Calle 9A # 7-16 apto 401 Edificio Temia",
  "fecha_texto": "14 de agosto de 2026 a las 8:14 p. m.",
  "telefono": "573001234567"
}
```

El JSON crudo es un artefacto (no se commitea). El scraping queda fuera de los
scripts versionados por ser una SPA Firebase frágil; para un import puntual, la
extracción asistida es suficiente y menos agresiva que golpear su backend.

### 2. Módulo de mapeo puro — `scripts/importar-solicitudes/mapeo.mjs`

Funciones puras (sin I/O), exportadas y testeadas:

- `esNecesidad(item)` → `boolean`. Filtra tipo 🆘.
- `limpiarTelefonos(texto)` → `string`. Remueve secuencias telefónicas
  colombianas (`+57`, `3XX XXX XXXX`, bloques de 7–10 dígitos con separadores,
  prefijo `📞`) del texto público. No altera el resto.
- `mapearCategoria(descripcion)` → `{ categoria, confianza }`. Diccionario de
  palabras clave → `categoria_necesidad`:
  `alimento/comida/mercado/pañal(comida)` → `alimentos`;
  `agua` → `agua`;
  `arriendo/vivienda/alojamiento/refugio/dormir/evacuar` → `albergue`;
  `techo/cemento/arena/ladrillo/reconstrucción/material/varilla/drywall` →
  `materiales_construccion`;
  `escombro/remoción/limpieza` → `remocion_escombros`;
  `médico/salud/pañal(adulto)/medicamento/valoración/psicólog` → `salud`;
  `rescate/atrapad/desaparecid` → `rescate`;
  sin match → `{ categoria: 'otro', confianza: 'baja' }`.
- `inferirUrgencia(descripcion)` → `'alta' | 'media' | 'baja'`. `alta` con
  `urgente/peligro/rescate/inmediat/riesgo`; si no, `media`.
- `mapearMunicipio(ubicacion)` → `{ municipio_id, nombre } | null`. Tabla de
  alias: los 19 municipios por nombre (normalizado sin tildes/minúsculas) +
  barrios/veredas conocidos → su municipio contenedor. `null` si no hay match
  seguro.
- `sectorDe(ubicacion)` → `string`. Devuelve sector/barrio sin dirección exacta:
  elimina tokens de dirección (`calle/carrera/cra/kra/#/número/apto/piso` +
  dígitos de casa). Si queda vacío, cae al nombre del municipio.
- `parsearFechaEs(fecha_texto)` → ISO `string`. Parsea `"15 de agosto de 2026 a
  las 1:47 p. m."` (meses en español, am/pm con `a. m.`/`p. m.`).
- `dentroDeVentana(fechaISO, dias, ahoraISO)` → `boolean`. `ahora` se inyecta
  (testeable; sin `Date.now()` oculto).

### 3. Normalizador — `scripts/importar-solicitudes/normalizar.mjs`

`node scripts/importar-solicitudes/normalizar.mjs <crudos.json> [--dias 14] [--ahora ISO] [--salida csv]`

Lee el JSON crudo y produce `solicitudes-para-revisar.csv`. Por cada item:
filtra con `esNecesidad`; descarta fuera de ventana (`dentroDeVentana`); mapea
categoría, urgencia, municipio, sector; limpia teléfonos de la descripción;
calcula banderas de revisión. Ordena por urgencia y fecha. Reporta contadores
(total, descartados por tipo/fecha/municipio) por stdout.

**Columnas del CSV** (públicas = se cargan; privadas/meta = referencia del
moderador, no se cargan):

| Columna | Uso | Se carga |
|---|---|---|
| `revisar` | banderas: `categoria_incierta`, `municipio_sin_mapear`, `descripcion_corta`, `sin_telefono`, `posible_direccion` | no |
| `categoria` | público | sí |
| `urgencia` | público | sí |
| `municipio_id` | público (FK) | sí |
| `municipio_nombre` | ayuda visual | no |
| `descripcion` | público (teléfonos removidos) | sí |
| `detalle_ubicacion` | público (solo sector) | sí |
| `personas_afectadas` | público (normalmente vacío) | sí |
| `contacto_nombre` | privado | sí |
| `contacto_telefono` | privado | sí |
| `direccion_exacta_privada` | privado (reconfirmación) | **no** |
| `fecha_fuente` | meta | no |
| `descripcion_original` | referencia | no |

### 4. Revisión humana

El usuario abre el CSV, corrige `categoria`/`municipio_id` donde `revisar` lo
marque, **borra las filas ya resueltas o sin teléfono**, y guarda como
`solicitudes-revisadas.csv`. Es el único punto de control antes de tocar la base.

### 5. Cargador — `scripts/importar-solicitudes/cargar.mjs`

`node scripts/importar-solicitudes/cargar.mjs <revisadas.csv> [--dry-run]`

Sigue el patrón de `aplicar-migraciones.mjs`: `dotenv` (`.env.local`) + `pg`
contra `SUPABASE_DB_URL`. Por cada fila:

1. Toma solo las columnas que se cargan; ignora `revisar`,
   `direccion_exacta_privada`, `municipio_nombre`, `fecha_fuente`,
   `descripcion_original`.
2. **Valida** (réplica de `esquemaNecesidad` + checks de la tabla, sin importar
   TS): `categoria`∈enum, `urgencia`∈enum, `descripcion` 10–2000,
   `municipio_id` presente, `contacto_nombre` y `contacto_telefono` no vacíos.
   Fila inválida → se **omite** con motivo por stdout (no aborta el lote).
3. **Anti-duplicado**: omite si ya existe una fila con igual
   `(contacto_telefono, descripcion)`.
4. Inserta `{ ...campos, estado: 'sin_verificar', origen: 'whatsapp' }`. La FK de
   `municipio_id` y los checks de la tabla son la última barrera.
5. `--dry-run` valida e informa sin insertar.

Al final imprime: insertadas, omitidas (por validación / duplicado), total.

## Flujo resultante

1. Se extrae `/resultados` (🆘) → `datos-crudos.json`.
2. `normalizar.mjs` → `solicitudes-para-revisar.csv` (filtrado a Caldas + últimos
   14 días, con banderas).
3. El usuario revisa: corrige categorías/municipios marcados, descarta resueltas
   → `solicitudes-revisadas.csv`.
4. `cargar.mjs --dry-run` para ver el conteo; luego sin flag para insertar.
5. Entran como `sin_verificar`/`whatsapp`. Aparecen en la **cola de moderación**
   (`listarCola`, contacto visible solo al equipo). En el público se ven sin
   contacto y con ubicación gruesa.
6. El moderador reconfirma por WhatsApp (usando `direccion_exacta_privada` del
   CSV) y verifica/rechaza con el flujo existente.

## Manejo de errores / bordes

- **Descripción `.` o < 10 chars** (existen en la fuente) → bandera
  `descripcion_corta`; el cargador la omite si no se corrigió.
- **Sin teléfono** en el enlace → bandera `sin_telefono`; `contacto_telefono` es
  `not null`, así que se omite salvo que el usuario lo complete.
- **Municipio sin mapear** o fuera de los 19 → bandera `municipio_sin_mapear`;
  el usuario asigna uno válido o borra la fila (FK la rechazaría igual).
- **Categoría incierta** → entra como `otro` con bandera; el usuario ajusta.
- **Dirección detectada en el sector** → bandera `posible_direccion` para
  revisar que `detalle_ubicacion` no filtre dirección exacta.
- **Reejecución** → el anti-duplicado `(telefono, descripcion)` evita recargas;
  aun así, `--dry-run` primero.
- **Fecha no parseable** → se trata como fuera de ventana (se descarta) y se
  cuenta; nunca rompe el lote.
- **PII**: `datos-crudos.json` y `*.csv` en `.gitignore`; nunca al repo.

## Pruebas

Unit (vitest, `tests/unit/importar-solicitudes.test.ts`), sobre `mapeo.mjs`:

- `esNecesidad`: acepta 🆘, rechaza ofrece/mascota.
- `limpiarTelefonos`: quita `📞 313 625 3353`, `+57 300 123 4567` y bloques de
  10 dígitos; conserva el resto del texto y no rompe cifras no telefónicas
  (p. ej. "3 habitaciones", "talla M").
- `mapearCategoria`: "alimentación"→`alimentos`, "arriendo/evacuar"→`albergue`,
  "cemento/ladrillos"→`materiales_construccion`, "escombros"→`remocion_escombros`,
  "pañal para adulto/valoración"→`salud`; texto neutro→`otro`/`baja`.
- `inferirUrgencia`: "urgente"/"peligro"→`alta`; neutro→`media`.
- `mapearMunicipio`: "Manizales"→`17001`, "Pueblo Rico, Neira"→`17486`,
  "Fátima"→`17001`, "Bogotá"→`null`.
- `sectorDe`: "Villa María, Calle 9A # 7-16 apto 401"→sin número de casa/apto;
  vacío→municipio.
- `parsearFechaEs` + `dentroDeVentana` (con `ahora` inyectado): dentro/fuera de
  14 días; fecha basura → descartada.

Verificación manual (tras cargar en un entorno de prueba):
- Fila cargada aparece en `listarCola()` (equipo) con contacto.
- `solicitudes_publicas` la muestra **sin** `contacto_*` y con
  `detalle_ubicacion` grueso.
- `--dry-run` no inserta; segunda corrida no duplica.

## Archivos afectados

**Nuevos**
- `scripts/importar-solicitudes/mapeo.mjs` (funciones puras)
- `scripts/importar-solicitudes/normalizar.mjs` (JSON crudo → CSV)
- `scripts/importar-solicitudes/cargar.mjs` (CSV revisado → insert vía `pg`)
- `scripts/importar-solicitudes/README.md` (uso paso a paso)
- `tests/unit/importar-solicitudes.test.ts`

**Modificados**
- `.gitignore` (ignorar `datos-crudos.json` y `scripts/importar-solicitudes/*.csv`)

**Sin cambios**: esquema (`solicitudes_ayuda`, vistas, enums), UI, i18n, RLS. El
import usa el estado y la vista existentes; el `origen='whatsapp'` reutiliza el
valor del análogo `crearTranscripcion`.

## Fuera de alcance

- Sincronización recurrente / scraping versionado (fase 2).
- Fotos, geocoding (`lat/lng`), `personas_afectadas` automático.
- Publicar contacto o dirección exacta (lo hace el moderador tras reconfirmar).
- Nuevo valor de `origen` o estado "borrador"/"oculto": no se modifica el enum.
- Municipios de Caldas fuera de los 19 del catálogo (habría que sembrarlos
  aparte si aparecen).
