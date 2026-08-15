import { describe, test, expect } from 'vitest'
import {
  esquemaNecesidad,
  esquemaVoluntario,
  esquemaServicio,
  erroresPorCampo,
} from '../../src/lib/validacion/esquemas'

describe('esquemaNecesidad', () => {
  const base = {
    categoria: 'agua',
    descripcion: 'Familia sin agua potable en la vereda hace tres días',
    urgencia: 'alta',
    municipio_id: '27001',
    contacto_nombre: 'María',
    contacto_telefono: '+57 300 1234567',
  }
  test('acepta un reporte válido', () => {
    expect(esquemaNecesidad.safeParse(base).success).toBe(true)
  })
  test('rechaza descripción demasiado corta', () => {
    const r = esquemaNecesidad.safeParse({ ...base, descripcion: 'corto' })
    expect(r.success).toBe(false)
  })
  test('rechaza categoría inválida', () => {
    const r = esquemaNecesidad.safeParse({ ...base, categoria: 'zzz' })
    expect(r.success).toBe(false)
  })
  test('convierte personas_afectadas de texto a número', () => {
    const r = esquemaNecesidad.safeParse({ ...base, personas_afectadas: '4' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.personas_afectadas).toBe(4)
  })
})

describe('esquemaVoluntario', () => {
  test('exige al menos una habilidad', () => {
    const r = esquemaVoluntario.safeParse({
      nombre: 'Juan', habilidades: [], municipio_id: '17001', contacto_telefono: '3001234567',
    })
    expect(r.success).toBe(false)
  })
})

describe('esquemaServicio', () => {
  test('acepta un servicio válido', () => {
    const r = esquemaServicio.safeParse({
      tipo: 'alojamiento',
      descripcion: 'Tengo dos habitaciones disponibles para familias',
      municipio_id: '66001',
      contacto_nombre: 'Ana',
      contacto_telefono: '3009876543',
    })
    expect(r.success).toBe(true)
  })
})

describe('erroresPorCampo', () => {
  test('agrupa los mensajes por nombre de campo', () => {
    const r = esquemaNecesidad.safeParse({ categoria: 'agua', descripcion: 'x' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const errs = erroresPorCampo(r.error)
      expect(Object.keys(errs)).toContain('descripcion')
      expect(Object.keys(errs)).toContain('municipio_id')
    }
  })
})

import { esquemaAcopio, esquemaOrganizacion } from '../../src/lib/validacion/esquemas'

describe('esquemaAcopio', () => {
  test('acepta un acopio válido', () => {
    const r = esquemaAcopio.safeParse({
      nombre: 'Acopio Central',
      direccion: 'Calle 10 # 5-20',
      municipio_id: '17001',
      horarios: '8am-6pm',
      recibe: ['agua', 'alimentos'],
      no_necesita: ['ropa'],
    })
    expect(r.success).toBe(true)
  })
  test('rechaza acopio sin dirección', () => {
    expect(esquemaAcopio.safeParse({ nombre: 'X', municipio_id: '17001' }).success).toBe(false)
  })
})

describe('esquemaOrganizacion', () => {
  test('acepta una organización válida', () => {
    const r = esquemaOrganizacion.safeParse({ nombre: 'Cruz Roja Caldas', tipo: 'ong' })
    expect(r.success).toBe(true)
  })
})

import { esquemaAlbergue, ESTADOS_ALBERGUE } from '../../src/lib/validacion/esquemas'

describe('esquemaAlbergue', () => {
  test('acepta un albergue válido y convierte capacidad a número', () => {
    const r = esquemaAlbergue.safeParse({
      nombre: 'Coliseo Municipal',
      direccion: 'Cra 5 # 10-20',
      municipio_id: '17001',
      capacidad: '100',
      contacto_publico: '3001234567',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.capacidad).toBe(100)
  })
  test('acepta un albergue sin capacidad ni ocupación (opcionales)', () => {
    const r = esquemaAlbergue.safeParse({
      nombre: 'Coliseo Municipal', direccion: 'Cra 5 # 10-20', municipio_id: '17001',
    })
    expect(r.success).toBe(true)
  })
  test('rechaza albergue sin dirección', () => {
    expect(esquemaAlbergue.safeParse({ nombre: 'X', municipio_id: '17001' }).success).toBe(false)
  })
  test('rechaza capacidad negativa', () => {
    const r = esquemaAlbergue.safeParse({
      nombre: 'Coliseo', direccion: 'Cra 5', municipio_id: '17001', capacidad: -1,
    })
    expect(r.success).toBe(false)
  })
  test('rechaza un estado fuera del enum', () => {
    const r = esquemaAlbergue.safeParse({
      nombre: 'Coliseo', direccion: 'Cra 5', municipio_id: '17001', estado: 'a_reventar',
    })
    expect(r.success).toBe(false)
  })
  test('ESTADOS_ALBERGUE contiene los tres estados esperados', () => {
    expect(ESTADOS_ALBERGUE).toEqual(['abierto', 'lleno', 'cerrado'])
  })
})

import { esquemaDesaparecido, ESTADOS_PERSONA } from '../../src/lib/validacion/esquemas'

describe('esquemaDesaparecido', () => {
  const base = {
    nombre: 'Carlos Ramírez',
    descripcion: 'Visto por última vez cerca del mercado central el jueves',
    contacto_nombre: 'Ana Ramírez',
    contacto_telefono: '3001234567',
  }
  test('acepta un reporte válido sin edad ni municipio', () => {
    expect(esquemaDesaparecido.safeParse(base).success).toBe(true)
  })
  test('convierte edad de texto a número', () => {
    const r = esquemaDesaparecido.safeParse({ ...base, edad: '34' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.edad).toBe(34)
  })
  test('rechaza edad fuera de rango', () => {
    expect(esquemaDesaparecido.safeParse({ ...base, edad: 130 }).success).toBe(false)
  })
  test('rechaza descripción demasiado corta', () => {
    expect(esquemaDesaparecido.safeParse({ ...base, descripcion: 'x' }).success).toBe(false)
  })
  test('rechaza nombre demasiado corto', () => {
    expect(esquemaDesaparecido.safeParse({ ...base, nombre: 'A' }).success).toBe(false)
  })
  test('acepta municipio_id vacío (opcional)', () => {
    const r = esquemaDesaparecido.safeParse({ ...base, municipio_id: '' })
    expect(r.success).toBe(true)
  })
  test('ESTADOS_PERSONA contiene los tres estados esperados', () => {
    expect(ESTADOS_PERSONA).toEqual(['buscando', 'encontrada', 'cerrado'])
  })
})
