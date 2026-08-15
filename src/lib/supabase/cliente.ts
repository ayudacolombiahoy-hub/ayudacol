import { createClient } from '@supabase/supabase-js'

// Cliente anónimo para lecturas públicas. Forzamos `cache: 'no-store'` en cada
// petición para que Next.js NUNCA cachee estos datos: durante la emergencia la
// información cambia en tiempo real y una lista cacheada (p. ej. vacía) no debe
// quedar servida a los usuarios.
export function crearClienteAnonimo() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  )
}
