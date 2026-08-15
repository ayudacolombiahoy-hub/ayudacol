import { crearClienteAnonimo } from '@/lib/supabase/cliente'

export async function listarCasosAliados() {
  const sb = crearClienteAnonimo()
  const { data, error } = await sb.from('casos_aliados_publicos').select('*')
  if (error) throw new Error(error.message)
  return data ?? []
}
