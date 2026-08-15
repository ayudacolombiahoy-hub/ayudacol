import { crearClienteServidor } from '@/lib/supabase/servidor'
import { puedeTransicionar, type EstadoSolicitud } from '@/lib/estados'
import { esquemaNecesidad, erroresPorCampo } from '@/lib/validacion/esquemas'

export type AccionModeracion = 'verificar' | 'rechazar' | 'duplicar'

const DESTINO: Record<AccionModeracion, EstadoSolicitud> = {
  verificar: 'verificada',
  rechazar: 'rechazada',
  duplicar: 'duplicada',
}

// Función pura: decide el estado destino y valida la transición como moderador.
export function decidirAccion(
  actual: EstadoSolicitud,
  accion: AccionModeracion,
): { ok: true; hacia: EstadoSolicitud } | { ok: false } {
  const hacia = DESTINO[accion]
  return puedeTransicionar(actual, hacia, 'moderador') ? { ok: true, hacia } : { ok: false }
}

// Cola de moderación: reportes que esperan decisión, con contacto (RLS: solo moderador/admin).
export async function listarCola() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('solicitudes_ayuda')
    .select('*')
    .in('estado', ['sin_verificar', 'por_reconfirmar'])
    .order('creada_en', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Aplica una decisión de moderación a una solicitud.
export async function moderarSolicitud(id: string, accion: AccionModeracion) {
  const sb = await crearClienteServidor()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, motivo: 'sin_sesion' }

  const { data: fila, error: e1 } = await sb.from('solicitudes_ayuda').select('estado').eq('id', id).single()
  if (e1 || !fila) return { ok: false as const, motivo: 'no_encontrada' }

  const d = decidirAccion(fila.estado as EstadoSolicitud, accion)
  if (!d.ok) return { ok: false as const, motivo: 'transicion_invalida' }

  const parche: Record<string, unknown> = { estado: d.hacia }
  if (d.hacia === 'verificada') {
    parche.verificada_por = user.id
    parche.verificada_en = new Date().toISOString()
  }
  const { error: e2 } = await sb.from('solicitudes_ayuda').update(parche).eq('id', id)
  if (e2) return { ok: false as const, motivo: e2.message }
  return { ok: true as const }
}

// Transcripción de un reporte que llegó por WhatsApp (moderador lo captura).
export async function crearTranscripcion(entrada: unknown) {
  const p = esquemaNecesidad.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb
    .from('solicitudes_ayuda')
    .insert({ ...p.data, estado: 'sin_verificar', origen: 'whatsapp' })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}
