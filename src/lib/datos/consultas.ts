import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { esUuid } from '@/lib/formato'

export type FiltrosNecesidades = { municipio?: string; categoria?: string; estado?: string }
export type FiltrosSimple = { municipio?: string }

export async function listarMunicipios() {
  const sb = crearClienteAnonimo()
  const { data, error } = await sb
    .from('municipios')
    .select('codigo_dane, nombre, departamento')
    .order('departamento', { ascending: true })
    .order('nombre', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

// Nombre "Municipio — Departamento" para un código DANE (o undefined). Reusa listarMunicipios.
export async function nombreMunicipio(id: string | null): Promise<string | undefined> {
  if (!id) return undefined
  const municipios = await listarMunicipios()
  const m = municipios.find((x) => x.codigo_dane === id)
  return m ? `${m.nombre} — ${m.departamento}` : undefined
}

export async function listarNecesidades(f: FiltrosNecesidades = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('solicitudes_publicas').select('*').order('creada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  if (f.categoria) q = q.eq('categoria', f.categoria)
  if (f.estado) q = q.eq('estado', f.estado)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

// Lectura pública de UNA necesidad por id, desde la vista sin contacto (privacidad).
// Devuelve null si el id no es UUID o no existe/no es público.
export async function obtenerNecesidad(id: string) {
  if (!esUuid(id)) return null
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('solicitudes_publicas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function listarAcopios(f: FiltrosSimple = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('centros_acopio').select('*').order('actualizada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listarVoluntarios(f: FiltrosSimple = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('voluntarios_publicos').select('*').order('creada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listarServicios(f: FiltrosSimple = {}) {
  const sb = crearClienteAnonimo()
  let q = sb.from('ofertas_servicios_publicas').select('*').order('creada_en', { ascending: false }).limit(200)
  if (f.municipio) q = q.eq('municipio_id', f.municipio)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}
