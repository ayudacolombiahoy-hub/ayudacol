import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaNovedad, erroresPorCampo } from '@/lib/validacion/esquemas'
import { fotosDe } from './fotos'

export async function listarNovedades() {
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('novedades').select('*').order('creada_en', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function crearNovedad(entrada: unknown) {
  const p = esquemaNovedad.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb.from('novedades').insert({
    ...p.data,
    enlace: p.data.enlace || null,
    enlace_texto_es: p.data.enlace_texto_es || null,
    enlace_texto_en: p.data.enlace_texto_en || null,
    fotos: fotosDe(entrada),
  })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}

export async function eliminarNovedad(id: string) {
  const sb = await crearClienteServidor()
  const { error } = await sb.from('novedades').delete().eq('id', id)
  return error ? { ok: false as const, motivo: error.message } : { ok: true as const }
}
