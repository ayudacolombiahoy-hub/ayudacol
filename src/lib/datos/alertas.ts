import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaSuscripcion, erroresPorCampo } from '@/lib/validacion/esquemas'

export type Resultado =
  | { ok: true }
  | { ok: false; errores: Record<string, string[]> }

export async function suscribir(entrada: unknown): Promise<Resultado> {
  const p = esquemaSuscripcion.safeParse(entrada)
  if (!p.success) return { ok: false, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb
    .from('suscripciones_alertas')
    .insert({ email: p.data.email, municipio_id: p.data.municipio_id || null })
  if (error) return { ok: false, errores: { _: [error.message] } }
  return { ok: true }
}

export async function listarSuscripciones() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb.from('suscripciones_alertas').select('*').order('creada_en', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}
