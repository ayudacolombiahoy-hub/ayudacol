'use server'
import { crearVoluntario } from '@/lib/datos/reportar'
export type EstadoFormulario = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionReportarVoluntario(
  _prev: EstadoFormulario, formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true }
  const entrada = {
    nombre: formData.get('nombre'),
    habilidades: formData.getAll('habilidades'),
    disponibilidad: (formData.get('disponibilidad') as string) || undefined,
    municipio_id: formData.get('municipio_id'),
    contacto_telefono: formData.get('contacto_telefono'),
  }
  const res = await crearVoluntario(entrada)
  return res.ok ? { enviado: true } : { enviado: false, errores: res.errores }
}
