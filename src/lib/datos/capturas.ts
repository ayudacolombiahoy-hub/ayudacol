import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaNecesidad } from '@/lib/validacion/esquemas'
import type { Borrador } from '@/lib/ia/borrador'
import { armarEntrada } from '@/lib/ia/enrutar'
import { reportarMascota } from '@/lib/datos/mascotas'
import { reportarDesaparecido } from '@/lib/datos/desaparecidos'
import { proponerAcopio } from '@/lib/datos/acopios-publico'
import { crearAlbergue } from '@/lib/datos/albergues'

export type ResumenGuardado = { insertadas: number; actualizadas: number; duplicadas: number; errores: number }

// Guarda un lote de borradores (superset) enrutando cada uno a su entidad.
// Necesidad: dedup por (contacto_telefono, descripcion) + agrega imagen a la existente.
// Otros tipos: su helper público/autenticado (con su propia validación y estado inicial).
export async function guardarLote(borradores: Borrador[]): Promise<ResumenGuardado> {
  const sb = await crearClienteServidor()
  const r: ResumenGuardado = { insertadas: 0, actualizadas: 0, duplicadas: 0, errores: 0 }

  for (const b of borradores) {
    if (b.tipo === 'necesidad') {
      const p = esquemaNecesidad.safeParse(armarEntrada(b))
      if (!p.success) { r.errores++; continue }
      const { data: dup } = await sb.from('solicitudes_ayuda').select('id, fotos')
        .eq('contacto_telefono', p.data.contacto_telefono).eq('descripcion', p.data.descripcion).limit(1).maybeSingle()
      if (dup) {
        const sinFoto = !Array.isArray(dup.fotos) || dup.fotos.length === 0
        if (b.foto_url && sinFoto) {
          const { error } = await sb.from('solicitudes_ayuda').update({ fotos: [b.foto_url] }).eq('id', dup.id)
          if (error) r.errores++; else r.actualizadas++
        } else r.duplicadas++
        continue
      }
      const { error } = await sb.from('solicitudes_ayuda')
        .insert({ ...p.data, estado: 'sin_verificar', origen: 'whatsapp', fotos: b.foto_url ? [b.foto_url] : [] })
      if (error) r.errores++; else r.insertadas++
      continue
    }

    const entrada = armarEntrada(b)
    const res =
      b.tipo === 'mascota' ? await reportarMascota(entrada)
      : b.tipo === 'desaparecido' ? await reportarDesaparecido(entrada)
      : b.tipo === 'acopio' ? await proponerAcopio(entrada)
      : await crearAlbergue(entrada)
    if (res.ok) r.insertadas++; else r.errores++
  }
  return r
}
