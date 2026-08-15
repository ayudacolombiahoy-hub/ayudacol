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
