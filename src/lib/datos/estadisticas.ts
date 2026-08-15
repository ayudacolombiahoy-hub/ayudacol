import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { resumenPorDepartamento, ACTIVAS, type ResumenDepto } from './agregados'

export type Conteo = { valor: string; n: number }

// Cuenta cuántas veces aparece cada valor de `items[i][clave]` y devuelve el
// resultado ordenado de mayor a menor (empates conservan el orden de aparición).
export function contarPor<T, K extends keyof T>(items: T[], clave: K): { valor: T[K]; n: number }[] {
  const mapa = new Map<T[K], number>()
  for (const item of items) {
    const v = item[clave]
    mapa.set(v, (mapa.get(v) ?? 0) + 1)
  }
  return [...mapa.entries()]
    .map(([valor, n]) => ({ valor, n }))
    .sort((a, b) => b.n - a.n)
}

export type EstadisticasGlobales = {
  contadores: {
    activas: number
    urgentes: number
    resueltas: number
    totalSolicitudes: number
    acopios: number
    voluntarios: number
    albergues: number
  }
  porCategoria: Conteo[]
  porEstado: Conteo[]
  porDepartamento: ResumenDepto[]
}

type SolicitudFila = { categoria: string; estado: string; urgencia: string }

// Panorama global para /estadisticas: lecturas públicas (RLS anónimo), en
// paralelo. Si alguna consulta falla, se degrada a vacío/0 en vez de romper
// la página (mismo criterio que resumenPorDepartamento()).
export async function estadisticasGlobales(): Promise<EstadisticasGlobales> {
  const sb = crearClienteAnonimo()
  const [{ data: sols }, { count: acopios }, { count: voluntarios }, { count: albergues }, porDepartamento] =
    await Promise.all([
      sb.from('solicitudes_publicas').select('categoria, estado, urgencia').limit(5000),
      sb.from('centros_acopio').select('*', { count: 'exact', head: true }),
      sb.from('voluntarios_publicos').select('*', { count: 'exact', head: true }),
      sb.from('albergues').select('*', { count: 'exact', head: true }),
      resumenPorDepartamento(),
    ])

  const solicitudes: SolicitudFila[] = sols ?? []
  const activas = solicitudes.filter((s) => ACTIVAS.has(s.estado))
  const urgentes = activas.filter((s) => s.urgencia === 'alta')
  const resueltas = solicitudes.filter((s) => s.estado === 'resuelta')

  return {
    contadores: {
      activas: activas.length,
      urgentes: urgentes.length,
      resueltas: resueltas.length,
      totalSolicitudes: solicitudes.length,
      acopios: acopios ?? 0,
      voluntarios: voluntarios ?? 0,
      albergues: albergues ?? 0,
    },
    porCategoria: contarPor(activas, 'categoria'),
    porEstado: contarPor(solicitudes, 'estado'),
    porDepartamento,
  }
}
