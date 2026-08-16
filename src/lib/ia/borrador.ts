import { CATEGORIAS, URGENCIAS } from '@/lib/validacion/esquemas'
import { limpiarTelefonos, mapearMunicipio, sectorDe } from '@/lib/importacion/mapeo'
import { clasificarContacto } from '@/lib/contacto'

export type BorradorCrudo = {
  tipo: 'necesidad' | 'desconocido'
  categoria: string
  urgencia: string
  personas_afectadas: number | null
  descripcion: string
  ubicacion_texto: string
  contacto_nombre: string | null
  contacto: string | null
  confianza: 'alta' | 'media' | 'baja'
  foto_url?: string
}

export type Bandera =
  | 'categoria_incierta' | 'municipio_sin_mapear' | 'descripcion_corta'
  | 'sin_contacto' | 'sin_nombre'

export type Borrador = {
  tipo: 'necesidad'
  categoria: string
  urgencia: string
  personas_afectadas: number | null
  descripcion: string
  detalle_ubicacion: string
  municipio_id: string
  municipio_nombre: string
  contacto_nombre: string
  contacto_telefono: string
  confianza: 'alta' | 'media' | 'baja'
  banderas: Bandera[]
  foto_url?: string
}

const enCatalogo = <T extends readonly string[]>(v: string, lista: T, fallback: T[number]): T[number] =>
  (lista as readonly string[]).includes(v) ? (v as T[number]) : fallback

export function normalizarBorradores(crudos: BorradorCrudo[]): { borradores: Borrador[]; descartados: number } {
  const borradores: Borrador[] = []
  let descartados = 0
  for (const c of crudos) {
    if (c.tipo !== 'necesidad') { descartados++; continue }

    const descripcion = limpiarTelefonos(String(c.descripcion ?? ''))
    const muni = mapearMunicipio(String(c.ubicacion_texto ?? ''))
    const detalle_ubicacion = sectorDe(String(c.ubicacion_texto ?? '')) || (muni?.nombre ?? '')
    const contactoRaw = String(c.contacto ?? '').trim()
    // Teléfono → solo dígitos; @usuario o enlace → tal cual.
    const contacto_telefono = clasificarContacto(contactoRaw) === 'telefono' ? contactoRaw.replace(/\D/g, '') : contactoRaw
    const contacto_nombre = String(c.contacto_nombre ?? '').trim()

    const banderas: Bandera[] = []
    if (c.confianza === 'baja') banderas.push('categoria_incierta')
    if (!muni) banderas.push('municipio_sin_mapear')
    if (descripcion.length < 10) banderas.push('descripcion_corta')
    if (!contacto_telefono) banderas.push('sin_contacto')
    if (!contacto_nombre) banderas.push('sin_nombre')

    borradores.push({
      tipo: 'necesidad',
      categoria: enCatalogo(String(c.categoria), CATEGORIAS, 'otro'),
      urgencia: enCatalogo(String(c.urgencia), URGENCIAS, 'media'),
      personas_afectadas: typeof c.personas_afectadas === 'number' ? c.personas_afectadas : null,
      descripcion,
      detalle_ubicacion,
      municipio_id: muni?.municipio_id ?? '',
      municipio_nombre: muni?.nombre ?? '',
      contacto_nombre,
      contacto_telefono,
      confianza: c.confianza,
      banderas,
      foto_url: c.foto_url,
    })
  }
  return { borradores, descartados }
}
