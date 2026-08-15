import { describe, it, expect } from 'vitest'
import { aCSV, deCSV } from '../../scripts/importar-solicitudes/csv.mjs'

describe('csv', () => {
  const columnas = ['a', 'b']

  it('escapa comas, comillas y saltos de línea', () => {
    const texto = aCSV([{ a: 'hola, mundo', b: 'dice "hey"\nsalto' }], columnas)
    expect(texto).toBe('a,b\n"hola, mundo","dice ""hey""\nsalto"\n')
  })

  it('round-trip: deCSV(aCSV(x)) devuelve objetos por cabecera', () => {
    const filas = [
      { a: 'x,1', b: 'con "comillas"' },
      { a: 'línea\ndoble', b: '' },
    ]
    expect(deCSV(aCSV(filas, columnas))).toEqual(filas)
  })

  it('deCSV con archivo vacío devuelve []', () => {
    expect(deCSV('')).toEqual([])
  })
})

import {
  esNecesidad, limpiarTelefonos, mapearCategoria, inferirUrgencia,
} from '../../scripts/importar-solicitudes/mapeo.mjs'

describe('mapeo — texto', () => {
  it('esNecesidad filtra por tipo', () => {
    expect(esNecesidad({ tipo: 'necesita' })).toBe(true)
    expect(esNecesidad({ tipo: 'ofrece' })).toBe(false)
    expect(esNecesidad({ tipo: 'mascota' })).toBe(false)
  })

  it('limpiarTelefonos quita teléfonos y conserva el resto', () => {
    expect(limpiarTelefonos('Info 📞 313 625 3353 gracias')).toBe('Info gracias')
    expect(limpiarTelefonos('llamar +57 300 123 4567 hoy')).toBe('llamar hoy')
    expect(limpiarTelefonos('mi cel 3001234567')).toBe('mi cel')
    expect(limpiarTelefonos('familia con 3 habitaciones talla M')).toBe('familia con 3 habitaciones talla M')
  })

  it('mapearCategoria usa palabras clave y cae en otro', () => {
    expect(mapearCategoria('necesito alimentación').categoria).toBe('alimentos')
    expect(mapearCategoria('vivienda en alquiler para evacuar').categoria).toBe('albergue')
    expect(mapearCategoria('material de reconstrucción: cemento y ladrillos').categoria).toBe('materiales_construccion')
    expect(mapearCategoria('remoción de escombros').categoria).toBe('remocion_escombros')
    expect(mapearCategoria('pañales para adulto mayor').categoria).toBe('salud')
    const otro = mapearCategoria('hola buenas tardes')
    expect(otro.categoria).toBe('otro')
    expect(otro.confianza).toBe('baja')
  })

  it('inferirUrgencia sube con palabras de riesgo', () => {
    expect(inferirUrgencia('es urgente, hay peligro')).toBe('alta')
    expect(inferirUrgencia('cuando puedan, gracias')).toBe('media')
  })
})

import {
  mapearMunicipio, sectorDe, parsearFechaEs, dentroDeVentana,
} from '../../scripts/importar-solicitudes/mapeo.mjs'

describe('mapeo — ubicación y fecha', () => {
  it('mapearMunicipio resuelve municipios, alias y villa maría', () => {
    expect(mapearMunicipio('Manizales y alrededores').municipio_id).toBe('17001')
    expect(mapearMunicipio('Pueblo Rico, Neira').municipio_id).toBe('17486')
    expect(mapearMunicipio('Fátima').municipio_id).toBe('17001')
    expect(mapearMunicipio('Villa María, Calle 9A').municipio_id).toBe('17873')
    expect(mapearMunicipio('Bogotá')).toBeNull()
  })

  it('sectorDe elimina dirección exacta y cae al inicio del texto', () => {
    expect(sectorDe('Villa María, Calle 9A # 7-16 apto 401 Edificio Temia')).toBe('Villa María')
    expect(sectorDe('Centro de Manizales')).toBe('Centro de Manizales')
  })

  it('parsearFechaEs entiende el formato del sitio', () => {
    expect(parsearFechaEs('15 de agosto de 2026 a las 1:47 p. m.')).toBe('2026-08-15T18:47:00.000Z')
    expect(parsearFechaEs('texto basura')).toBeNull()
  })

  it('dentroDeVentana respeta el corte de días (con ahora inyectado)', () => {
    const ahora = '2026-08-15T18:00:00.000Z'
    expect(dentroDeVentana('2026-08-14T18:00:00.000Z', 14, ahora)).toBe(true)
    expect(dentroDeVentana('2026-07-01T00:00:00.000Z', 14, ahora)).toBe(false)
    expect(dentroDeVentana(null, 14, ahora)).toBe(false)
  })
})

