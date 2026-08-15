import { describe, test, expect } from 'vitest'
import { agregarPorDepartamento, contadoresDesdeResumen } from '../../src/lib/datos/agregados'

const muniADepto = new Map<string, string>([
  ['17001', 'Caldas'],
  ['66001', 'Risaralda'],
  ['27001', 'Chocó'],
])

describe('agregarPorDepartamento', () => {
  const solicitudes = [
    { municipio_id: '17001', estado: 'verificada', urgencia: 'alta' },
    { municipio_id: '17001', estado: 'sin_verificar', urgencia: 'media' },
    { municipio_id: '17001', estado: 'resuelta', urgencia: 'baja' },
    { municipio_id: '66001', estado: 'verificada', urgencia: 'alta' },
  ]
  const acopios = [{ municipio_id: '17001' }, { municipio_id: '27001' }]

  test('cuenta activas, urgentes, resueltas y acopios por departamento', () => {
    const r = agregarPorDepartamento(solicitudes, acopios, muniADepto)
    const caldas = r.find((d) => d.departamento === 'Caldas')!
    expect(caldas.activas).toBe(2) // verificada + sin_verificar (resuelta no cuenta activa)
    expect(caldas.urgentes).toBe(1)
    expect(caldas.resueltas).toBe(1)
    expect(caldas.acopios).toBe(1)
    const choco = r.find((d) => d.departamento === 'Chocó')!
    expect(choco.acopios).toBe(1)
    expect(choco.activas).toBe(0)
  })
})

describe('contadoresDesdeResumen', () => {
  test('suma los totales globales', () => {
    const resumen = [
      { departamento: 'Caldas', activas: 2, urgentes: 1, resueltas: 1, acopios: 1 },
      { departamento: 'Chocó', activas: 0, urgentes: 0, resueltas: 0, acopios: 1 },
    ]
    expect(contadoresDesdeResumen(resumen)).toEqual({ activas: 2, urgentes: 1, resueltas: 1, acopios: 2 })
  })
})
