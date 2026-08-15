'use server'
import { crearNecesidad } from '@/lib/datos/reportar'

export type EstadoFormulario = {
  enviado: boolean
  errores?: Record<string, string[]>
}

export async function accionReportarNecesidad(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true } // bot: descartar en silencio
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
  const res = await crearNecesidad(entrada)
  if (!res.ok) return { enviado: false, errores: res.errores }
  return { enviado: true }
}
