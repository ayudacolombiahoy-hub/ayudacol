// Genera src/componentes/visualizador/colombia-paths.ts desde el SVG de Vemaps.
// Los índices afectados provienen de la calibración del spec §7:
// Chocó=2, Valle=13, Caldas=25, Quindío=31, Risaralda=33.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const svg = readFileSync('recursos/vemaps/co-07.svg', 'utf8')
const col = svg.match(/<g id="Colombia">([\s\S]*?)<\/g>/)
if (!col) { console.error('No se encontró <g id="Colombia">'); process.exit(1) }
const paths = [...col[1].matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
if (paths.length !== 34) { console.error(`Esperaba 34 paths, hay ${paths.length}`); process.exit(1) }

const AFECTADOS = new Set([2, 13, 25, 31, 33])
const filas = paths.map((d, i) => `  { d: ${JSON.stringify(d)}, afectado: ${AFECTADOS.has(i)} },`)
mkdirSync('src/componentes/visualizador', { recursive: true })
writeFileSync(
  'src/componentes/visualizador/colombia-paths.ts',
  `// Generado por scripts/gen-colombia-paths.mjs desde recursos/vemaps/co-07.svg (© Vemaps.com).\n` +
  `// No editar a mano; re-generar con: node scripts/gen-colombia-paths.mjs\n` +
  `export type PathDepto = { d: string; afectado: boolean }\n` +
  `export const PATHS_COLOMBIA: PathDepto[] = [\n${filas.join('\n')}\n]\n`,
)
console.log(`OK: ${paths.length} paths escritos`)
