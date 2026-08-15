'use server'
import { revalidatePath } from 'next/cache'
import { crearAlbergue, actualizarAlbergue } from '@/lib/datos/albergues'

export type EstadoAlbergueForm = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionCrearAlbergue(_prev: EstadoAlbergueForm, formData: FormData): Promise<EstadoAlbergueForm> {
  const entrada = {
    nombre: formData.get('nombre'),
    municipio_id: formData.get('municipio_id'),
    direccion: formData.get('direccion'),
    capacidad: (formData.get('capacidad') as string) || undefined,
    contacto_publico: (formData.get('contacto_publico') as string) || undefined,
  }
  const r = await crearAlbergue(entrada)
  if (!r.ok) return { enviado: false, errores: r.errores }
  revalidatePath('/[locale]/panel/albergues', 'page')
  revalidatePath('/[locale]/albergues', 'page')
  return { enviado: true }
}

export async function accionActualizarAlbergue(id: string, campos: { ocupacion?: number; estado?: string }) {
  const r = await actualizarAlbergue(id, campos)
  revalidatePath('/[locale]/panel/albergues', 'page')
  revalidatePath('/[locale]/albergues', 'page')
  return r
}
