import { describe, test, expect } from 'vitest'
import { tiempoRelativo, esUuid } from '../../src/lib/formato'

const ahora = new Date('2026-08-14T12:00:00Z')

test('minutos en español', () => {
  const hace5 = new Date('2026-08-14T11:55:00Z')
  expect(tiempoRelativo(hace5, 'es', ahora)).toMatch(/5 min/)
})
test('horas en inglés', () => {
  const hace3h = new Date('2026-08-14T09:00:00Z')
  expect(tiempoRelativo(hace3h, 'en', ahora)).toMatch(/3 hr|3 hours/)
})
test('acepta fecha en texto ISO', () => {
  expect(tiempoRelativo('2026-08-14T11:00:00Z', 'es', ahora)).toMatch(/1 h|1 hora/)
})

describe('esUuid', () => {
  test('acepta un UUID v4 válido', () => {
    expect(esUuid('3f4b2c1a-1111-4222-8333-444455556666')).toBe(true)
  })
  test('rechaza cadenas que no son UUID', () => {
    expect(esUuid('123')).toBe(false)
    expect(esUuid('')).toBe(false)
    expect(esUuid('drop table')).toBe(false)
  })
})
