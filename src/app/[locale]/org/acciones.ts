'use server'
import { revalidatePath } from 'next/cache'
import { accionSolicitudOrg, type AccionOrg } from '@/lib/datos/org'

export async function accionOrg(id: string, accion: AccionOrg) {
  const r = await accionSolicitudOrg(id, accion)
  revalidatePath('/[locale]/org', 'page')
  return r
}
