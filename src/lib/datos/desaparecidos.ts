import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaDesaparecido, erroresPorCampo, ESTADOS_PERSONA } from '@/lib/validacion/esquemas'
import { esUuid } from '@/lib/formato'

export type FiltrosDesaparecidos = { municipio?: string }

// Lectura pública desde la vista sin contacto (RLS: la vista es legible por anónimo).
export async function listarDesaparecidos(f: FiltrosDesaparecidos = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('personas_desaparecidas_publicas').select('*').order('creada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

// Lectura pública de UNA persona desaparecida por id, desde la vista SIN contacto.
export async function obtenerDesaparecido(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('personas_desaparecidas_publicas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// La foto es opcional y no forma parte de esquemaDesaparecido (para no acoplar
// la validación del reporte a la subida de imágenes): se lee de la entrada
// cruda y se guarda aparte en la columna `foto_url`.
function fotoUrlDe(entrada: unknown): string | undefined {
  const v = (entrada as { foto_url?: unknown } | null)?.foto_url
  const s = typeof v === 'string' ? v.trim() : ''
  return /^https?:\/\//.test(s) ? s : undefined
}

// Reporte público: cualquiera puede insertar; la RLS exige estado='buscando'.
export async function reportarDesaparecido(entrada: unknown) {
  const p = esquemaDesaparecido.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('personas_desaparecidas').insert({
    ...p.data,
    municipio_id: p.data.municipio_id || null,
    ultima_ubicacion: p.data.ultima_ubicacion || null,
    foto_url: fotoUrlDe(entrada) ?? null,
    estado: 'buscando',
  })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

// Cola de moderación: casos activos (buscando/encontrada) con contacto visible (RLS: solo moderador/admin).
export async function listarColaDesaparecidos() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('personas_desaparecidas')
    .select('*')
    .in('estado', ['buscando', 'encontrada'])
    .order('creada_en', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Cambia el estado de un caso (encontrada/cerrado/buscando): solo equipo, aplicado vía RLS.
export async function cambiarEstadoDesaparecido(id: string, estado: string) {
  if (!ESTADOS_PERSONA.includes(estado as (typeof ESTADOS_PERSONA)[number])) {
    return { ok: false as const, motivo: 'estado_invalido' }
  }
  const sb = await crearClienteServidor()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, motivo: 'sin_sesion' }

  const { error } = await sb
    .from('personas_desaparecidas')
    .update({ estado, verificada_por: user.id })
    .eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
