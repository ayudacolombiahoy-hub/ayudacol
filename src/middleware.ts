import { type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { routing } from './i18n/routing'

const intl = createIntlMiddleware(routing)

export async function middleware(request: NextRequest) {
  // 1) Enrutado de idioma (redirige/reescribe según locale)
  const response = intl(request)

  // 2) Refresco de sesión de Supabase sobre esa misma respuesta
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  await supabase.auth.getUser()
  // Mismo bug que en el callback: supabase-js >= 2.91.0 difiere el evento que escribe
  // las cookies (SIGNED_IN/TOKEN_REFRESHED). Este flush deja que corra antes de responder,
  // evitando que un refresco de token pierda la sesión.
  await new Promise((r) => setTimeout(r, 0))

  return response
}

export const config = {
  // Todo excepto estáticos, api y las rutas /auth (que manejan su propia sesión)
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
}
