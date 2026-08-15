'use server'
import { revalidatePath } from 'next/cache'
import { crearRefugio, actualizarRefugio } from '@/lib/datos/refugios'

export type EstadoRefugioForm = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionCrearRefugio(_prev: EstadoRefugioForm, formData: FormData): Promise<EstadoRefugioForm> {
  const entrada = {
    nombre: formData.get('nombre'),
    municipio_id: formData.get('municipio_id'),
    direccion: formData.get('direccion'),
    capacidad: (formData.get('capacidad') as string) || undefined,
    especies: (formData.get('especies') as string) || undefined,
    contacto_publico: (formData.get('contacto_publico') as string) || undefined,
  }
  const r = await crearRefugio(entrada)
  if (!r.ok) return { enviado: false, errores: r.errores }
  revalidatePath('/[locale]/panel/refugios-animales', 'page')
  revalidatePath('/[locale]/refugios-animales', 'page')
  return { enviado: true }
}

export async function accionActualizarRefugio(id: string, campos: { ocupacion?: number; estado?: string }) {
  const r = await actualizarRefugio(id, campos)
  revalidatePath('/[locale]/panel/refugios-animales', 'page')
  revalidatePath('/[locale]/refugios-animales', 'page')
  return r
}
