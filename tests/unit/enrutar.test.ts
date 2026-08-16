import { describe, it, expect } from 'vitest'
import { armarEntrada } from '@/lib/ia/enrutar'
import type { Borrador } from '@/lib/ia/borrador'
import { esquemaMascota, esquemaDesaparecido, esquemaAcopioPublico, esquemaAlbergue, esquemaNecesidad } from '@/lib/validacion/esquemas'

const base: Borrador = {
  tipo: 'necesidad', descripcion: 'Necesitamos agua potable urgente', municipio_id: '17001',
  municipio_nombre: 'Manizales', detalle_ubicacion: 'La Enea', confianza: 'alta', banderas: [],
  contacto_telefono: '3001234567', contacto_nombre: 'Ana', contacto_publico: '',
  categoria: 'agua', urgencia: 'alta', personas_afectadas: 4,
  especie: 'perro', tipo_reporte: 'perdida', nombre: '', edad: null,
  direccion: 'Calle 5 # 3-2', recibe: 'agua, comida', no_necesita: '', horarios: '8am-5pm', capacidad: 20,
}

describe('armarEntrada', () => {
  it('necesidad → pasa esquemaNecesidad', () => {
    expect(esquemaNecesidad.safeParse(armarEntrada({ ...base, tipo: 'necesidad' })).success).toBe(true)
  })
  it('mascota → pasa esquemaMascota (con nombre y foto_url aparte)', () => {
    const e = armarEntrada({ ...base, tipo: 'mascota', nombre: 'Firulais', foto_url: 'https://x/y.jpg' }) as Record<string, unknown>
    expect(esquemaMascota.safeParse(e).success).toBe(true)
    expect(e.foto_url).toBe('https://x/y.jpg')
    expect(e.tipo_reporte).toBe('perdida')
  })
  it('desaparecido → pasa esquemaDesaparecido', () => {
    expect(esquemaDesaparecido.safeParse(armarEntrada({ ...base, tipo: 'desaparecido', nombre: 'Juan Pérez' })).success).toBe(true)
  })
  it('acopio → pasa esquemaAcopioPublico', () => {
    expect(esquemaAcopioPublico.safeParse(armarEntrada({ ...base, tipo: 'acopio', nombre: 'Parroquia', contacto_publico: '3001234567' })).success).toBe(true)
  })
  it('albergue → pasa esquemaAlbergue', () => {
    expect(esquemaAlbergue.safeParse(armarEntrada({ ...base, tipo: 'albergue', nombre: 'Coliseo', contacto_publico: '3001234567' })).success).toBe(true)
  })
})
