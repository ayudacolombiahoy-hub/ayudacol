import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaCampana, erroresPorCampo } from '@/lib/validacion/esquemas'

export async function listarCampanas() {
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('campanas_dinero').select('*').order('creada_en', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function crearCampana(entrada: unknown) {
  const p = esquemaCampana.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb.from('campanas_dinero').insert(p.data)
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

export async function eliminarCampana(id: string) {
  const sb = await crearClienteServidor()
  const { error } = await sb.from('campanas_dinero').delete().eq('id', id)
  return error ? { ok: false as const, motivo: error.message } : { ok: true as const }
}
