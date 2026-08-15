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
