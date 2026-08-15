# Import de solicitudes de Caldas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import puntual y revisable de las necesidades (🆘) de Caldas de `redayudamanizales.com/resultados` hacia `solicitudes_ayuda`, con limpieza de PII y control humano vía CSV.

**Architecture:** Toda la lógica pura (mapeo de campos, CSV RFC-4180, armado y validación de filas) vive en módulos `.mjs` testeables con vitest. Dos scripts `.mjs` delgados son los puntos de entrada: `normalizar.mjs` (JSON crudo → CSV de revisión) y `cargar.mjs` (CSV revisado → insert vía `pg`, como `sin_verificar`/`whatsapp`, igual que `crearTranscripcion`). La extracción del sitio es un paso manual asistido por navegador documentado en el README; no toca esquema/UI/RLS.

**Tech Stack:** Node ESM (`.mjs`), `pg` + `dotenv` (patrón de `scripts/aplicar-migraciones.mjs`), `vitest` v4, sin dependencias nuevas.

---

## File Structure

- `scripts/importar-solicitudes/csv.mjs` — encode/decode CSV RFC-4180 (puro).
- `scripts/importar-solicitudes/mapeo.mjs` — funciones puras: filtro, limpieza de teléfonos, categoría, urgencia, municipio, sector, fecha, ventana, armado de fila y validación de carga. Tablas de municipios/alias de Caldas.
- `scripts/importar-solicitudes/normalizar.mjs` — entrypoint I/O: lee `datos-crudos.json`, aplica `mapeo`, escribe CSV.
- `scripts/importar-solicitudes/cargar.mjs` — entrypoint I/O: lee CSV revisado, valida, inserta vía `pg`.
- `scripts/importar-solicitudes/README.md` — runbook (extracción → normalizar → revisar → cargar).
- `tests/unit/importar-solicitudes.test.ts` — tests de `csv.mjs` y `mapeo.mjs`.
- `.gitignore` — ignora los artefactos con PII (`datos-crudos.json`, `*.csv`).

Los tests importan directamente los `.mjs` (vitest los resuelve sin build). Los entrypoints se verifican corriendo contra un fixture pequeño.

---

## Task 1: Utilidad CSV (RFC-4180)

**Files:**
- Create: `scripts/importar-solicitudes/csv.mjs`
- Test: `tests/unit/importar-solicitudes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/importar-solicitudes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aCSV, deCSV } from '../../scripts/importar-solicitudes/csv.mjs'

describe('csv', () => {
  const columnas = ['a', 'b']

  it('escapa comas, comillas y saltos de línea', () => {
    const texto = aCSV([{ a: 'hola, mundo', b: 'dice "hey"\nsalto' }], columnas)
    expect(texto).toBe('a,b\n"hola, mundo","dice ""hey""\nsalto"\n')
  })

  it('round-trip: deCSV(aCSV(x)) devuelve objetos por cabecera', () => {
    const filas = [
      { a: 'x,1', b: 'con "comillas"' },
      { a: 'línea\ndoble', b: '' },
    ]
    expect(deCSV(aCSV(filas, columnas))).toEqual(filas)
  })

  it('deCSV con archivo vacío devuelve []', () => {
    expect(deCSV('')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/importar-solicitudes.test.ts`
Expected: FAIL — no puede resolver `../../scripts/importar-solicitudes/csv.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/importar-solicitudes/csv.mjs`:

```js
// CSV mínimo RFC-4180. Campos con , " o salto de línea van entre comillas dobles;
// las comillas internas se duplican.
export function aCSV(filas, columnas) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lineas = [columnas.map(esc).join(',')]
  for (const fila of filas) lineas.push(columnas.map((c) => esc(fila[c])).join(','))
  return lineas.join('\n') + '\n'
}

export function deCSV(texto) {
  const t = String(texto).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const registros = []
  let registro = []
  let campo = ''
  let enComillas = false
  let vistoAlgo = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++ } else enComillas = false
      } else campo += c
    } else if (c === '"') { enComillas = true; vistoAlgo = true }
    else if (c === ',') { registro.push(campo); campo = ''; vistoAlgo = true }
    else if (c === '\n') { registro.push(campo); registros.push(registro); registro = []; campo = ''; vistoAlgo = false }
    else { campo += c; vistoAlgo = true }
  }
  if (vistoAlgo || campo !== '') { registro.push(campo); registros.push(registro) }
  if (!registros.length) return []
  const cabecera = registros[0]
  return registros.slice(1).map((r) => Object.fromEntries(cabecera.map((h, j) => [h, r[j] ?? ''])))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/importar-solicitudes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/importar-solicitudes/csv.mjs tests/unit/importar-solicitudes.test.ts
git commit -m "feat: utilidad CSV RFC-4180 para import de solicitudes"
```

