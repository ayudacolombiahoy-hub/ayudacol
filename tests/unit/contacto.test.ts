import { describe, it, expect } from 'vitest'
import { clasificarContacto, hrefContacto } from '@/lib/contacto'

describe('clasificarContacto', () => {
  it('teléfono con separadores', () => {
    expect(clasificarContacto('+57 300-123-4567')).toBe('telefono')
  })
  it('@usuario de Instagram', () => {
    expect(clasificarContacto('@ayuda_manizales')).toBe('instagram')
  })
  it('URL de Instagram', () => {
    expect(clasificarContacto('https://instagram.com/ayuda')).toBe('instagram')
    expect(clasificarContacto('instagram.com/ayuda')).toBe('instagram')
  })
  it('URL de Facebook', () => {
    expect(clasificarContacto('https://facebook.com/ayuda')).toBe('facebook')
  })
  it('otro enlace', () => {
    expect(clasificarContacto('https://ejemplo.org/contacto')).toBe('link')
  })
  it('vacío o nulo cae a link', () => {
    expect(clasificarContacto('')).toBe('link')
    expect(clasificarContacto(null)).toBe('link')
  })
})

describe('hrefContacto', () => {
  it('@usuario → perfil de Instagram', () => {
    expect(hrefContacto('@ayuda')).toBe('https://instagram.com/ayuda')
  })
  it('dominio sin esquema → https', () => {
    expect(hrefContacto('facebook.com/ayuda')).toBe('https://facebook.com/ayuda')
  })
  it('URL con esquema se respeta', () => {
    expect(hrefContacto('https://instagram.com/ayuda')).toBe('https://instagram.com/ayuda')
  })
})
