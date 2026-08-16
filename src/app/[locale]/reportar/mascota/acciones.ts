'use server'
import { reportarMascota } from '@/lib/datos/mascotas'

export type EstadoFormulario = {
  enviado: boolean
  errores?: Record<string, string[]>
}

export async function accionReportarMascota(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true } // bot: descartar en silencio
  const entrada = {
    tipo_reporte: formData.get('tipo_reporte'),
    especie: formData.get('especie'),
    nombre: (formData.get('nombre') as string) || undefined,
    municipio_id: (formData.get('municipio_id') as string) || undefined,
    ultima_ubicacion: (formData.get('ultima_ubicacion') as string) || undefined,
    descripcion: formData.get('descripcion'),
    contacto_nombre: formData.get('contacto_nombre'),
    contacto_telefono: formData.get('contacto_telefono'),
    fotos: formData.getAll('fotos') as string[],
  }
  const res = await reportarMascota(entrada)
  if (!res.ok) return { enviado: false, errores: res.errores }
  return { enviado: true }
}