---

## Task 2: Mapeo de texto (filtro, teléfonos, categoría, urgencia)

**Files:**
- Create: `scripts/importar-solicitudes/mapeo.mjs`
- Test: `tests/unit/importar-solicitudes.test.ts` (añadir describe)

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/importar-solicitudes.test.ts`:

```ts
import {
  esNecesidad, limpiarTelefonos, mapearCategoria, inferirUrgencia,
} from '../../scripts/importar-solicitudes/mapeo.mjs'

describe('mapeo — texto', () => {
  it('esNecesidad filtra por tipo', () => {
    expect(esNecesidad({ tipo: 'necesita' })).toBe(true)
    expect(esNecesidad({ tipo: 'ofrece' })).toBe(false)
    expect(esNecesidad({ tipo: 'mascota' })).toBe(false)
  })

  it('limpiarTelefonos quita teléfonos y conserva el resto', () => {
    expect(limpiarTelefonos('Info 📞 313 625 3353 gracias')).toBe('Info gracias')
    expect(limpiarTelefonos('llamar +57 300 123 4567 hoy')).toBe('llamar hoy')
    expect(limpiarTelefonos('mi cel 3001234567')).toBe('mi cel')
    expect(limpiarTelefonos('familia con 3 habitaciones talla M')).toBe('familia con 3 habitaciones talla M')
  })

  it('mapearCategoria usa palabras clave y cae en otro', () => {
    expect(mapearCategoria('necesito alimentación').categoria).toBe('alimentos')
    expect(mapearCategoria('vivienda en alquiler para evacuar').categoria).toBe('albergue')
    expect(mapearCategoria('material de reconstrucción: cemento y ladrillos').categoria).toBe('materiales_construccion')
    expect(mapearCategoria('remoción de escombros').categoria).toBe('remocion_escombros')
    expect(mapearCategoria('pañales para adulto mayor').categoria).toBe('salud')
    const otro = mapearCategoria('hola buenas tardes')
    expect(otro.categoria).toBe('otro')
    expect(otro.confianza).toBe('baja')
  })

  it('inferirUrgencia sube con palabras de riesgo', () => {
    expect(inferirUrgencia('es urgente, hay peligro')).toBe('alta')
    expect(inferirUrgencia('cuando puedan, gracias')).toBe('media')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/importar-solicitudes.test.ts`
Expected: FAIL — no puede resolver `mapeo.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/importar-solicitudes/mapeo.mjs`:

```js
// Normaliza a minúsculas sin tildes para comparar.
const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function esNecesidad(item) {
  return item?.tipo === 'necesita'
}

// Quita teléfonos colombianos (celular 3XXXXXXXXX, con/sin +57 y separadores; y el ícono 📞).
export function limpiarTelefonos(texto) {
  if (!texto) return ''
  let t = String(texto).replace(/📞/g, ' ')
  t = t.replace(/(?:\+?57[\s.-]*)?\b3\d{2}[\s.-]*\d{3}[\s.-]*\d{4}\b/g, ' ')
  t = t.replace(/\b\d{3}[\s.-]\d{2}[\s.-]\d{2}\b/g, ' ')
  return t.replace(/\s{2,}/g, ' ').trim()
}

// Orden: específico antes que genérico. Primer match gana.
const REGLAS_CATEGORIA = [
  ['agua', /\bagua\b/],
  ['alimentos', /aliment|comida|mercado|desayun|almuerz|viver|hambre|leche|nutric/],
  ['remocion_escombros', /escombro|remoci|lodo|barro|despej/],
  ['materiales_construccion', /techo|cemento|arena|gravilla|ladrill|bloque|varill|reconstru|material|drywall|mdf|teja|obra/],
  ['albergue', /arriend|vivienda|alojamiento|refugio|dormir|evacu|hosped|alberg|apartament|habitaci/],
  ['salud', /medic|salud|panal|medicament|valoraci|psicolog|enferm|herida|discapac/],
  ['rescate', /rescate|atrapad|desaparecid|sepultad/],
]

export function mapearCategoria(descripcion) {
  const d = norm(descripcion)
  for (const [cat, re] of REGLAS_CATEGORIA) if (re.test(d)) return { categoria: cat, confianza: 'alta' }
  return { categoria: 'otro', confianza: 'baja' }
}

export function inferirUrgencia(descripcion) {
  const d = norm(descripcion)
  return /urgente|urgencia|peligro|riesgo|rescate|inmediat|grave/.test(d) ? 'alta' : 'media'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/importar-solicitudes.test.ts`
Expected: PASS (todos los describe).

- [ ] **Step 5: Commit**

```bash
git add scripts/importar-solicitudes/mapeo.mjs tests/unit/importar-solicitudes.test.ts
git commit -m "feat: mapeo de texto (filtro, teléfonos, categoría, urgencia)"
```

---

## Task 3: Mapeo de ubicación y fecha

**Files:**
- Modify: `scripts/importar-solicitudes/mapeo.mjs` (añadir funciones y tablas)
- Test: `tests/unit/importar-solicitudes.test.ts` (añadir describe)

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/importar-solicitudes.test.ts`:

```ts
import {
  mapearMunicipio, sectorDe, parsearFechaEs, dentroDeVentana,
} from '../../scripts/importar-solicitudes/mapeo.mjs'

describe('mapeo — ubicación y fecha', () => {
  it('mapearMunicipio resuelve municipios, alias y villa maría', () => {
    expect(mapearMunicipio('Manizales y alrededores').municipio_id).toBe('17001')
    expect(mapearMunicipio('Pueblo Rico, Neira').municipio_id).toBe('17486')
    expect(mapearMunicipio('Fátima').municipio_id).toBe('17001')
    expect(mapearMunicipio('Villa María, Calle 9A').municipio_id).toBe('17873')
    expect(mapearMunicipio('Bogotá')).toBeNull()
  })

  it('sectorDe elimina dirección exacta y cae al inicio del texto', () => {
    expect(sectorDe('Villa María, Calle 9A # 7-16 apto 401 Edificio Temia')).toBe('Villa María')
    expect(sectorDe('Centro de Manizales')).toBe('Centro de Manizales')
  })

  it('parsearFechaEs entiende el formato del sitio', () => {
    expect(parsearFechaEs('15 de agosto de 2026 a las 1:47 p. m.')).toBe('2026-08-15T18:47:00.000Z')
    expect(parsearFechaEs('texto basura')).toBeNull()
  })

  it('dentroDeVentana respeta el corte de días (con ahora inyectado)', () => {
    const ahora = '2026-08-15T18:00:00.000Z'
    expect(dentroDeVentana('2026-08-14T18:00:00.000Z', 14, ahora)).toBe(true)
    expect(dentroDeVentana('2026-07-01T00:00:00.000Z', 14, ahora)).toBe(false)
    expect(dentroDeVentana(null, 14, ahora)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/importar-solicitudes.test.ts`
Expected: FAIL — las nuevas funciones no existen.

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/importar-solicitudes/mapeo.mjs`:

```js
// Los 19 municipios de Caldas que existen en el catálogo (0003/0005). Clave = nombre normalizado.
export const MUNICIPIOS_CALDAS = {
  manizales: '17001', chinchina: '17174', villamaria: '17873', neira: '17486',
  palestina: '17524', anserma: '17042', aguadas: '17013', aranzazu: '17050',
  'la dorada': '17380', manzanares: '17433', marmato: '17442', marquetalia: '17444',
  pensilvania: '17541', riosucio: '17614', salamina: '17653', samana: '17662',
  'san jose': '17665', supia: '17777', viterbo: '17877',
}

// Barrios/veredas conocidos y variantes de escritura → municipio contenedor.
const ALIAS = {
  'villa maria': 'villamaria',
  fatima: 'manizales', 'las americas': 'manizales', 'la enea': 'manizales',
  'la sultana': 'manizales', chipre: 'manizales', palogrande: 'manizales',
  'pueblo rico': 'neira',
}

const capitalizar = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase())

export function mapearMunicipio(ubicacion) {
  const u = norm(ubicacion)
  if (!u) return null
  for (const [nombre, codigo] of Object.entries(MUNICIPIOS_CALDAS)) {
    if (new RegExp('\\b' + nombre.replace(/ /g, '\\s+') + '\\b').test(u)) {
      return { municipio_id: codigo, nombre: capitalizar(nombre) }
    }
  }
  for (const [alias, muni] of Object.entries(ALIAS)) {
    if (new RegExp('\\b' + alias.replace(/ /g, '\\s+') + '\\b').test(u)) {
      return { municipio_id: MUNICIPIOS_CALDAS[muni], nombre: capitalizar(muni) }
    }
  }
  return null
}

// Sector/barrio sin dirección exacta: corta en el primer token de dirección detallada.
export function sectorDe(ubicacion) {
  if (!ubicacion) return ''
  let s = String(ubicacion)
  const m = s.match(/\b(calle|cll|carrera|cra|kra|kr|avenida|av|diagonal|transversal|manzana|mz|numero|número|no\.)\b|#/i)
  if (m) s = s.slice(0, m.index)
  s = s.replace(/\b(apto|apartamento|piso|torre|casa|int|interior)\b.*$/i, '')
  s = s.replace(/[#°]/g, ' ').replace(/\b\d{1,4}[a-z]?\b/gi, ' ')
  return s.replace(/[-,]/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

const MESES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6,
  agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

// Parsea "15 de agosto de 2026 a las 1:47 p. m." → ISO en UTC (hora de Colombia = UTC-5).
export function parsearFechaEs(texto) {
  if (!texto) return null
  const t = norm(texto)
  const m = t.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})(?:\s+a\s+las\s+(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?))?/)
  if (!m) return null
  const mes = MESES[m[2]]
  if (mes == null) return null
  let hora = m[4] ? +m[4] : 12
  const min = m[5] ? +m[5] : 0
  if (m[6]) { const pm = /p/.test(m[6]); if (pm && hora < 12) hora += 12; if (!pm && hora === 12) hora = 0 }
  return new Date(Date.UTC(+m[3], mes, +m[1], hora + 5, min)).toISOString()
}

export function dentroDeVentana(fechaISO, dias, ahoraISO) {
  if (!fechaISO) return false
  const f = new Date(fechaISO).getTime()
  const ahora = new Date(ahoraISO).getTime()
  if (Number.isNaN(f) || Number.isNaN(ahora)) return false
  return f <= ahora + 60_000 && f >= ahora - dias * 86_400_000
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/importar-solicitudes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/importar-solicitudes/mapeo.mjs tests/unit/importar-solicitudes.test.ts
git commit -m "feat: mapeo de municipio, sector y fecha para import"
```

---

## Task 4: Armado y validación de filas

**Files:**
- Modify: `scripts/importar-solicitudes/mapeo.mjs` (añadir columnas, `filaParaRevisar`, `validarFilaCarga`)
- Test: `tests/unit/importar-solicitudes.test.ts` (añadir describe)

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/importar-solicitudes.test.ts`:

```ts
import {
  filaParaRevisar, validarFilaCarga, COLUMNAS_CSV, CAMPOS_CARGA,
} from '../../scripts/importar-solicitudes/mapeo.mjs'

describe('mapeo — filas', () => {
  const ahoraISO = '2026-08-15T18:00:00.000Z'

  it('filaParaRevisar excluye ofertas y fuera de ventana', () => {
    expect(filaParaRevisar({ tipo: 'ofrece', fecha_texto: '15 de agosto de 2026' }, { ahoraISO }).incluir).toBe(false)
    expect(filaParaRevisar({ tipo: 'necesita', fecha_texto: '1 de enero de 2020' }, { ahoraISO }).incluir).toBe(false)
  })

  it('filaParaRevisar arma la fila, limpia PII y marca banderas', () => {
    const { incluir, fila } = filaParaRevisar({
      tipo: 'necesita',
      nombre: 'Elizabeth Cárdenas',
      descripcion: 'Necesito cemento y ladrillos. 📞 3001234567',
      ubicacion: 'Villa María, Calle 9A # 7-16 apto 401',
      fecha_texto: '14 de agosto de 2026 a las 8:14 p. m.',
      telefono: '57 300 123 4567',
    }, { ahoraISO })
    expect(incluir).toBe(true)
    expect(fila.categoria).toBe('materiales_construccion')
    expect(fila.municipio_id).toBe('17873')
    expect(fila.detalle_ubicacion).toBe('Villa María')
    expect(fila.descripcion).not.toMatch(/3001234567/)
    expect(fila.contacto_telefono).toBe('573001234567')
    expect(fila.direccion_exacta_privada).toContain('apto 401')
    expect(fila.revisar).toBe('')
  })

  it('filaParaRevisar marca municipio_sin_mapear y descripcion_corta', () => {
    const { fila } = filaParaRevisar({
      tipo: 'necesita', nombre: 'X', descripcion: '.', ubicacion: 'Bogotá',
      fecha_texto: '15 de agosto de 2026', telefono: '',
    }, { ahoraISO })
    expect(fila.revisar).toContain('municipio_sin_mapear')
    expect(fila.revisar).toContain('descripcion_corta')
    expect(fila.revisar).toContain('sin_telefono')
  })

  it('validarFilaCarga acepta válidas y rechaza inválidas', () => {
    const buena = {
      categoria: 'salud', urgencia: 'alta', municipio_id: '17001',
      descripcion: 'Pañales para adulto mayor talla M', detalle_ubicacion: 'Fátima',
      personas_afectadas: '', contacto_nombre: 'Ana', contacto_telefono: '573001112233',
    }
    expect(validarFilaCarga(buena)).toEqual({ ok: true })
    expect(validarFilaCarga({ ...buena, descripcion: 'corta' }).ok).toBe(false)
    expect(validarFilaCarga({ ...buena, municipio_id: '' }).ok).toBe(false)
    expect(validarFilaCarga({ ...buena, categoria: 'inexistente' }).ok).toBe(false)
  })

  it('CAMPOS_CARGA son un subconjunto de COLUMNAS_CSV', () => {
    expect(CAMPOS_CARGA.every((c) => COLUMNAS_CSV.includes(c))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/importar-solicitudes.test.ts`
Expected: FAIL — `filaParaRevisar`/`validarFilaCarga` no existen.

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/importar-solicitudes/mapeo.mjs`:

```js
export const COLUMNAS_CSV = [
  'revisar', 'categoria', 'urgencia', 'municipio_id', 'municipio_nombre',
  'descripcion', 'detalle_ubicacion', 'personas_afectadas',
  'contacto_nombre', 'contacto_telefono', 'direccion_exacta_privada',
  'fecha_fuente', 'descripcion_original',
]

// Columnas que sí se insertan en solicitudes_ayuda.
export const CAMPOS_CARGA = [
  'categoria', 'urgencia', 'municipio_id', 'descripcion', 'detalle_ubicacion',
  'personas_afectadas', 'contacto_nombre', 'contacto_telefono',
]

const CATEGORIAS = ['alimentos', 'agua', 'albergue', 'materiales_construccion', 'remocion_escombros', 'salud', 'rescate', 'otro']
const URGENCIAS = ['alta', 'media', 'baja']

export function filaParaRevisar(item, { dias = 14, ahoraISO }) {
  if (!esNecesidad(item)) return { incluir: false, motivo: 'no_es_necesidad' }
  const fechaISO = parsearFechaEs(item.fecha_texto)
  if (!dentroDeVentana(fechaISO, dias, ahoraISO)) return { incluir: false, motivo: 'fuera_de_ventana' }

  const desc = String(item.descripcion ?? '').trim()
  const descLimpia = limpiarTelefonos(desc)
  const { categoria, confianza } = mapearCategoria(desc)
  const muni = mapearMunicipio(item.ubicacion)
  const sector = sectorDe(item.ubicacion) || (muni ? muni.nombre : '')
  const telefono = String(item.telefono ?? '').replace(/\D/g, '')

  const banderas = []
  if (confianza === 'baja') banderas.push('categoria_incierta')
  if (!muni) banderas.push('municipio_sin_mapear')
  if (descLimpia.length < 10) banderas.push('descripcion_corta')
  if (!telefono) banderas.push('sin_telefono')
  if (/\b(calle|carrera|cra|apto|piso)\b/i.test(sector) || /\d{1,4}\s*[-#]/.test(sector)) banderas.push('posible_direccion')

  return {
    incluir: true,
    fila: {
      revisar: banderas.join(' '),
      categoria,
      urgencia: inferirUrgencia(desc),
      municipio_id: muni ? muni.municipio_id : '',
      municipio_nombre: muni ? muni.nombre : '',
      descripcion: descLimpia,
      detalle_ubicacion: sector,
      personas_afectadas: '',
      contacto_nombre: String(item.nombre ?? '').trim(),
      contacto_telefono: telefono,
      direccion_exacta_privada: String(item.ubicacion ?? '').trim(),
      fecha_fuente: fechaISO,
      descripcion_original: desc,
    },
  }
}

// Réplica de esquemaNecesidad + checks de la tabla, sin importar TS.
export function validarFilaCarga(fila) {
  const e = []
  if (!CATEGORIAS.includes(fila.categoria)) e.push('categoria')
  if (!URGENCIAS.includes(fila.urgencia)) e.push('urgencia')
  const d = String(fila.descripcion ?? '').trim()
  if (d.length < 10 || d.length > 2000) e.push('descripcion')
  if (!String(fila.municipio_id ?? '').trim()) e.push('municipio_id')
  if (!String(fila.contacto_nombre ?? '').trim()) e.push('contacto_nombre')
  if (!String(fila.contacto_telefono ?? '').trim()) e.push('contacto_telefono')
  const pa = String(fila.personas_afectadas ?? '').trim()
  if (pa && !(Number.isInteger(Number(pa)) && Number(pa) > 0)) e.push('personas_afectadas')
  return e.length ? { ok: false, errores: e } : { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/importar-solicitudes.test.ts`
Expected: PASS (todos los describe).

- [ ] **Step 5: Commit**

```bash
git add scripts/importar-solicitudes/mapeo.mjs tests/unit/importar-solicitudes.test.ts
git commit -m "feat: armado y validación de filas del import"
```

---

## Task 5: Entrypoint `normalizar.mjs` (JSON crudo → CSV)

**Files:**
- Create: `scripts/importar-solicitudes/normalizar.mjs`
- Create (fixture temporal, no se commitea): `scripts/importar-solicitudes/ejemplo-crudo.json`

- [ ] **Step 1: Write the entrypoint**

Create `scripts/importar-solicitudes/normalizar.mjs`:

```js
// Normaliza el JSON crudo extraído de redayudamanizales.com a un CSV revisable.
// Uso: node scripts/importar-solicitudes/normalizar.mjs <crudos.json> [--dias 14] [--ahora ISO] [--salida archivo.csv]
import { readFileSync, writeFileSync } from 'node:fs'
import { COLUMNAS_CSV, filaParaRevisar } from './mapeo.mjs'
import { aCSV } from './csv.mjs'

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const entrada = args.find((a) => !a.startsWith('--') && (args.indexOf(a) === 0 || !args[args.indexOf(a) - 1]?.startsWith('--')))

if (!entrada) { console.error('❌ Falta el JSON crudo. Uso: normalizar.mjs <crudos.json> [--dias N]'); process.exit(1) }

const dias = Number(flag('--dias') ?? 14)
const ahoraISO = flag('--ahora') ?? new Date().toISOString()
const salida = flag('--salida') ?? 'solicitudes-para-revisar.csv'

const crudos = JSON.parse(readFileSync(entrada, 'utf8'))
const conteo = { total: crudos.length, no_necesidad: 0, fuera_ventana: 0, incluidas: 0 }
const filas = []
for (const item of crudos) {
  const r = filaParaRevisar(item, { dias, ahoraISO })
  if (!r.incluir) { conteo[r.motivo === 'no_es_necesidad' ? 'no_necesidad' : 'fuera_ventana']++; continue }
  filas.push(r.fila)
  conteo.incluidas++
}
// Orden: alta urgencia primero, luego más reciente.
const peso = { alta: 0, media: 1, baja: 2 }
filas.sort((a, b) => (peso[a.urgencia] - peso[b.urgencia]) || String(b.fecha_fuente).localeCompare(String(a.fecha_fuente)))

writeFileSync(salida, aCSV(filas, COLUMNAS_CSV))
const conBandera = filas.filter((f) => f.revisar).length
console.log(`✅ ${conteo.incluidas} filas → ${salida}`)
console.log(`   descartadas: ${conteo.no_necesidad} no-necesidad, ${conteo.fuera_ventana} fuera de ${dias} días`)
console.log(`   ⚠️  ${conBandera} filas con banderas para revisar (columna "revisar")`)
```

- [ ] **Step 2: Create a small fixture to smoke-test**

Create `scripts/importar-solicitudes/ejemplo-crudo.json`:

```json
[
  { "tipo": "necesita", "nombre": "Elizabeth Cárdenas", "descripcion": "Necesito cemento, arena y ladrillos para reconstruir. 📞 3001234567", "ubicacion": "Villa María, Calle 9A # 7-16 apto 401", "fecha_texto": "14 de agosto de 2026 a las 8:14 p. m.", "telefono": "573001234567" },
  { "tipo": "ofrece", "nombre": "Yesid", "descripcion": "Soldadura disponible", "ubicacion": "Manizales", "fecha_texto": "15 de agosto de 2026 a las 11:59 a. m.", "telefono": "573000000000" },
  { "tipo": "necesita", "nombre": "Leidy", "descripcion": "Pañales para adulto mayor talla M urgente", "ubicacion": "Pueblo Rico, Neira", "fecha_texto": "15 de agosto de 2026 a las 10:02 a. m.", "telefono": "573112223344" }
]
```

- [ ] **Step 3: Run the entrypoint against the fixture**

Run:
```bash
node scripts/importar-solicitudes/normalizar.mjs scripts/importar-solicitudes/ejemplo-crudo.json --ahora 2026-08-15T18:00:00.000Z --salida /tmp/revisar.csv
```
Expected stdout:
```
✅ 2 filas → /tmp/revisar.csv
   descartadas: 1 no-necesidad, 0 fuera de 14 días
   ⚠️  0 filas con banderas para revisar (columna "revisar")
```

- [ ] **Step 4: Eyeball the CSV**

Run: `cat /tmp/revisar.csv`
Expected: cabecera `revisar,categoria,...`; fila de Leidy con `categoria=salud`, `urgencia=alta`, `municipio_id=17486`, `detalle_ubicacion` sin dirección; la de Elizabeth con `materiales_construccion`, `municipio_id=17873`, `descripcion` sin el número `3001234567`, y `direccion_exacta_privada` con "apto 401".

- [ ] **Step 5: Commit (solo el script; el fixture NO se commitea — lo cubre .gitignore en Task 7)**

```bash
git add scripts/importar-solicitudes/normalizar.mjs
git commit -m "feat: normalizar.mjs — JSON crudo a CSV revisable"
```

---

## Task 6: Entrypoint `cargar.mjs` (CSV revisado → insert)

**Files:**
- Create: `scripts/importar-solicitudes/cargar.mjs`

- [ ] **Step 1: Write the entrypoint**

Create `scripts/importar-solicitudes/cargar.mjs`:

```js
// Carga el CSV revisado a solicitudes_ayuda como sin_verificar/whatsapp.
// Uso: node scripts/importar-solicitudes/cargar.mjs <revisadas.csv> [--dry-run]
// --dry-run: solo valida y cuenta, no conecta a la base.
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { CAMPOS_CARGA, validarFilaCarga } from './mapeo.mjs'
import { deCSV } from './csv.mjs'

config({ path: '.env.local' })

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const entrada = args.find((a) => !a.startsWith('--'))
if (!entrada) { console.error('❌ Falta el CSV. Uso: cargar.mjs <revisadas.csv> [--dry-run]'); process.exit(1) }

const filas = deCSV(readFileSync(entrada, 'utf8'))
const validas = []
let invalidas = 0
for (const [i, fila] of filas.entries()) {
  const v = validarFilaCarga(fila)
  if (!v.ok) { invalidas++; console.warn(`  ⚠️  fila ${i + 2} omitida (${v.errores.join(', ')})`); continue }
  validas.push(fila)
}

if (dryRun) {
  console.log(`🧪 dry-run: ${validas.length} válidas, ${invalidas} inválidas (no se insertó nada)`)
  process.exit(0)
}

const url = process.env.SUPABASE_DB_URL
if (!url) { console.error('❌ Falta SUPABASE_DB_URL en .env.local'); process.exit(1) }

const client = new pg.Client({ connectionString: url })
await client.connect()
let insertadas = 0, duplicadas = 0
try {
  for (const fila of validas) {
    const dup = await client.query(
      'select 1 from solicitudes_ayuda where contacto_telefono = $1 and descripcion = $2 limit 1',
      [fila.contacto_telefono, fila.descripcion],
    )
    if (dup.rowCount) { duplicadas++; continue }
    await client.query(
      `insert into solicitudes_ayuda
         (categoria, urgencia, municipio_id, descripcion, detalle_ubicacion,
          personas_afectadas, contacto_nombre, contacto_telefono, estado, origen)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'sin_verificar','whatsapp')`,
      [
        fila.categoria, fila.urgencia, fila.municipio_id, fila.descripcion,
        fila.detalle_ubicacion || null,
        fila.personas_afectadas ? Number(fila.personas_afectadas) : null,
        fila.contacto_nombre, fila.contacto_telefono,
      ],
    )
    insertadas++
  }
} finally {
  await client.end()
}
console.log(`✅ insertadas: ${insertadas} | duplicadas omitidas: ${duplicadas} | inválidas: ${invalidas}`)
// CAMPOS_CARGA documenta el contrato de columnas; el insert las lista explícitamente.
void CAMPOS_CARGA
```

- [ ] **Step 2: Verify dry-run works offline against the CSV from Task 5**

Run: `node scripts/importar-solicitudes/cargar.mjs /tmp/revisar.csv --dry-run`
Expected: `🧪 dry-run: 2 válidas, 0 inválidas (no se insertó nada)`

- [ ] **Step 3: (Opcional, requiere `.env.local` con `SUPABASE_DB_URL`) Insert real de prueba**

Run: `node scripts/importar-solicitudes/cargar.mjs /tmp/revisar.csv`
Expected: `✅ insertadas: 2 | duplicadas omitidas: 0 | inválidas: 0`. Segunda corrida: `insertadas: 0 | duplicadas omitidas: 2`.
Verificar en la app: aparecen en la cola de moderación con contacto; en `solicitudes_publicas` sin contacto.

- [ ] **Step 4: Commit**

```bash
git add scripts/importar-solicitudes/cargar.mjs
git commit -m "feat: cargar.mjs — inserta CSV revisado como sin_verificar"
```

---

## Task 7: `.gitignore` de artefactos con PII + README

**Files:**
- Modify: `.gitignore`
- Create: `scripts/importar-solicitudes/README.md`

- [ ] **Step 1: Ignorar artefactos con PII**

Append to `.gitignore`:

```
# Import de solicitudes: artefactos con datos personales (no versionar)
scripts/importar-solicitudes/*.json
scripts/importar-solicitudes/*.csv
```

- [ ] **Step 2: Verify the fixture is now ignored**

Run: `git check-ignore scripts/importar-solicitudes/ejemplo-crudo.json`
Expected: imprime la ruta (está ignorada).

- [ ] **Step 3: Write the runbook**

Create `scripts/importar-solicitudes/README.md`:

```markdown
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
```

- [ ] **Step 4: Full test run to confirm nothing regressed**

Run: `npm test`
Expected: toda la suite en verde, incluida `importar-solicitudes.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore scripts/importar-solicitudes/README.md
git commit -m "docs: runbook del import + ignora artefactos con PII"
```

---

## Self-Review

**Spec coverage:**
- Extracción → JSON crudo: README paso 1 + contrato en Task 5 fixture. ✓
- Filtros (🆘, Caldas 19 municipios, ventana 14 días): `esNecesidad`, `mapearMunicipio`, `dentroDeVentana`, `filaParaRevisar` (Tasks 2-4). ✓
- Mapeo de campos (categoría/urgencia/municipio/sector/fecha): Tasks 2-3. ✓
- Privacidad (teléfonos fuera de descripción, sector sin dirección, dirección exacta solo en CSV privado, contacto no público): `limpiarTelefonos`, `sectorDe`, columnas `direccion_exacta_privada` no en `CAMPOS_CARGA` (Task 4); vista pública ya excluye contacto (sin cambios). ✓
- CSV revisable con banderas: `COLUMNAS_CSV` + `filaParaRevisar.revisar` (Task 4) + `normalizar.mjs` (Task 5). ✓
- Carga como sin_verificar/whatsapp + anti-duplicado + validación: `cargar.mjs` + `validarFilaCarga` (Tasks 4, 6). ✓
- Artefactos PII sin versionar: `.gitignore` (Task 7). ✓
- Tests unitarios de todas las funciones puras: Tasks 1-4. ✓

**Placeholder scan:** sin TBD/TODO; todo el código está completo.

**Type consistency:** `filaParaRevisar` emite exactamente las claves de `COLUMNAS_CSV`; `validarFilaCarga` y el insert de `cargar.mjs` usan las claves de `CAMPOS_CARGA` (subconjunto verificado por test en Task 4). Nombres de funciones consistentes entre tasks y tests.

---

## Fuera de alcance (recordatorio del spec)

Sync recurrente, fotos, geocoding, publicar contacto automáticamente, nuevos valores de enum/estado, y municipios de Caldas fuera de los 19 del catálogo.
