'use server'
import { suscribir } from '@/lib/datos/alertas'

export type EstadoAlerta = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionSuscribirAlerta(
  _prev: EstadoAlerta, formData: FormData,
): Promise<EstadoAlerta> {
  const entrada = {
    email: formData.get('email'),
    municipio_id: (formData.get('municipio_id') as string) || undefined,
  }
  const res = await suscribir(entrada)
  return res.ok ? { enviado: true } : { enviado: false, errores: res.errores }
}
