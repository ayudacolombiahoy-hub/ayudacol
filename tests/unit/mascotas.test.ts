import { describe, test, expect } from 'vitest'
import { esquemaMascota } from '../../src/lib/validacion/esquemas'

const base = {
  tipo_reporte: 'perdida',
  especie: 'perro',
  descripcion: 'Perro café, mediano, collar rojo, se perdió cerca del río.',
  contacto_nombre: 'Ana',
  contacto_telefono: '+57 300 1234567',
}

describe('esquemaMascota', () => {
  test('acepta un reporte de mascota perdida válido', () => {
    expect(esquemaMascota.safeParse(base).success).toBe(true)
  })

  test('acepta un reporte de mascota encontrada', () => {
    expect(esquemaMascota.safeParse({ ...base, tipo_reporte: 'encontrada', especie: 'gato' }).success).toBe(true)
  })

  test('acepta nombre y municipio vacíos (opcionales)', () => {
    const r = esquemaMascota.safeParse({ ...base, nombre: '', municipio_id: '' })
    expect(r.success).toBe(true)
  })

  test('rechaza tipo_reporte inválido', () => {
    expect(esquemaMascota.safeParse({ ...base, tipo_reporte: 'otro' }).success).toBe(false)
  })

  test('rechaza especie inválida', () => {
    expect(esquemaMascota.safeParse({ ...base, especie: 'dinosaurio' }).success).toBe(false)
  })

  test('rechaza descripción demasiado corta', () => {
    expect(esquemaMascota.safeParse({ ...base, descripcion: 'x' }).success).toBe(false)
  })
})
