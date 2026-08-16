import { describe, it, expect } from 'vitest'
import {
  limpiarTelefonos, mapearCategoria, inferirUrgencia, mapearMunicipio, sectorDe,
} from '@/lib/importacion/mapeo'

describe('limpiarTelefonos', () => {
  it('quita teléfonos colombianos y el ícono', () => {
    expect(limpiarTelefonos('Necesito cemento 📞 300 123 4567')).toBe('Necesito cemento')
  })
  it('devuelve string vacío para entrada vacía', () => {
    expect(limpiarTelefonos('')).toBe('')
  })
})

describe('mapearCategoria', () => {
  it('detecta materiales de construcción', () => {
    expect(mapearCategoria('Necesito cemento y ladrillos').categoria).toBe('materiales_construccion')
  })
  it('cae a otro con confianza baja cuando no reconoce', () => {
    const r = mapearCategoria('algo sin palabras clave')
    expect(r.categoria).toBe('otro')
    expect(r.confianza).toBe('baja')
  })
})

describe('inferirUrgencia', () => {
  it('marca alta si el texto lo sugiere', () => {
    expect(inferirUrgencia('esto es urgente')).toBe('alta')
  })
  it('media por defecto', () => {
    expect(inferirUrgencia('pañales talla M')).toBe('media')
  })
})

describe('mapearMunicipio', () => {
  it('resuelve un barrio conocido al municipio contenedor', () => {
    expect(mapearMunicipio('La Enea')?.municipio_id).toBe('17001')
  })
  it('resuelve "Pueblo Rico, Neira" a Neira', () => {
    expect(mapearMunicipio('Pueblo Rico, Neira')?.municipio_id).toBe('17486')
  })
  it('devuelve null si no mapea', () => {
    expect(mapearMunicipio('Ciudad Inventada')).toBeNull()
  })
})

describe('sectorDe', () => {
  it('corta la dirección exacta y deja el sector', () => {
    expect(sectorDe('Villa María, Calle 9A # 7-16 apto 401')).toBe('Villa María')
  })
})
