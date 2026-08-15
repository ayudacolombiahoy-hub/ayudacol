export type EstadoSolicitud =
  | 'sin_verificar'
  | 'verificada'
  | 'en_atencion'
  | 'resuelta'
  | 'rechazada'
  | 'duplicada'
  | 'por_reconfirmar'

export type RolTransicion = 'publico' | 'sistema' | 'moderador' | 'org' | 'admin'

type Mapa = Partial<Record<EstadoSolicitud, EstadoSolicitud[]>>

const TRANSICIONES: Record<RolTransicion, Mapa> = {
  publico: {},
  sistema: {
    verificada: ['por_reconfirmar'],
    en_atencion: ['por_reconfirmar'],
  },
  moderador: {
    sin_verificar: ['verificada', 'rechazada', 'duplicada'],
    por_reconfirmar: ['verificada', 'rechazada'],
    verificada: ['rechazada', 'duplicada'],
    en_atencion: ['resuelta'],
  },
  org: {
    verificada: ['en_atencion'],
    en_atencion: ['resuelta', 'verificada'],
  },
  admin: {
    sin_verificar: ['verificada', 'rechazada', 'duplicada'],
    por_reconfirmar: ['verificada', 'rechazada'],
    verificada: ['rechazada', 'duplicada', 'en_atencion'],
    en_atencion: ['resuelta', 'verificada'],
  },
}

export function puedeTransicionar(
  desde: EstadoSolicitud,
  hacia: EstadoSolicitud,
  rol: RolTransicion
): boolean {
  return (TRANSICIONES[rol][desde] ?? []).includes(hacia)
}
