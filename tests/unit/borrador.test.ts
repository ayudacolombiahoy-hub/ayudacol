import { describe, it, expect } from 'vitest'
import { normalizarBorradores, type BorradorCrudo } from '@/lib/ia/borrador'

const base: BorradorCrudo = {
  tipo: 'necesidad', categoria: 'materiales_construccion', urgencia: 'alta',
  personas_afectadas: 4, descripcion: 'Necesito cemento y arena 📞 300 123 4567',
  ubicacion_texto: 'La Enea, Calle 9 # 7-16', contacto_nombre: 'Ana',
  contacto_telefono: '3001234567', confianza: 'alta',
}

describe('normalizarBorradores', () => {
  it('descarta los que no son necesidad y cuenta cuántos', () => {
    const r = normalizarBorradores([base, { ...base, tipo: 'desconocido' }])
    expect(r.borradores).toHaveLength(1)
    expect(r.descartados).toBe(1)
  })

  it('limpia el teléfono del texto de descripción', () => {
    const { borradores } = normalizarBorradores([base])
    expect(borradores[0].descripcion).not.toMatch(/\d{3}/)
    expect(borradores[0].descripcion).toContain('cemento')
  })

  it('propone municipio_id desde la ubicación', () => {
    const { borradores } = normalizarBorradores([base])
    expect(borradores[0].municipio_id).toBe('17001')
  })

  it('marca municipio_sin_mapear cuando no reconoce', () => {
    const { borradores } = normalizarBorradores([{ ...base, ubicacion_texto: 'Ciudad Inventada' }])
    expect(borradores[0].municipio_id).toBe('')
    expect(borradores[0].banderas).toContain('municipio_sin_mapear')
  })

  it('snapea categoría/urgencia fuera de catálogo a valores seguros', () => {
    const { borradores } = normalizarBorradores([
      { ...base, categoria: 'inventada' as never, urgencia: 'x' as never },
    ])
    expect(borradores[0].categoria).toBe('otro')
    expect(borradores[0].urgencia).toBe('media')
  })

  it('deja solo dígitos en el teléfono de contacto', () => {
    const { borradores } = normalizarBorradores([{ ...base, contacto_telefono: '+57 300-123-4567' }])
    expect(borradores[0].contacto_telefono).toBe('573001234567')
  })
})
