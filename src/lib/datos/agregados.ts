import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { listarMunicipios } from './consultas'

export type ResumenDepto = {
  departamento: string
  activas: number
  urgentes: number
  resueltas: number
  acopios: number
}

// Exportado para que otras capas de datos (p. ej. estadisticas.ts) reutilicen
// la misma definición de "solicitud activa" sin duplicarla.
export const ACTIVAS = new Set(['sin_verificar', 'verificada', 'en_atencion', 'por_reconfirmar'])

export function agregarPorDepartamento(
  solicitudes: { municipio_id: string; estado: string; urgencia: string }[],
  acopios: { municipio_id: string }[],
  muniADepto: Map<string, string>,
): ResumenDepto[] {
  const mapa = new Map<string, ResumenDepto>()
  const asegura = (depto: string) => {
    if (!mapa.has(depto)) mapa.set(depto, { departamento: depto, activas: 0, urgentes: 0, resueltas: 0, acopios: 0 })
    return mapa.get(depto)!
  }
  for (const s of solicitudes) {
    const depto = muniADepto.get(s.municipio_id)
    if (!depto) continue
    const d = asegura(depto)
    if (s.estado === 'resuelta') d.resueltas++
    else if (ACTIVAS.has(s.estado)) {
      d.activas++
      if (s.urgencia === 'alta') d.urgentes++
    }
  }
  for (const a of acopios) {
    const depto = muniADepto.get(a.municipio_id)
    if (!depto) continue
    asegura(depto).acopios++
  }
  return [...mapa.values()].sort((x, y) => y.activas - x.activas)
}

export function contadoresDesdeResumen(resumen: ResumenDepto[]) {
  return resumen.reduce(
    (acc, d) => ({
      activas: acc.activas + d.activas,
      urgentes: acc.urgentes + d.urgentes,
      resueltas: acc.resueltas + d.resueltas,
      acopios: acc.acopios + d.acopios,
    }),
    { activas: 0, urgentes: 0, resueltas: 0, acopios: 0 },
  )
}

export async function resumenPorDepartamento(): Promise<ResumenDepto[]> {
  const sb = crearClienteAnonimo()
  const [{ data: sols }, { data: acos }, munis] = await Promise.all([
    sb.from('solicitudes_publicas').select('municipio_id, estado, urgencia').limit(5000),
    sb.from('centros_acopio').select('municipio_id').limit(5000),
    listarMunicipios(),
  ])
  const muniADepto = new Map(munis.map((m) => [m.codigo_dane, m.departamento]))
  return agregarPorDepartamento(sols ?? [], acos ?? [], muniADepto)
}
