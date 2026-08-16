'use server'
import { revalidatePath } from 'next/cache'
import { crearNovedad, eliminarNovedad } from '@/lib/datos/novedades'

export type EstadoNovedad = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionCrearNovedad(_prev: EstadoNovedad, formData: FormData): Promise<EstadoNovedad> {
  const entrada = {
    titulo_es: formData.get('titulo_es'), titulo_en: formData.get('titulo_en'),
    contenido_es: formData.get('contenido_es'), contenido_en: formData.get('contenido_en'),
    enlace: formData.get('enlace'),
    enlace_texto_es: formData.get('enlace_texto_es'),
    enlace_texto_en: formData.get('enlace_texto_en'),
    fotos: formData.getAll('fotos') as string[],
  }
  const r = await crearNovedad(entrada)
  if (!r.ok) return { enviado: false, errores: r.errores }
  revalidatePath('/[locale]/admin/novedades', 'page')
  revalidatePath('/[locale]/novedades', 'page')
  return { enviado: true }
}

export async function accionEliminarNovedad(id: string) {
  const r = await eliminarNovedad(id)
  revalidatePath('/[locale]/admin/novedades', 'page')
  revalidatePath('/[locale]/novedades', 'page')
  return r
}
