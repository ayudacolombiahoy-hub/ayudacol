import { crearClienteServidor } from '@/lib/supabase/servidor'

export type Rol = 'admin' | 'moderador' | 'org'

export type Perfil = {
  id: string
  nombre: string
  rol: Rol
  organizacion_id: string | null
  email: string | undefined
}

export const ROLES_PANEL: Rol[] = ['admin', 'moderador']

export async function obtenerPerfil(): Promise<Perfil | null> {
  const sb = await crearClienteServidor()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb
    .from('perfiles')
    .select('id, nombre, rol, organizacion_id')
    .eq('id', user.id)
    .single()
  if (!data) return null
  return { ...data, email: user.email }
}
