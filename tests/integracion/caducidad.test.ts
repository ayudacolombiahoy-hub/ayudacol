import { describe, test, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MARCA = 'PRUEBA CADUCIDAD —'

describe('caducar_solicitudes()', () => {
  test('mueve verificadas viejas (>72h) a por_reconfirmar', async () => {
    // Insertar una verificada con actualizada_en antigua (service_role salta RLS).
    const { data: ins, error: e0 } = await admin.from('solicitudes_ayuda').insert({
      categoria: 'agua',
      descripcion: `${MARCA} solicitud vieja de prueba`,
      urgencia: 'alta',
      municipio_id: '27001',
      contacto_nombre: 'Prueba',
      contacto_telefono: '+57 300 0000000',
      estado: 'verificada',
      actualizada_en: new Date(Date.now() - 80 * 3600 * 1000).toISOString(),
    }).select('id').single()
    expect(e0).toBeNull()
    const id = ins!.id

    const { data: n, error: e1 } = await admin.rpc('caducar_solicitudes')
    expect(e1).toBeNull()
    expect(typeof n).toBe('number')

    const { data: fila } = await admin.from('solicitudes_ayuda').select('estado').eq('id', id).single()
    expect(fila!.estado).toBe('por_reconfirmar')
  })

  test('NO toca verificadas recientes', async () => {
    const { data: ins } = await admin.from('solicitudes_ayuda').insert({
      categoria: 'agua',
      descripcion: `${MARCA} solicitud reciente de prueba`,
      urgencia: 'alta',
      municipio_id: '27001',
      contacto_nombre: 'Prueba',
      contacto_telefono: '+57 300 0000000',
      estado: 'verificada',
    }).select('id').single()
    await admin.rpc('caducar_solicitudes')
    const { data: fila } = await admin.from('solicitudes_ayuda').select('estado').eq('id', ins!.id).single()
    expect(fila!.estado).toBe('verificada')
  })
})

afterAll(async () => {
  await admin.from('solicitudes_ayuda').delete().like('descripcion', `${MARCA}%`)
})
