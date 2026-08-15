'use server'
import { revalidatePath } from 'next/cache'
import { moderarAcopio } from '@/lib/datos/acopios-publico'

export async function accionModerarAcopio(id: string, accion: 'aprobar' | 'rechazar') {
  const r = await moderarAcopio(id, accion)
  revalidatePath('/[locale]/panel/acopios', 'page')
  revalidatePath('/[locale]/acopios', 'page')
  return r
}
