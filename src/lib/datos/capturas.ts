import { crearClienteServidor } from '@/lib/supabase/servidor'
import { esquemaNecesidad } from '@/lib/validacion/esquemas'
import type { Borrador } from '@/lib/ia/borrador'

export type ResumenGuardado = { insertadas: number; duplicadas: number; errores: number }

// Inserta un lote de borradores de necesidad como sin_verificar/whatsapp.
// Usa el cliente autenticado (moderador): la RLS permite el insert del equipo.
// Anti-duplicado por (contacto_telefono, descripcion), igual que el import CLI.
export async function guardarLoteNecesidades(borradores: Borrador[]): Promise<ResumenGuardado> {
  const sb = await crearClienteServidor()
  const resumen: ResumenGuardado = { insertadas: 0, duplicadas: 0, errores: 0 }

  for (const b of borradores) {
    const entrada = {
      categoria: b.categoria,
      descripcion: b.descripcion,
      personas_afectadas: b.personas_afectadas && b.personas_afectadas > 0 ? b.personas_afectadas : undefined,
      urgencia: b.urgencia,
      municipio_id: b.municipio_id,
      detalle_ubicacion: b.detalle_ubicacion,
      contacto_nombre: b.contacto_nombre,
      contacto_telefono: b.contacto_telefono,
    }
    const p = esquemaNecesidad.safeParse(entrada)
    if (!p.success) { resumen.errores++; continue }

    const { data: dup } = await sb
      .from('solicitudes_ayuda')
      .select('id')
      .eq('contacto_telefono', p.data.contacto_telefono)
      .eq('descripcion', p.data.descripcion)
      .limit(1)
      .maybeSingle()
    if (dup) { resumen.duplicadas++; continue }

    const { error } = await sb
      .from('solicitudes_ayuda')
      .insert({ ...p.data, estado: 'sin_verificar', origen: 'whatsapp', fotos: b.foto_url ? [b.foto_url] : [] })
    if (error) resumen.errores++
    else resumen.insertadas++
  }
  return resumen
}
