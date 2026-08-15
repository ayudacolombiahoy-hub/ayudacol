import { describe, it, expect } from 'vitest'
import { primeraImagen, mapearCaso } from '../../scripts/casos-aliados/mapeo.mjs'

const itemBase = {
  case_id: 'MI-T-ArjJAJB',
  estado: 'ACTIVO',
  prioridad: 'ALTA',
  titulo: 'Familia en Arauca (Palestina) necesita materiales',
  resumen_corto: 'El terremoto dejó la vivienda con grietas.',
  municipio: 'Palestina',
  sector: 'Arauca',
  grupos_objetivo: 'ADULTOS|NINOS_ADOLESCENTES',
  tipos_necesidad: 'CONSTRUCCION_REPARACIONES',
  necesidades_detalle: 'Materiales',
  descripcion_publica: 'Desde el terremoto…',
  como_ayudar: 'Usa el botón…',
  contacto_publico: 'Juan Pérez',
  telefono_publico: '3001234567',
  breb_llave: '3225158917',
  breb_entidad: '',
  fecha_verificacion: '2026-08-15T20:19:18.618Z',
  finalizado: false,
  orden: 100,
  imagen_1_url: '',
  imagen_2_url: 'https://mimanizales.info/wp-content/uploads/2026/08/b.jpg',
  imagen_3_url: 'https://mimanizales.info/wp-content/uploads/2026/08/c.jpg',
}

describe('casos-aliados mapeo', () => {
  it('primeraImagen devuelve la primera url no vacía', () => {
    expect(primeraImagen(itemBase)).toBe('https://mimanizales.info/wp-content/uploads/2026/08/b.jpg')
    expect(primeraImagen({ imagen_1_url: '', imagen_2_url: '' })).toBe('')
  })

  it('mapearCaso arma url_origen, imagen_url y campos públicos', () => {
    const r = mapearCaso(itemBase)
    expect(r.case_id).toBe('MI-T-ArjJAJB')
    expect(r.url_origen).toBe('https://mimanizales.info/caso/?id=MI-T-ArjJAJB')
    expect(r.imagen_url).toBe('https://mimanizales.info/wp-content/uploads/2026/08/b.jpg')
    expect(r.municipio).toBe('Palestina')
    expect(r.tipos_necesidad).toBe('CONSTRUCCION_REPARACIONES')
    expect(r.orden).toBe(100)
    expect(r.finalizado).toBe(false)
  })

  it('mapearCaso NO copia contacto ni datos de pago (garantía de privacidad)', () => {
    const claves = Object.keys(mapearCaso(itemBase))
    for (const prohibida of ['contacto_publico', 'telefono_publico', 'breb_llave', 'breb_entidad', 'descripcion_publica', 'como_ayudar']) {
      expect(claves).not.toContain(prohibida)
    }
  })
})
