import { describe, test, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const idsInsertados: string[] = []

describe('RLS: tablas privadas', () => {
  test('anónimo NO puede leer la tabla base solicitudes_ayuda', async () => {
    const { error } = await anon.from('solicitudes_ayuda').select('*').limit(1)
    expect(error).not.toBeNull()
  })

  test('anónimo NO puede leer la tabla base voluntarios', async () => {
    const { error } = await anon.from('voluntarios').select('*').limit(1)
    expect(error).not.toBeNull()
  })

  test('anónimo NO puede leer la tabla base ofertas_servicios', async () => {
    const { error } = await anon.from('ofertas_servicios').select('*').limit(1)
    expect(error).not.toBeNull()
  })

  test('anónimo NO puede actualizar solicitudes', async () => {
    const { error } = await anon
      .from('solicitudes_ayuda')
      .update({ estado: 'verificada' })
      .eq('categoria', 'alimentos')
    expect(error).not.toBeNull()
  })
})

describe('RLS: vistas públicas', () => {
  test('la vista solicitudes_publicas es legible y NO expone contacto', async () => {
    const { data, error } = await anon.from('solicitudes_publicas').select('*').limit(5)
    expect(error).toBeNull()
    for (const fila of data ?? []) {
      expect(fila).not.toHaveProperty('contacto_nombre')
      expect(fila).not.toHaveProperty('contacto_telefono')
    }
  })

  test('la vista voluntarios_publicos es legible y NO expone contacto', async () => {
    const { data, error } = await anon.from('voluntarios_publicos').select('*').limit(5)
    expect(error).toBeNull()
    for (const fila of data ?? []) {
      expect(fila).not.toHaveProperty('nombre')
      expect(fila).not.toHaveProperty('contacto_telefono')
    }
  })

  test('el catálogo de municipios es público y tiene datos', async () => {
    const { data, error } = await anon.from('municipios').select('codigo_dane, nombre, departamento')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThanOrEqual(20)
  })
})

describe('RLS: inserción pública de reportes', () => {
  test('anónimo SÍ puede reportar una necesidad (queda sin_verificar)', async () => {
    const { data, error } = await anon
      .from('solicitudes_ayuda')
      .insert({
        categoria: 'agua',
        descripcion: 'PRUEBA AUTOMATICA — familia sin agua potable en la vereda',
        personas_afectadas: 4,
        urgencia: 'alta',
        municipio_id: '27001',
        contacto_nombre: 'Prueba RLS',
        contacto_telefono: '+57 300 000 0000',
      })
      .select('id')
    // La política permite INSERT; el select de retorno usa la política de la tabla
    // base y por eso puede fallar: aceptamos error===null (insert minimal ok) si data es null.
    if (error) {
      // Reintento sin retorno de representación:
      const { error: e2 } = await anon.from('solicitudes_ayuda').insert({
        categoria: 'agua',
        descripcion: 'PRUEBA AUTOMATICA — familia sin agua potable en la vereda',
        personas_afectadas: 4,
        urgencia: 'alta',
        municipio_id: '27001',
        contacto_nombre: 'Prueba RLS',
        contacto_telefono: '+57 300 000 0000',
      })
      expect(e2).toBeNull()
    } else if (data && data[0]) {
      idsInsertados.push(data[0].id)
    }
  })

  test('anónimo NO puede insertar con estado distinto de sin_verificar', async () => {
    const { error } = await anon.from('solicitudes_ayuda').insert({
      categoria: 'agua',
      descripcion: 'PRUEBA AUTOMATICA — intento de auto-verificacion',
      urgencia: 'alta',
      municipio_id: '27001',
      contacto_nombre: 'Prueba RLS',
      contacto_telefono: '+57 300 000 0000',
      estado: 'verificada',
    })
    expect(error).not.toBeNull()
  })
})

afterAll(async () => {
  // Limpieza con service_role si está disponible (borra solo filas de prueba)
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave) return
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, llave)
  await admin
    .from('solicitudes_ayuda')
    .delete()
    .like('descripcion', 'PRUEBA AUTOMATICA%')
})
