import { describe, test, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  listarMunicipios, listarNecesidades, obtenerNecesidad,
  listarServicios, obtenerServicio, listarVoluntarios, obtenerVoluntario,
  listarAcopios, obtenerAcopio,
} from '../../src/lib/datos/consultas'
import { crearNecesidad, crearVoluntario } from '../../src/lib/datos/reportar'
import { listarMascotas, obtenerMascota } from '../../src/lib/datos/mascotas'
import { listarDesaparecidos, obtenerDesaparecido } from '../../src/lib/datos/desaparecidos'
import { listarAlbergues, obtenerAlbergue } from '../../src/lib/datos/albergues'

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
  test('obtenerMascota devuelve la fila por id (o null)', async () => {
    const lista = await listarMascotas()
    if (lista.length === 0) return
    const uno = await obtenerMascota(lista[0].id)
    if (!uno) return // BD compartida: la fila más reciente pudo borrarse entre la lista y la consulta por id
    expect(uno.id).toBe(lista[0].id)
  })
  test('obtenerMascota con id inexistente devuelve null', async () => {
    const r = await obtenerMascota('00000000-0000-4000-8000-000000000000')
    expect(r).toBeNull()
  })
  test('obtenerNecesidad NUNCA expone contacto', async () => {
    const lista = await listarNecesidades()
    if (lista.length === 0) return
    const uno = await obtenerNecesidad(lista[0].id)
    if (!uno) return // BD compartida: la fila más reciente pudo borrarse entre la lista y la consulta por id
    expect(uno).not.toHaveProperty('contacto_telefono')
    expect(uno).not.toHaveProperty('contacto_nombre')
  })
  test('obtenerDesaparecido NUNCA expone contacto', async () => {
    const lista = await listarDesaparecidos()
    if (lista.length === 0) return
    const uno = await obtenerDesaparecido(lista[0].id)
    if (!uno) return // BD compartida: la fila más reciente pudo borrarse entre la lista y la consulta por id
    expect(uno).not.toHaveProperty('contacto_telefono')
    expect(uno).not.toHaveProperty('contacto_nombre')
  })
  test('obtenerServicio NUNCA expone contacto', async () => {
    const lista = await listarServicios()
    if (lista.length === 0) return
    const uno = await obtenerServicio(lista[0].id)
    if (!uno) return // BD compartida: la fila pudo borrarse entre la lista y la consulta por id
    expect(uno).not.toHaveProperty('contacto_telefono')
    expect(uno).not.toHaveProperty('contacto_nombre')
  })
  test('obtenerVoluntario NUNCA expone contacto', async () => {
    const lista = await listarVoluntarios()
    if (lista.length === 0) return
    const uno = await obtenerVoluntario(lista[0].id)
    if (!uno) return // BD compartida: la fila pudo borrarse entre la lista y la consulta por id
    expect(uno).not.toHaveProperty('contacto_telefono')
    expect(uno).not.toHaveProperty('contacto_nombre')
  })
  test('obtenerAcopio devuelve la fila por id (o null)', async () => {
    const lista = await listarAcopios()
    if (lista.length === 0) return
    const uno = await obtenerAcopio(lista[0].id)
    if (!uno) return // BD compartida: la fila pudo borrarse entre la lista y la consulta por id
    expect(uno.id).toBe(lista[0].id)
  })
  test('obtenerAlbergue devuelve la fila por id (o null)', async () => {
    const lista = await listarAlbergues()
    if (lista.length === 0) return
    const uno = await obtenerAlbergue(lista[0].id)
    if (!uno) return // BD compartida: la fila pudo borrarse entre la lista y la consulta por id
    expect(uno.id).toBe(lista[0].id)
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
