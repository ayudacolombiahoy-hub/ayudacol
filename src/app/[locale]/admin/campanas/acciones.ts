'use server'
import { revalidatePath } from 'next/cache'
import { crearCampana, eliminarCampana } from '@/lib/datos/campanas'

export type EstadoCampana = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionCrearCampana(_prev: EstadoCampana, formData: FormData): Promise<EstadoCampana> {
  const entrada = {
    titulo_es: formData.get('titulo_es'), titulo_en: formData.get('titulo_en'),
    descripcion_es: formData.get('descripcion_es'), descripcion_en: formData.get('descripcion_en'),
    organizacion: formData.get('organizacion'), url: formData.get('url'),
  }
  const r = await crearCampana(entrada)
  if (!r.ok) return { enviado: false, errores: r.errores }
  revalidatePath('/[locale]/admin/campanas', 'page')
  revalidatePath('/[locale]/donar', 'page')
  return { enviado: true }
}

export async function accionEliminarCampana(id: string) {
  const r = await eliminarCampana(id)
  revalidatePath('/[locale]/admin/campanas', 'page')
  revalidatePath('/[locale]/donar', 'page')
  return r
}
