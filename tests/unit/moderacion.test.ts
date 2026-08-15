import { describe, test, expect } from 'vitest'
import { decidirAccion } from '../../src/lib/datos/moderacion'

describe('decidirAccion (moderador)', () => {
  test('verificar un sin_verificar es válido', () => {
    expect(decidirAccion('sin_verificar', 'verificar')).toEqual({ ok: true, hacia: 'verificada' })
  })
  test('rechazar un sin_verificar es válido', () => {
    expect(decidirAccion('sin_verificar', 'rechazar')).toEqual({ ok: true, hacia: 'rechazada' })
  })
  test('duplicar un sin_verificar es válido', () => {
    expect(decidirAccion('sin_verificar', 'duplicar')).toEqual({ ok: true, hacia: 'duplicada' })
  })
  test('verificar un por_reconfirmar es válido', () => {
    expect(decidirAccion('por_reconfirmar', 'verificar')).toEqual({ ok: true, hacia: 'verificada' })
  })
  test('verificar algo ya resuelto es inválido', () => {
    expect(decidirAccion('resuelta', 'verificar').ok).toBe(false)
  })
})
