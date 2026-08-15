'use server'
import { crearServicio } from '@/lib/datos/reportar'
export type EstadoFormulario = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionReportarServicio(
  _prev: EstadoFormulario, formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true }
  const entrada = {
    tipo: formData.get('tipo'),
    descripcion: formData.get('descripcion'),
    capacidad: (formData.get('capacidad') as string) || undefined,
    municipio_id: formData.get('municipio_id'),
    contacto_nombre: formData.get('contacto_nombre'),
    contacto_telefono: formData.get('contacto_telefono'),
  }
  const res = await crearServicio(entrada)
  return res.ok ? { enviado: true } : { enviado: false, errores: res.errores }
}
