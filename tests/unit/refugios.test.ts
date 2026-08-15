import { describe, test, expect } from 'vitest'
import { esquemaRefugio } from '../../src/lib/validacion/esquemas'

const base = {
  nombre: 'Refugio Patitas',
  direccion: 'Calle 10 # 5-20',
  municipio_id: '17001',
}

describe('esquemaRefugio', () => {
  test('acepta un refugio válido mínimo', () => {
    expect(esquemaRefugio.safeParse(base).success).toBe(true)
  })

  test('acepta capacidad, especies y contacto opcionales', () => {
    const r = esquemaRefugio.safeParse({
      ...base, capacidad: '30', especies: 'perros y gatos', contacto_publico: '3001234567',
    })
    expect(r.success).toBe(true)
  })

  test('rechaza nombre demasiado corto', () => {
    expect(esquemaRefugio.safeParse({ ...base, nombre: 'x' }).success).toBe(false)
  })

  test('rechaza municipio vacío', () => {
    expect(esquemaRefugio.safeParse({ ...base, municipio_id: '' }).success).toBe(false)
  })

  test('rechaza estado inválido', () => {
    expect(esquemaRefugio.safeParse({ ...base, estado: 'quemado' }).success).toBe(false)
  })
})