import {
  filaParaRevisar, validarFilaCarga, COLUMNAS_CSV, CAMPOS_CARGA,
} from '../../scripts/importar-solicitudes/mapeo.mjs'

describe('mapeo — filas', () => {
  const ahoraISO = '2026-08-15T18:00:00.000Z'

  it('filaParaRevisar excluye ofertas y fuera de ventana', () => {
    expect(filaParaRevisar({ tipo: 'ofrece', fecha_texto: '15 de agosto de 2026' }, { ahoraISO }).incluir).toBe(false)
    expect(filaParaRevisar({ tipo: 'necesita', fecha_texto: '1 de enero de 2020' }, { ahoraISO }).incluir).toBe(false)
  })

  it('filaParaRevisar arma la fila, limpia PII y marca banderas', () => {
    const { incluir, fila } = filaParaRevisar({
      tipo: 'necesita',
      nombre: 'Elizabeth Cárdenas',
      descripcion: 'Necesito cemento y ladrillos. 📞 3001234567',
      ubicacion: 'Villa María, Calle 9A # 7-16 apto 401',
      fecha_texto: '14 de agosto de 2026 a las 8:14 p. m.',
      telefono: '57 300 123 4567',
    }, { ahoraISO })
    expect(incluir).toBe(true)
    expect(fila.categoria).toBe('materiales_construccion')
    expect(fila.municipio_id).toBe('17873')
    expect(fila.detalle_ubicacion).toBe('Villa María')
    expect(fila.descripcion).not.toMatch(/3001234567/)
    expect(fila.contacto_telefono).toBe('573001234567')
    expect(fila.direccion_exacta_privada).toContain('apto 401')
    expect(fila.revisar).toBe('')
  })

  it('filaParaRevisar marca municipio_sin_mapear y descripcion_corta', () => {
    const { fila } = filaParaRevisar({
      tipo: 'necesita', nombre: 'X', descripcion: '.', ubicacion: 'Bogotá',
      fecha_texto: '15 de agosto de 2026', telefono: '',
    }, { ahoraISO })
    expect(fila.revisar).toContain('municipio_sin_mapear')
    expect(fila.revisar).toContain('descripcion_corta')
    expect(fila.revisar).toContain('sin_telefono')
  })

  it('validarFilaCarga acepta válidas y rechaza inválidas', () => {
    const buena = {
      categoria: 'salud', urgencia: 'alta', municipio_id: '17001',
      descripcion: 'Pañales para adulto mayor talla M', detalle_ubicacion: 'Fátima',
      personas_afectadas: '', contacto_nombre: 'Ana', contacto_telefono: '573001112233',
    }
    expect(validarFilaCarga(buena)).toEqual({ ok: true })
    expect(validarFilaCarga({ ...buena, descripcion: 'corta' }).ok).toBe(false)
    expect(validarFilaCarga({ ...buena, municipio_id: '' }).ok).toBe(false)
    expect(validarFilaCarga({ ...buena, categoria: 'inexistente' }).ok).toBe(false)
  })

  it('CAMPOS_CARGA son un subconjunto de COLUMNAS_CSV', () => {
    expect(CAMPOS_CARGA.every((c) => COLUMNAS_CSV.includes(c))).toBe(true)
  })
})
