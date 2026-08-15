'use server'
import { revalidatePath } from 'next/cache'
import { aprobarOrganizacion } from '@/lib/datos/admin'

export async function accionAprobar(id: string) {
  const r = await aprobarOrganizacion(id)
  revalidatePath('/[locale]/admin/organizaciones', 'page')
  return r
}
