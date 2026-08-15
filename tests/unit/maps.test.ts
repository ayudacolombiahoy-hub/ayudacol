import { describe, test, expect } from 'vitest'
import { enlacesMaps } from '../../src/lib/geo/maps'

const q = (url: string) => decodeURIComponent(url.split('query=')[1] ?? url.split('destination=')[1])

describe('enlacesMaps', () => {
  test('usa lat,lng cuando ambos son finitos', () => {
    const { ver, comoLlegar } = enlacesMaps({ direccion: 'Calle 1', lat: 6.1, lng: -75.9 })
    expect(ver).toBe('https://www.google.com/maps/search/?api=1&query=6.1%2C-75.9')
    expect(comoLlegar).toBe('https://www.google.com/maps/dir/?api=1&destination=6.1%2C-75.9')
  })

  test('cae a dirección + municipio + Colombia sin coordenadas', () => {
    const { ver } = enlacesMaps({ direccion: 'Cra 50 #10-20', municipioTexto: 'Salgar — Antioquia' })
    expect(q(ver)).toBe('Cra 50 #10-20, Salgar — Antioquia, Colombia')
  })

  test('omite municipio vacío sin dejar comas colgando', () => {
    const { ver } = enlacesMaps({ direccion: 'Cra 50' })
    expect(q(ver)).toBe('Cra 50, Colombia')
  })

  test('ignora lat/lng no finitos y usa la dirección', () => {
    const { ver } = enlacesMaps({ direccion: 'Cra 50', lat: NaN, lng: -75 })
    expect(q(ver)).toBe('Cra 50, Colombia')
  })

  test('genera los dos endpoints con ?api=1', () => {
    const { ver, comoLlegar } = enlacesMaps({ direccion: 'X' })
    expect(ver.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true)
    expect(comoLlegar.startsWith('https://www.google.com/maps/dir/?api=1&destination=')).toBe(true)
  })
})
