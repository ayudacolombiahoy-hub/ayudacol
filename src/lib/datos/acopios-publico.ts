import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaAcopioPublico, erroresPorCampo } from '@/lib/validacion/esquemas'

// Propuesta pública: cualquiera inserta; la RLS exige organizacion_id null y verificado=false.
export async function proponerAcopio(entrada: unknown) {
  const p = esquemaAcopioPublico.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('centros_acopio').insert({
    ...p.data,
    organizacion_id: null,
    verificado: false,
    estado: 'activo',
  })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

// Cola de moderación: propuestas sin verificar (RLS: solo equipo lee no verificados).
export async function listarColaAcopios() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('centros_acopio')
    .select('*')
    .eq('verificado', false)
    .order('actualizada_en', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Modera una propuesta: aprobar (verificado=true) o rechazar (borrar). Solo equipo (RLS).
export async function moderarAcopio(id: string, accion: 'aprobar' | 'rechazar') {
  const sb = await crearClienteServidor()
  if (accion === 'aprobar') {
    const { error } = await sb.from('centros_acopio').update({ verificado: true }).eq('id', id)
    if (error) return { ok: false as const, motivo: error.message }
    return { ok: true as const }
  }
  const { error } = await sb.from('centros_acopio').delete().eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
