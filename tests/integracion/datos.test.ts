import { describe, test, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { listarMunicipios, listarNecesidades } from '../../src/lib/datos/consultas'
import { crearNecesidad, crearVoluntario } from '../../src/lib/datos/reportar'

const MARCA = 'PRUEBA INTEGRACION —'

describe('lecturas públicas', () => {
  test('lista municipios (>= 25)', async () => {
    const m = await listarMunicipios()
    expect(m.length).toBeGreaterThanOrEqual(25)
    expect(m[0]).toHaveProperty('codigo_dane')
  })
  test('lista necesidades y NUNCA expone contacto', async () => {
    const n = await listarNecesidades()
    for (const fila of n) {
      expect(fila).not.toHaveProperty('contacto_telefono')
      expect(fila).not.toHaveProperty('contacto_nombre')
    }
  })
  test('filtra necesidades por municipio sin error', async () => {
    const n = await listarNecesidades({ municipio: '17001' })
    expect(Array.isArray(n)).toBe(true)
  })
})

describe('inserciones validadas', () => {
  test('crea una necesidad válida', async () => {
    const r = await crearNecesidad({
      categoria: 'agua',
      descripcion: `${MARCA} familia sin agua potable en zona rural`,
      urgencia: 'alta',
      municipio_id: '27001',
      contacto_nombre: 'Prueba',
      contacto_telefono: '+57 300 0000000',
    })
    expect(r.ok).toBe(true)
  })
  test('rechaza una necesidad inválida con errores por campo', async () => {
    const r = await crearNecesidad({ categoria: 'agua', descripcion: 'x' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.descripcion).toBeDefined()
  })
  test('crea un voluntario válido', async () => {
    const r = await crearVoluntario({
      nombre: `${MARCA} Juan`,
      habilidades: ['remocion_escombros'],
      municipio_id: '17001',
      contacto_telefono: '3001112222',
    })
    expect(r.ok).toBe(true)
  })
})

afterAll(async () => {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave) return
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, llave)
  await admin.from('solicitudes_ayuda').delete().like('descripcion', `${MARCA}%`)
  await admin.from('voluntarios').delete().like('nombre', `${MARCA}%`)
})
