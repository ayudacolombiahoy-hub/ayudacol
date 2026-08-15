import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaOrganizacion, erroresPorCampo } from '@/lib/validacion/esquemas'

export async function listarOrganizaciones() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb.from('organizaciones').select('*').order('creada_en', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function aprobarOrganizacion(id: string) {
  const sb = await crearClienteServidor()
  const { error } = await sb.from('organizaciones').update({ estado: 'aprobada' }).eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}

export async function crearOrganizacion(entrada: unknown) {
  const p = esquemaOrganizacion.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb.from('organizaciones').insert({ ...p.data, estado: 'pendiente' })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}
