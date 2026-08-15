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
