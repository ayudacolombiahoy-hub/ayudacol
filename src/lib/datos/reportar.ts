import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import {
  esquemaNecesidad, esquemaVoluntario, esquemaServicio, erroresPorCampo,
} from '@/lib/validacion/esquemas'

export type Resultado =
  | { ok: true }
  | { ok: false; errores: Record<string, string[]> }

// La foto es opcional y no forma parte de esquemaNecesidad (para no acoplar la
// validación del reporte a la subida de imágenes): se lee directamente de la
// entrada cruda y se guarda aparte en la columna `fotos` (arreglo).
function fotoDe(entrada: unknown): string | undefined {
  const v = (entrada as { foto?: unknown } | null)?.foto
  const s = typeof v === 'string' ? v.trim() : ''
  return /^https?:\/\//.test(s) ? s : undefined
}

// Igual que fotoDe pero lee el campo `foto_url` (columna única foto_url, no arreglo).
function fotoUrlDe(entrada: unknown): string | undefined {
  const v = (entrada as { foto_url?: unknown } | null)?.foto_url
  const s = typeof v === 'string' ? v.trim() : ''
  return /^https?:\/\//.test(s) ? s : undefined
}

export async function crearNecesidad(entrada: unknown): Promise<Resultado> {
  const p = esquemaNecesidad.safeParse(entrada)
  if (!p.success) return { ok: false, errores: erroresPorCampo(p.error) }
  const foto = fotoDe(entrada)
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('solicitudes_ayuda').insert({
    ...p.data,
    estado: 'sin_verificar',
    fotos: foto ? [foto] : [],
  })
  if (error) return { ok: false, errores: { _: [error.message] } }
  return { ok: true }
}

export async function crearVoluntario(entrada: unknown): Promise<Resultado> {
  const p = esquemaVoluntario.safeParse(entrada)
  if (!p.success) return { ok: false, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('voluntarios').insert({ ...p.data, foto_url: fotoUrlDe(entrada) ?? null, estado: 'disponible' })
  if (error) return { ok: false, errores: { _: [error.message] } }
  return { ok: true }
}

export async function crearServicio(entrada: unknown): Promise<Resultado> {
  const p = esquemaServicio.safeParse(entrada)
  if (!p.success) return { ok: false, errores: erroresPorCampo(p.error) }
  const sb = crearClienteAnonimo()
  const { error } = await sb.from('ofertas_servicios').insert({ ...p.data, estado: 'disponible' })
  if (error) return { ok: false, errores: { _: [error.message] } }
  return { ok: true }
}
