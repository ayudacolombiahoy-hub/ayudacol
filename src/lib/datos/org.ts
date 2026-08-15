import { crearClienteServidor } from '@/lib/supabase/servidor'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { puedeTransicionar, type EstadoSolicitud } from '@/lib/estados'

export type AccionOrg = 'tomar' | 'resolver' | 'liberar'

const DESTINO_ORG: Record<AccionOrg, EstadoSolicitud> = {
  tomar: 'en_atencion',
  resolver: 'resuelta',
  liberar: 'verificada',
}

export function decidirAccionOrg(
  actual: EstadoSolicitud,
  accion: AccionOrg,
): { ok: true; hacia: EstadoSolicitud } | { ok: false } {
  const hacia = DESTINO_ORG[accion]
  return puedeTransicionar(actual, hacia, 'org') ? { ok: true, hacia } : { ok: false }
}

// Verificadas SIN asignar: candidatas a tomar (RLS ya filtra a orgs).
export async function listarVerificadasParaTomar() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('solicitudes_ayuda')
    .select('*')
    .eq('estado', 'verificada')
    .is('organizacion_asignada', null)
    .order('urgencia', { ascending: true })
    .order('creada_en', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Las que YA tomó mi organización (con contacto, gracias al RLS).
export async function listarMisAsignadas() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('solicitudes_ayuda')
    .select('*')
    .eq('estado', 'en_atencion')
    .order('actualizada_en', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function accionSolicitudOrg(id: string, accion: AccionOrg) {
  const perfil = await obtenerPerfil()
  if (!perfil || perfil.rol !== 'org' || !perfil.organizacion_id) {
    return { ok: false as const, motivo: 'sin_permiso' }
  }
  const sb = await crearClienteServidor()
  const { data: fila, error: e1 } = await sb.from('solicitudes_ayuda').select('estado').eq('id', id).single()
  if (e1 || !fila) return { ok: false as const, motivo: 'no_encontrada' }

  const d = decidirAccionOrg(fila.estado as EstadoSolicitud, accion)
  if (!d.ok) return { ok: false as const, motivo: 'transicion_invalida' }

  if (accion === 'tomar') {
    // Update condicional: solo si sigue verificada y sin asignar (evita doble-toma).
    const { data, error } = await sb
      .from('solicitudes_ayuda')
      .update({ estado: 'en_atencion', organizacion_asignada: perfil.organizacion_id })
      .eq('id', id)
      .eq('estado', 'verificada')
      .is('organizacion_asignada', null)
      .select('id')
    if (error) return { ok: false as const, motivo: error.message }
    if (!data || data.length === 0) return { ok: false as const, motivo: 'ya_tomada' }
    return { ok: true as const }
  }

  const parche: Record<string, unknown> = { estado: d.hacia }
  if (accion === 'liberar') parche.organizacion_asignada = null
  const { error } = await sb.from('solicitudes_ayuda').update(parche).eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
