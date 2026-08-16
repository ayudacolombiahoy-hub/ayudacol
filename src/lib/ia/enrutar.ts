import type { Borrador } from './borrador'

// Convierte un Borrador (superset) en la `entrada` que espera el helper de su tipo.
// Los helpers validan con su Zod; aquí solo se mapean campos. La foto viaja aparte
// en `foto_url` para mascota/desaparecido (los helpers la leen de la entrada cruda).
export function armarEntrada(b: Borrador): Record<string, unknown> {
  switch (b.tipo) {
    case 'necesidad':
      return {
        categoria: b.categoria, descripcion: b.descripcion,
        personas_afectadas: b.personas_afectadas && b.personas_afectadas > 0 ? b.personas_afectadas : undefined,
        urgencia: b.urgencia, municipio_id: b.municipio_id, detalle_ubicacion: b.detalle_ubicacion,
        contacto_nombre: b.contacto_nombre, contacto_telefono: b.contacto_telefono,
      }
    case 'mascota':
      return {
        tipo_reporte: b.tipo_reporte, especie: b.especie, nombre: b.nombre, descripcion: b.descripcion,
        municipio_id: b.municipio_id, ultima_ubicacion: b.detalle_ubicacion,
        contacto_nombre: b.contacto_nombre, contacto_telefono: b.contacto_telefono, foto_url: b.foto_url,
      }
    case 'desaparecido':
      return {
        nombre: b.nombre, edad: b.edad ?? undefined, descripcion: b.descripcion,
        municipio_id: b.municipio_id, ultima_ubicacion: b.detalle_ubicacion,
        contacto_nombre: b.contacto_nombre, contacto_telefono: b.contacto_telefono, foto_url: b.foto_url,
      }
    case 'acopio':
      return {
        nombre: b.nombre, direccion: b.direccion, municipio_id: b.municipio_id,
        horarios: b.horarios, contacto_publico: b.contacto_publico, recibe: b.recibe, no_necesita: b.no_necesita,
      }
    case 'albergue':
      return {
        nombre: b.nombre, direccion: b.direccion, municipio_id: b.municipio_id,
        capacidad: b.capacidad ?? undefined, contacto_publico: b.contacto_publico,
      }
  }
}
