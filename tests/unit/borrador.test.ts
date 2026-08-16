import { describe, it, expect } from 'vitest'
import { normalizarBorradores, type BorradorCrudo } from '@/lib/ia/borrador'

const crudo = (over: Partial<BorradorCrudo>): BorradorCrudo => ({
  tipo: 'necesidad', descripcion: 'Texto de prueba largo', ubicacion_texto: 'La Enea',
  confianza: 'alta', contacto: null, contacto_nombre: null, contacto_publico: null,
  categoria: null, urgencia: null, personas_afectadas: null,
  especie: null, tipo_reporte: null, nombre_mascota: null,
  nombre_persona: null, edad: null,
  nombre_lugar: null, direccion: null, recibe: null, no_necesita: null, horarios: null, capacidad: null,
  ...over,
})

const base: BorradorCrudo = crudo({
  categoria: 'materiales_construccion', urgencia: 'alta',
  personas_afectadas: 4, descripcion: 'Necesito cemento y arena 📞 300 123 4567',
  ubicacion_texto: 'La Enea, Calle 9 # 7-16', contacto_nombre: 'Ana',
  contacto: '3001234567', confianza: 'alta',
})

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

  it('deja solo dígitos cuando el contacto es teléfono', () => {
    const { borradores } = normalizarBorradores([{ ...base, contacto: '+57 300-123-4567' }])
    expect(borradores[0].contacto_telefono).toBe('573001234567')
  })

  it('conserva un @ de Instagram como contacto (no lo destroza)', () => {
    const { borradores } = normalizarBorradores([{ ...base, contacto: '@ayuda_manizales' }])
    expect(borradores[0].contacto_telefono).toBe('@ayuda_manizales')
    expect(borradores[0].banderas).not.toContain('sin_contacto')
  })
})

describe('normalizarBorradores — tipos Fase 2', () => {
  const crudo = (over: Partial<BorradorCrudo>): BorradorCrudo => ({
    tipo: 'necesidad', descripcion: 'Texto de prueba largo', ubicacion_texto: 'La Enea',
    confianza: 'alta', contacto: null, contacto_nombre: null, contacto_publico: null,
    categoria: null, urgencia: null, personas_afectadas: null,
    especie: null, tipo_reporte: null, nombre_mascota: null,
    nombre_persona: null, edad: null,
    nombre_lugar: null, direccion: null, recibe: null, no_necesita: null, horarios: null, capacidad: null,
    ...over,
  })

  it('mascota: mapea especie/tipo_reporte y nombre desde nombre_mascota', () => {
    const { borradores } = normalizarBorradores([crudo({ tipo: 'mascota', especie: 'perro', tipo_reporte: 'perdida', nombre_mascota: 'Firulais', contacto: '3001234567', contacto_nombre: 'Ana' })])
    const b = borradores[0]
    expect(b.tipo).toBe('mascota')
    expect(b.especie).toBe('perro')
    expect(b.tipo_reporte).toBe('perdida')
    expect(b.nombre).toBe('Firulais')
    expect(b.municipio_id).toBe('17001')
  })

  it('mascota: especie fuera de catálogo cae a otro; tipo_reporte inválido cae a perdida', () => {
    const { borradores } = normalizarBorradores([crudo({ tipo: 'mascota', especie: 'dragon' as never, tipo_reporte: 'x' as never })])
    expect(borradores[0].especie).toBe('otro')
    expect(borradores[0].tipo_reporte).toBe('perdida')
  })

  it('desaparecido: nombre desde nombre_persona y edad numérica', () => {
    const { borradores } = normalizarBorradores([crudo({ tipo: 'desaparecido', nombre_persona: 'Juan Pérez', edad: 30, contacto: '3001234567', contacto_nombre: 'María' })])
    expect(borradores[0].nombre).toBe('Juan Pérez')
    expect(borradores[0].edad).toBe(30)
  })

  it('acopio: nombre desde nombre_lugar, direccion y contacto_publico', () => {
    const { borradores } = normalizarBorradores([crudo({ tipo: 'acopio', nombre_lugar: 'Parroquia', direccion: 'Calle 5 # 3-2', contacto_publico: '3001234567', recibe: 'agua, comida' })])
    expect(borradores[0].nombre).toBe('Parroquia')
    expect(borradores[0].direccion).toBe('Calle 5 # 3-2')
    expect(borradores[0].contacto_publico).toBe('3001234567')
    expect(borradores[0].recibe).toBe('agua, comida')
  })

  it('descarta desconocido', () => {
    const r = normalizarBorradores([crudo({ tipo: 'desconocido' as never })])
    expect(r.borradores).toHaveLength(0)
    expect(r.descartados).toBe(1)
  })
})
