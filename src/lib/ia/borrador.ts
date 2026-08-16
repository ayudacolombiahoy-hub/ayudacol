import { CATEGORIAS, URGENCIAS, ESPECIES_MASCOTA, TIPOS_REPORTE_MASCOTA } from '@/lib/validacion/esquemas'
import { limpiarTelefonos, mapearMunicipio, sectorDe } from '@/lib/importacion/mapeo'
import { clasificarContacto } from '@/lib/contacto'

export type TipoEntidad = 'necesidad' | 'mascota' | 'desaparecido' | 'acopio' | 'albergue'

export type BorradorCrudo = {
  tipo: TipoEntidad | 'desconocido'
  descripcion: string
  ubicacion_texto: string
  confianza: 'alta' | 'media' | 'baja'
  contacto: string | null
  contacto_nombre: string | null
  contacto_publico: string | null
  categoria: string | null
  urgencia: string | null
  personas_afectadas: number | null
  especie: string | null
  tipo_reporte: string | null
  nombre_mascota: string | null
  nombre_persona: string | null
  edad: number | null
  nombre_lugar: string | null
  direccion: string | null
  recibe: string | null
  no_necesita: string | null
  horarios: string | null
  capacidad: number | null
  foto_url?: string
}

export type Bandera =
  | 'categoria_incierta' | 'municipio_sin_mapear' | 'descripcion_corta'
  | 'sin_contacto' | 'sin_nombre' | 'falta_especie' | 'falta_nombre' | 'falta_direccion'

export type Borrador = {
  tipo: TipoEntidad
  descripcion: string
  municipio_id: string
  municipio_nombre: string
  detalle_ubicacion: string
  confianza: 'alta' | 'media' | 'baja'
  banderas: Bandera[]
  contacto_telefono: string
  contacto_nombre: string
  contacto_publico: string
  categoria: string
  urgencia: string
  personas_afectadas: number | null
  especie: string
  tipo_reporte: string
  nombre: string
  edad: number | null
  direccion: string
  recibe: string
  no_necesita: string
  horarios: string
  capacidad: number | null
  foto_url?: string
}

const enCatalogo = <T extends readonly string[]>(v: string, lista: T, fallback: T[number]): T[number] =>
  (lista as readonly string[]).includes(v) ? (v as T[number]) : fallback

const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)

export function normalizarBorradores(crudos: BorradorCrudo[]): { borradores: Borrador[]; descartados: number } {
  const borradores: Borrador[] = []
  let descartados = 0
  const TIPOS: TipoEntidad[] = ['necesidad', 'mascota', 'desaparecido', 'acopio', 'albergue']

  for (const c of crudos) {
    if (!TIPOS.includes(c.tipo as TipoEntidad)) { descartados++; continue }
    const tipo = c.tipo as TipoEntidad

    const descripcion = limpiarTelefonos(s(c.descripcion))
    const muni = mapearMunicipio(s(c.ubicacion_texto))
    const detalle_ubicacion = sectorDe(s(c.ubicacion_texto)) || (muni?.nombre ?? '')

    const contactoRaw = s(c.contacto)
    const contacto_telefono = tipo === 'necesidad'
      ? (clasificarContacto(contactoRaw) === 'telefono' ? contactoRaw.replace(/\D/g, '') : contactoRaw)
      : contactoRaw.replace(/\D/g, '')
    const contacto_nombre = s(c.contacto_nombre)
    const contacto_publico = s(c.contacto_publico)

    const nombre = s(c.nombre_mascota) || s(c.nombre_persona) || s(c.nombre_lugar)
    const direccion = s(c.direccion) || s(c.ubicacion_texto)

    const banderas: Bandera[] = []
    if (c.confianza === 'baja') banderas.push('categoria_incierta')
    if (!muni) banderas.push('municipio_sin_mapear')
    if ((tipo === 'necesidad' || tipo === 'mascota' || tipo === 'desaparecido') && !contacto_telefono) banderas.push('sin_contacto')
    if ((tipo === 'acopio' || tipo === 'albergue') && !contacto_publico) banderas.push('sin_contacto')
    if (tipo === 'mascota' && !s(c.especie)) banderas.push('falta_especie')
    if ((tipo === 'desaparecido' || tipo === 'acopio' || tipo === 'albergue') && !nombre) banderas.push('falta_nombre')
    if ((tipo === 'acopio' || tipo === 'albergue') && !direccion) banderas.push('falta_direccion')

    borradores.push({
      tipo,
      descripcion,
      municipio_id: muni?.municipio_id ?? '',
      municipio_nombre: muni?.nombre ?? '',
      detalle_ubicacion,
      confianza: c.confianza,
      banderas,
      contacto_telefono,
      contacto_nombre,
      contacto_publico,
      categoria: enCatalogo(s(c.categoria), CATEGORIAS, 'otro'),
      urgencia: enCatalogo(s(c.urgencia), URGENCIAS, 'media'),
      personas_afectadas: num(c.personas_afectadas),
      especie: enCatalogo(s(c.especie), ESPECIES_MASCOTA, 'otro'),
      tipo_reporte: enCatalogo(s(c.tipo_reporte), TIPOS_REPORTE_MASCOTA, 'perdida'),
      nombre,
      edad: num(c.edad),
      direccion,
      recibe: s(c.recibe),
      no_necesita: s(c.no_necesita),
      horarios: s(c.horarios),
      capacidad: num(c.capacidad),
      foto_url: c.foto_url,
    })
  }
  return { borradores, descartados }
}
