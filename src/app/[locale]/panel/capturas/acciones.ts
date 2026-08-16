'use server'
import { revalidatePath } from 'next/cache'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { extraerCapturas, type MediaType } from '@/lib/ia/extraer'
import { normalizarBorradores } from '@/lib/ia/borrador'
import { guardarLote, type ResumenGuardado } from '@/lib/datos/capturas'
import type { Borrador } from '@/lib/ia/borrador'
import { crearClienteAnonimo } from '@/lib/supabase/cliente'
import { randomUUID } from 'node:crypto'

export type { ResumenGuardado }

const MAX_IMAGENES = 20
const TIPOS_OK: MediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const EXT: Record<MediaType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }

async function esModerador(): Promise<boolean> {
  const perfil = await obtenerPerfil()
  return !!perfil && ROLES_PANEL.includes(perfil.rol)
}

export type ResultadoExtraccion =
  | { ok: true; borradores: Borrador[]; descartados: number; fallidas: number }
  | { ok: false; motivo: string }

export async function accionExtraerCapturas(formData: FormData): Promise<ResultadoExtraccion> {
  if (!(await esModerador())) return { ok: false, motivo: 'no_autorizado' }

  const archivos = formData.getAll('capturas').filter((f): f is File => f instanceof File)
  if (archivos.length === 0) return { ok: false, motivo: 'sin_imagenes' }
  if (archivos.length > MAX_IMAGENES) return { ok: false, motivo: 'demasiadas' }

  const sb = crearClienteAnonimo()
  const capturas = []
  for (const f of archivos) {
    if (!TIPOS_OK.includes(f.type as MediaType)) return { ok: false, motivo: 'tipo_invalido' }
    const mediaType = f.type as MediaType
    const buf = Buffer.from(await f.arrayBuffer())
    // Sube la captura al bucket público `fotos` para mostrarla en la publicación.
    // Si la subida falla, se sigue sin imagen (no rompe la extracción).
    let foto_url: string | undefined
    const ruta = `capturas/${randomUUID()}.${EXT[mediaType]}`
    const { error: errSubida } = await sb.storage.from('fotos').upload(ruta, buf, { contentType: mediaType })
    if (!errSubida) foto_url = sb.storage.from('fotos').getPublicUrl(ruta).data.publicUrl
    capturas.push({ base64: buf.toString('base64'), mediaType, foto_url })
  }

  try {
    const { crudos, fallidas } = await extraerCapturas(capturas)
    const { borradores, descartados } = normalizarBorradores(crudos)
    return { ok: true, borradores, descartados, fallidas }
  } catch {
    return { ok: false, motivo: 'error_ia' }
  }
}

export type ResultadoGuardado =
  | { ok: true; resumen: ResumenGuardado }
  | { ok: false; motivo: string }

export async function accionGuardarLote(borradores: Borrador[]): Promise<ResultadoGuardado> {
  if (!(await esModerador())) return { ok: false, motivo: 'no_autorizado' }
  if (!Array.isArray(borradores) || borradores.length === 0) return { ok: false, motivo: 'lote_vacio' }
  const resumen = await guardarLote(borradores)
  revalidatePath('/[locale]/panel', 'page')
  return { ok: true, resumen }
}
