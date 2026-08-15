'use server'
import { revalidatePath } from 'next/cache'
import { cambiarEstadoDesaparecido } from '@/lib/datos/desaparecidos'

export async function accionCambiarEstadoDesaparecido(id: string, estado: string) {
  const r = await cambiarEstadoDesaparecido(id, estado)
  revalidatePath('/[locale]/panel/desaparecidos', 'page')
  revalidatePath('/[locale]/desaparecidos', 'page')
  return r
}
