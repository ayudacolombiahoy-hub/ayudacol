import { describe, test, expect } from 'vitest'
import { esquemaAcopioPublico } from '../../src/lib/validacion/esquemas'

const base = {
  nombre: 'Parroquia San José',
  direccion: 'Cra 5 # 10-20',
  municipio_id: '27001',
  contacto_publico: '+57 300 1234567',
  recibe: 'agua, alimentos',
  no_necesita: 'ropa usada',
}

describe('esquemaAcopioPublico', () => {
  test('acepta una propuesta válida y parsea las listas', () => {
    const r = esquemaAcopioPublico.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.recibe).toEqual(['agua', 'alimentos'])
      expect(r.data.no_necesita).toEqual(['ropa usada'])
    }
  })

  test('rechaza sin contacto_publico (requerido en propuestas públicas)', () => {
    const { contacto_publico, ...sinContacto } = base
    expect(esquemaAcopioPublico.safeParse(sinContacto).success).toBe(false)
  })

  test('rechaza dirección faltante', () => {
    expect(esquemaAcopioPublico.safeParse({ ...base, direccion: '' }).success).toBe(false)
  })

  test('rechaza municipio faltante', () => {
    expect(esquemaAcopioPublico.safeParse({ ...base, municipio_id: '' }).success).toBe(false)
  })
})
