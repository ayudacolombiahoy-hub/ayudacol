import { z } from 'zod'

export const CATEGORIAS = [
  'alimentos', 'agua', 'albergue', 'materiales_construccion',
  'remocion_escombros', 'salud', 'rescate', 'animales', 'otro',
] as const
export const URGENCIAS = ['alta', 'media', 'baja'] as const
export const HABILIDADES = [
  'medico', 'psicologo', 'remocion_escombros', 'logistica',
  'transporte', 'construccion', 'otro',
] as const
export const TIPOS_SERVICIO = ['alojamiento', 'transporte', 'maquinaria', 'bodega', 'otro'] as const

const telefono = z.string().trim().min(7).max(30)
const nombre = z.string().trim().min(2).max(120)
const opcionalTexto = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

export const esquemaNecesidad = z.object({
  categoria: z.enum(CATEGORIAS),
  descripcion: z.string().trim().min(10).max(2000),
  personas_afectadas: z.coerce.number().int().positive().max(100000).optional(),
  urgencia: z.enum(URGENCIAS),
  municipio_id: z.string().trim().min(1),
  detalle_ubicacion: opcionalTexto(500),
  contacto_nombre: nombre,
  contacto_telefono: telefono,
})

export const esquemaVoluntario = z.object({
  nombre: nombre,
  habilidades: z.array(z.enum(HABILIDADES)).min(1),
  disponibilidad: opcionalTexto(300),
  municipio_id: z.string().trim().min(1),
  contacto_telefono: telefono,
})

export const esquemaServicio = z.object({
  tipo: z.enum(TIPOS_SERVICIO),
  descripcion: z.string().trim().min(10).max(2000),
  capacidad: opcionalTexto(200),
  municipio_id: z.string().trim().min(1),
  contacto_nombre: nombre,
  contacto_telefono: telefono,
})

export type DatosNecesidad = z.infer<typeof esquemaNecesidad>
export type DatosVoluntario = z.infer<typeof esquemaVoluntario>
export type DatosServicio = z.infer<typeof esquemaServicio>

// Robusto entre versiones de zod (usa .issues, presente en v3 y v4).
export function erroresPorCampo(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const campo = issue.path.join('.') || '_'
    ;(out[campo] ??= []).push(issue.message)
  }
  return out
}

export const TIPOS_ORGANIZACION = ['ong', 'alcaldia', 'bomberos', 'iglesia', 'empresa', 'comunitaria'] as const
export const ESTADOS_ACOPIO = ['activo', 'lleno', 'cerrado'] as const

// Convierte "agua, alimentos" o un arreglo en string[] limpio.
const listaTexto = z.preprocess((v) => {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}, z.array(z.string()).max(30))

export const esquemaAcopio = z.object({
  nombre: z.string().trim().min(2).max(160),
  direccion: z.string().trim().min(3).max(300),
  municipio_id: z.string().trim().min(1),
  horarios: opcionalTexto(200),
  contacto_publico: opcionalTexto(160),
  recibe: listaTexto,
  no_necesita: listaTexto,
})

export const esquemaOrganizacion = z.object({
  nombre: z.string().trim().min(2).max(200),
  tipo: z.enum(TIPOS_ORGANIZACION),
  descripcion: opcionalTexto(1000),
  contacto_publico: opcionalTexto(160),
})

export type DatosAcopio = z.infer<typeof esquemaAcopio>
export type DatosOrganizacion = z.infer<typeof esquemaOrganizacion>

export const esquemaCampana = z.object({
  titulo_es: z.string().trim().min(3).max(200),
  titulo_en: z.string().trim().min(3).max(200),
  descripcion_es: z.string().trim().min(10).max(1000),
  descripcion_en: z.string().trim().min(10).max(1000),
  organizacion: z.string().trim().min(2).max(200),
  url: z.string().trim().url().max(500),
})

export type DatosCampana = z.infer<typeof esquemaCampana>

export const esquemaNovedad = z.object({
  titulo_es: z.string().trim().min(3).max(200),
  titulo_en: z.string().trim().min(3).max(200),
  contenido_es: z.string().trim().min(10).max(5000),
  contenido_en: z.string().trim().min(10).max(5000),
})

export type DatosNovedad = z.infer<typeof esquemaNovedad>

export const esquemaSuscripcion = z.object({
  email: z.string().trim().email().max(200),
  municipio_id: z.string().trim().max(20).optional().or(z.literal('')),
})

export type DatosSuscripcion = z.infer<typeof esquemaSuscripcion>

export const ESTADOS_ALBERGUE = ['abierto', 'lleno', 'cerrado'] as const

export const esquemaAlbergue = z.object({
  nombre: z.string().trim().min(2).max(160),
  direccion: z.string().trim().min(3).max(300),
  municipio_id: z.string().trim().min(1),
  capacidad: z.coerce.number().int().min(0).optional(),
  ocupacion: z.coerce.number().int().min(0).optional(),
  contacto_publico: opcionalTexto(160),
  estado: z.enum(ESTADOS_ALBERGUE).optional(),
})

export type DatosAlbergue = z.infer<typeof esquemaAlbergue>

export const ESTADOS_PERSONA = ['buscando', 'encontrada', 'cerrado'] as const

export const esquemaDesaparecido = z.object({
  nombre: z.string().trim().min(2).max(160),
  edad: z.coerce.number().int().min(0).max(129).optional(),
  descripcion: z.string().trim().min(5).max(2000),
  municipio_id: z.string().trim().max(20).optional().or(z.literal('')),
  ultima_ubicacion: opcionalTexto(500),
  contacto_nombre: nombre,
  contacto_telefono: telefono,
})

export type DatosDesaparecido = z.infer<typeof esquemaDesaparecido>

export const TIPOS_REPORTE_MASCOTA = ['perdida', 'encontrada'] as const
export const ESPECIES_MASCOTA = ['perro', 'gato', 'ave', 'otro'] as const
export const ESTADOS_MASCOTA = ['activo', 'reunida', 'cerrado'] as const

export const esquemaMascota = z.object({
  tipo_reporte: z.enum(TIPOS_REPORTE_MASCOTA),
  especie: z.enum(ESPECIES_MASCOTA),
  nombre: opcionalTexto(120),
  descripcion: z.string().trim().min(5).max(2000),
  municipio_id: z.string().trim().max(20).optional().or(z.literal('')),
  ultima_ubicacion: opcionalTexto(500),
  contacto_nombre: nombre,
  contacto_telefono: telefono,
})

export type DatosMascota = z.infer<typeof esquemaMascota>

export const ESTADOS_REFUGIO = ['abierto', 'lleno', 'cerrado'] as const

export const esquemaRefugio = z.object({
  nombre: z.string().trim().min(2).max(160),
  direccion: z.string().trim().min(3).max(300),
  municipio_id: z.string().trim().min(1),
  capacidad: z.coerce.number().int().min(0).optional(),
  ocupacion: z.coerce.number().int().min(0).optional(),
  especies: opcionalTexto(200),
  contacto_publico: opcionalTexto(160),
  estado: z.enum(ESTADOS_REFUGIO).optional(),
})

export type DatosRefugio = z.infer<typeof esquemaRefugio>
