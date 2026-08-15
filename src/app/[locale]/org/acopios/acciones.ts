'use server'
import { revalidatePath } from 'next/cache'
import { crearAcopio, cambiarEstadoAcopio } from '@/lib/datos/acopios-org'

export type EstadoAcopioForm = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionCrearAcopio(_prev: EstadoAcopioForm, formData: FormData): Promise<EstadoAcopioForm> {
  const entrada = {
    nombre: formData.get('nombre'),
    direccion: formData.get('direccion'),
    municipio_id: formData.get('municipio_id'),
    horarios: (formData.get('horarios') as string) || undefined,
    contacto_publico: (formData.get('contacto_publico') as string) || undefined,
    recibe: (formData.get('recibe') as string) || '',
    no_necesita: (formData.get('no_necesita') as string) || '',
  }
  const r = await crearAcopio(entrada)
  if (!r.ok) return { enviado: false, errores: r.errores }
  revalidatePath('/[locale]/org/acopios', 'page')
  return { enviado: true }
}

export async function accionEstadoAcopio(id: string, estado: string) {
  const r = await cambiarEstadoAcopio(id, estado)
  revalidatePath('/[locale]/org/acopios', 'page')
  return r
}
