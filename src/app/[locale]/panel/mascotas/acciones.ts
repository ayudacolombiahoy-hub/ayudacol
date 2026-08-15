'use server'
import { revalidatePath } from 'next/cache'
import { cambiarEstadoMascota } from '@/lib/datos/mascotas'

export async function accionCambiarEstadoMascota(id: string, estado: string) {
  const r = await cambiarEstadoMascota(id, estado)
  revalidatePath('/[locale]/panel/mascotas', 'page')
  revalidatePath('/[locale]/mascotas', 'page')
  return r
}
