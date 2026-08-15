import { describe, test, expect } from 'vitest'
import {
  puedeTransicionar,
  type EstadoSolicitud,
  type RolTransicion,
} from '../../src/lib/estados'

describe('transiciones válidas', () => {
  test('moderador verifica un reporte nuevo', () => {
    expect(puedeTransicionar('sin_verificar', 'verificada', 'moderador')).toBe(true)
  })
  test('moderador rechaza o marca duplicado', () => {
    expect(puedeTransicionar('sin_verificar', 'rechazada', 'moderador')).toBe(true)
    expect(puedeTransicionar('sin_verificar', 'duplicada', 'moderador')).toBe(true)
  })
  test('moderador reconfirma una caducada', () => {
    expect(puedeTransicionar('por_reconfirmar', 'verificada', 'moderador')).toBe(true)
  })
  test('organización toma una verificada y la resuelve o la suelta', () => {
    expect(puedeTransicionar('verificada', 'en_atencion', 'org')).toBe(true)
    expect(puedeTransicionar('en_atencion', 'resuelta', 'org')).toBe(true)
    expect(puedeTransicionar('en_atencion', 'verificada', 'org')).toBe(true)
  })
  test('el sistema caduca a las 72h sin actualización', () => {
    expect(puedeTransicionar('verificada', 'por_reconfirmar', 'sistema')).toBe(true)
    expect(puedeTransicionar('en_atencion', 'por_reconfirmar', 'sistema')).toBe(true)
  })
  test('admin puede todo lo del moderador y de la org', () => {
    expect(puedeTransicionar('sin_verificar', 'verificada', 'admin')).toBe(true)
    expect(puedeTransicionar('verificada', 'en_atencion', 'admin')).toBe(true)
    expect(puedeTransicionar('en_atencion', 'resuelta', 'admin')).toBe(true)
  })
})

describe('transiciones prohibidas', () => {
  test('el público no cambia estados', () => {
    expect(puedeTransicionar('sin_verificar', 'verificada', 'publico')).toBe(false)
  })
  test('una org no verifica reportes', () => {
    expect(puedeTransicionar('sin_verificar', 'verificada', 'org')).toBe(false)
  })
  test('resuelta es terminal para todos los roles', () => {
    const roles: RolTransicion[] = ['publico', 'sistema', 'moderador', 'org', 'admin']
    const estados: EstadoSolicitud[] = [
      'sin_verificar', 'verificada', 'en_atencion', 'resuelta',
      'rechazada', 'duplicada', 'por_reconfirmar',
    ]
    for (const rol of roles) {
      for (const destino of estados) {
        expect(puedeTransicionar('resuelta', destino, rol)).toBe(false)
      }
    }
  })
  test('nadie salta de sin_verificar directo a resuelta', () => {
    const roles: RolTransicion[] = ['publico', 'sistema', 'moderador', 'org', 'admin']
    for (const rol of roles) {
      expect(puedeTransicionar('sin_verificar', 'resuelta', rol)).toBe(false)
    }
  })
})
