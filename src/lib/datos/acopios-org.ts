import { crearClienteServidor } from '@/lib/supabase/servidor'
import { obtenerPerfil } from '@/lib/auth/sesion'
import { esquemaAcopio, erroresPorCampo, ESTADOS_ACOPIO } from '@/lib/validacion/esquemas'

export async function listarMisAcopios() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb.from('centros_acopio').select('*').order('actualizada_en', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function crearAcopio(entrada: unknown) {
  const perfil = await obtenerPerfil()
  if (!perfil?.organizacion_id) return { ok: false as const, errores: { _: ['sin_organizacion'] } }
  const p = esquemaAcopio.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb
    .from('centros_acopio')
    .insert({ ...p.data, organizacion_id: perfil.organizacion_id, estado: 'activo' })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

export async function cambiarEstadoAcopio(id: string, estado: string) {
  if (!ESTADOS_ACOPIO.includes(estado as (typeof ESTADOS_ACOPIO)[number])) {
    return { ok: false as const, motivo: 'estado_invalido' }
  }
  const sb = await crearClienteServidor()
  const { error } = await sb.from('centros_acopio').update({ estado }).eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
