import { describe, test, expect } from 'vitest'
import { contarPor } from '../../src/lib/datos/estadisticas'

describe('contarPor', () => {
  test('cuenta ocurrencias por clave y ordena de mayor a menor', () => {
    const items = [
      { categoria: 'agua' },
      { categoria: 'alimentos' },
      { categoria: 'agua' },
      { categoria: 'salud' },
      { categoria: 'agua' },
      { categoria: 'alimentos' },
    ]
    expect(contarPor(items, 'categoria')).toEqual([
      { valor: 'agua', n: 3 },
      { valor: 'alimentos', n: 2 },
      { valor: 'salud', n: 1 },
    ])
  })

  test('funciona con cualquier clave, por ejemplo estado', () => {
    const items = [
      { estado: 'verificada' },
      { estado: 'resuelta' },
      { estado: 'verificada' },
    ]
    expect(contarPor(items, 'estado')).toEqual([
      { valor: 'verificada', n: 2 },
      { valor: 'resuelta', n: 1 },
    ])
  })

  test('un solo valor con el mismo conteo se mantiene único en el resultado', () => {
    const items = [{ x: 'a' }, { x: 'a' }, { x: 'a' }]
    expect(contarPor(items, 'x')).toEqual([{ valor: 'a', n: 3 }])
  })

  test('arreglo vacío devuelve arreglo vacío', () => {
    const vacio: { categoria: string }[] = []
    expect(contarPor(vacio, 'categoria')).toEqual([])
  })
})
