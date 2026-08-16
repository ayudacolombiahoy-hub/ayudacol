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
    descripcion: (formData.get('descripcion') as string) || undefined,
    disponibilidad: (formData.get('disponibilidad') as string) || undefined,
    municipio_id: formData.get('municipio_id'),
    contacto_telefono: formData.get('contacto_telefono'),
    foto_url: (formData.get('foto_url') as string) || undefined,
  }
  const res = await crearVoluntario(entrada)
  return res.ok ? { enviado: true } : { enviado: false, errores: res.errores }
}
