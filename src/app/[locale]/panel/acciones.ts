'use server'
import { revalidatePath } from 'next/cache'
import { moderarSolicitud, crearTranscripcion, type AccionModeracion } from '@/lib/datos/moderacion'

export async function accionModerar(id: string, accion: AccionModeracion) {
  const r = await moderarSolicitud(id, accion)
  revalidatePath('/[locale]/panel', 'page')
  return r
}

export type EstadoTranscripcion = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionTranscribir(
  _prev: EstadoTranscripcion,
  formData: FormData,
): Promise<EstadoTranscripcion> {
  const entrada = {
    categoria: formData.get('categoria'),
    descripcion: formData.get('descripcion'),
    personas_afectadas: (formData.get('personas_afectadas') as string) || undefined,
    urgencia: formData.get('urgencia'),
    municipio_id: formData.get('municipio_id'),
    detalle_ubicacion: (formData.get('detalle_ubicacion') as string) || undefined,
    contacto_nombre: formData.get('contacto_nombre'),
    contacto_telefono: formData.get('contacto_telefono'),
  }
  const res = await crearTranscripcion(entrada)
  if (!res.ok) return { enviado: false, errores: res.errores }
  revalidatePath('/[locale]/panel', 'page')
  return { enviado: true }
}
