'use server'
import { proponerAcopio } from '@/lib/datos/acopios-publico'

export type EstadoFormulario = {
  enviado: boolean
  errores?: Record<string, string[]>
}

export async function accionProponerAcopio(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if ((formData.get('sitio_web') as string)?.length) return { enviado: true } // bot: descartar en silencio
  const entrada = {
    nombre: formData.get('nombre'),
    direccion: formData.get('direccion'),
    municipio_id: formData.get('municipio_id'),
    horarios: (formData.get('horarios') as string) || undefined,
    contacto_publico: formData.get('contacto_publico'),
    recibe: (formData.get('recibe') as string) || '',
    no_necesita: (formData.get('no_necesita') as string) || '',
    fotos: formData.getAll('fotos') as string[],
  }
  const res = await proponerAcopio(entrada)
  if (!res.ok) return { enviado: false, errores: res.errores }
  return { enviado: true }
}
