import { describe, test, expect } from 'vitest'
import { decidirAccionOrg } from '../../src/lib/datos/org'

describe('decidirAccionOrg', () => {
  test('tomar una verificada → en_atencion', () => {
    expect(decidirAccionOrg('verificada', 'tomar')).toEqual({ ok: true, hacia: 'en_atencion' })
  })
  test('resolver una en_atencion → resuelta', () => {
    expect(decidirAccionOrg('en_atencion', 'resolver')).toEqual({ ok: true, hacia: 'resuelta' })
  })
  test('liberar una en_atencion → verificada', () => {
    expect(decidirAccionOrg('en_atencion', 'liberar')).toEqual({ ok: true, hacia: 'verificada' })
  })
  test('no se puede tomar algo ya resuelto', () => {
    expect(decidirAccionOrg('resuelta', 'tomar').ok).toBe(false)
  })
  test('no se puede resolver una que aún no se ha tomado', () => {
    expect(decidirAccionOrg('verificada', 'resolver').ok).toBe(false)
  })
})
