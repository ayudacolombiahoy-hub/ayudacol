import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { esquemaRefugio, erroresPorCampo } from '@/lib/validacion/esquemas'

export type FiltrosRefugios = { municipio?: string }

// Lectura pública (RLS: cualquiera puede leer todos los refugios).
export async function listarRefugios(f: FiltrosRefugios = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('refugios_animales').select('*').order('actualizada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

// Alta de un refugio: solo equipo (moderador/admin). estado/ocupación quedan
// en su valor por defecto de la base de datos ('abierto' / 0).
export async function crearRefugio(entrada: unknown) {
  const perfil = await obtenerPerfil()
  if (!perfil || !ROLES_PANEL.includes(perfil.rol)) {
    return { ok: false as const, errores: { _: ['no_autorizado'] } }
  }
  const p = esquemaRefugio.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb.from('refugios_animales').insert(p.data)
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

const esquemaActualizacionRefugio = esquemaRefugio.pick({ ocupacion: true, estado: true })

// Actualiza cupos ocupados y/o estado: solo equipo (moderador/admin).
export async function actualizarRefugio(id: string, campos: { ocupacion?: number; estado?: string }) {
  const perfil = await obtenerPerfil()
  if (!perfil || !ROLES_PANEL.includes(perfil.rol)) {
    return { ok: false as const, motivo: 'no_autorizado' }
  }
  const p = esquemaActualizacionRefugio.safeParse(campos)
  if (!p.success) return { ok: false as const, motivo: 'datos_invalidos' }
  if (p.data.ocupacion === undefined && p.data.estado === undefined) {
    return { ok: false as const, motivo: 'sin_cambios' }
  }
  const sb = await crearClienteServidor()
  const { error } = await sb.from('refugios_animales').update(p.data).eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
