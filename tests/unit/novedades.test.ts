import { describe, test, expect } from 'vitest'
import { esquemaNovedad } from '../../src/lib/validacion/esquemas'
import { fotosDe } from '../../src/lib/datos/fotos'

const base = {
  titulo_es: 'Subsidio de arrendamiento',
  titulo_en: 'Rent subsidy',
  contenido_es: 'Auxilio para damnificados del terremoto del 10 de agosto.',
  contenido_en: 'Aid for people affected by the August 10 earthquake.',
}

describe('esquemaNovedad', () => {
  test('acepta una novedad válida sin enlace', () => {
    expect(esquemaNovedad.safeParse(base).success).toBe(true)
  })

  test('acepta enlace y textos vacíos (opcionales)', () => {
    const r = esquemaNovedad.safeParse({ ...base, enlace: '', enlace_texto_es: '', enlace_texto_en: '' })
    expect(r.success).toBe(true)
  })

  test('acepta un enlace válido con texto de botón', () => {
    const r = esquemaNovedad.safeParse({ ...base, enlace: 'https://mizl.gov.co/turno', enlace_texto_es: 'Agenda tu turno', enlace_texto_en: 'Book your slot' })
    expect(r.success).toBe(true)
  })

  test('rechaza un enlace que no es URL', () => {
    expect(esquemaNovedad.safeParse({ ...base, enlace: 'no-soy-url' }).success).toBe(false)
  })

  test('rechaza texto de botón demasiado largo (>60)', () => {
    expect(esquemaNovedad.safeParse({ ...base, enlace_texto_es: 'x'.repeat(61) }).success).toBe(false)
  })

  test('rechaza un enlace con esquema peligroso (javascript:)', () => {
    expect(esquemaNovedad.safeParse({ ...base, enlace: 'javascript:alert(1)' }).success).toBe(false)
  })
})

describe('fotosDe', () => {
  test('devuelve el arreglo de URLs http(s) válidas', () => {
    expect(fotosDe({ fotos: ['https://x.co/a.jpg', 'http://x.co/b.png'] })).toEqual([
      'https://x.co/a.jpg', 'http://x.co/b.png',
    ])
  })

  test('acepta un valor suelto (no arreglo)', () => {
    expect(fotosDe({ fotos: 'https://x.co/a.jpg' })).toEqual(['https://x.co/a.jpg'])
  })

  test('descarta cadenas que no son URL http(s)', () => {
    expect(fotosDe({ fotos: ['no-url', '', 'https://x.co/ok.jpg'] })).toEqual(['https://x.co/ok.jpg'])
  })

  test('devuelve [] cuando no hay fotos', () => {
    expect(fotosDe({})).toEqual([])
    expect(fotosDe(null)).toEqual([])
  })
})
