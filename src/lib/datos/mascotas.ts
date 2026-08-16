import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaMascota, erroresPorCampo, ESTADOS_MASCOTA } from '@/lib/validacion/esquemas'
import { esUuid } from '@/lib/formato'

export type FiltrosMascotas = { municipio?: string; tipo?: string; especie?: string }

// Lectura pública desde la vista (RLS: la vista es legible por anónimo e incluye contacto).
export async function listarMascotas(f: FiltrosMascotas = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('mascotas_publicas').select('*').order('creada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  if (f.tipo) q = q.eq('tipo_reporte', f.tipo)
  if (f.especie) q = q.eq('especie', f.especie)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

// Lectura pública de UNA mascota por id, desde la misma vista que el listado
// (incluye contacto). Devuelve null si el id no es UUID o no existe/no es público.
export async function obtenerMascota(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('mascotas_publicas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// La foto es opcional y no forma parte de esquemaMascota: se lee cruda y se guarda aparte.
// Lee las imágenes de la entrada cruda: acepta `fotos` (arreglo del formulario múltiple)
// o `foto_url` (una sola, como la manda capturas) → arreglo de URLs válidas.
function fotosDe(entrada: unknown): string[] {
  const e = entrada as { fotos?: unknown; foto_url?: unknown } | null
  const raw = Array.isArray(e?.fotos) ? e!.fotos : e?.fotos ? [e!.fotos] : (e?.foto_url ? [e!.foto_url] : [])
  return raw.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((s) => /^https?:\/\//.test(s))
}

// Reporte público: cualquiera inserta; la RLS exige estado='activo'.
export async function reportarMascota(entrada: unknown) {
  const p = esquemaMascota.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('mascotas').insert({
    ...p.data,
    nombre: p.data.nombre || null,
    municipio_id: p.data.municipio_id || null,
    ultima_ubicacion: p.data.ultima_ubicacion || null,
    fotos: fotosDe(entrada),
    estado: 'activo',
  })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

// Cola de moderación: reportes vigentes (activo/reunida) con contacto (RLS: solo equipo).
export async function listarColaMascotas() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('mascotas')
    .select('*')
    .in('estado', ['activo', 'reunida'])
    .order('creada_en', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Cambia el estado de un reporte (reunida/cerrado/activo): solo equipo, aplicado vía RLS.
export async function cambiarEstadoMascota(id: string, estado: string) {
  if (!ESTADOS_MASCOTA.includes(estado as (typeof ESTADOS_MASCOTA)[number])) {
    return { ok: false as const, motivo: 'estado_invalido' }
  }
  const sb = await crearClienteServidor()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, motivo: 'sin_sesion' }

  const { error } = await sb
    .from('mascotas')
    .update({ estado, verificada_por: user.id })
    .eq('id', id)
  if (error) return { ok: false as const, motivo: error.message }
  return { ok: true as const }
}
