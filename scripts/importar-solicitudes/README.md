# Import puntual de solicitudes de Caldas

Trae necesidades (🆘) de Caldas de redayudamanizales.com a `solicitudes_ayuda`
como `sin_verificar`. Un moderador reconfirma por WhatsApp antes de publicar el
contacto. Los `.json`/`.csv` de esta carpeta tienen datos personales y **no se
versionan** (ver `.gitignore`).

## Pasos

1. **Extraer** (asistido, una vez): en redayudamanizales.com/resultados, filtrar
   a "🆘 Necesitan", cargar todas y guardar un `datos-crudos.json` con un objeto
   por tarjeta:
   `{ tipo:"necesita", nombre, descripcion, ubicacion, fecha_texto, telefono }`
   (el teléfono sale del enlace `wa.me`).

2. **Normalizar** → CSV revisable (filtra Caldas + últimos 14 días):
   ```bash
   node scripts/importar-solicitudes/normalizar.mjs datos-crudos.json --dias 14
   ```
   Genera `solicitudes-para-revisar.csv`.

3. **Revisar** (a mano, en hoja de cálculo): corrige `categoria`/`municipio_id`
   donde la columna `revisar` lo marque, borra las filas ya resueltas o sin
   teléfono. Guarda como `solicitudes-revisadas.csv`. La columna
   `direccion_exacta_privada` es para el moderador; **no** se carga.

4. **Cargar**:
   ```bash
   node scripts/importar-solicitudes/cargar.mjs solicitudes-revisadas.csv --dry-run
   node scripts/importar-solicitudes/cargar.mjs solicitudes-revisadas.csv
   ```
   Entran como `sin_verificar`/`whatsapp`. Aparecen en la cola de moderación con
   contacto; en el público, sin contacto y con ubicación gruesa.

## Notas
- Solo carga a los 19 municipios de Caldas del catálogo (0003/0005).
- Anti-duplicado por `(contacto_telefono, descripcion)`.
- Lógica pura y testeada en `mapeo.mjs` / `csv.mjs`
  (`npx vitest run tests/unit/importar-solicitudes.test.ts`).
