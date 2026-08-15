import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/es/panel'

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)
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
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // supabase-js >= 2.91.0 difiere el evento SIGNED_IN con setTimeout(0), y ese
      // evento es el que escribe las cookies de sesión vía el adaptador de @supabase/ssr.
      // Sin este flush, el handler devuelve la respuesta ANTES de que se escriban las
      // cookies → sesión creada en el servidor pero sin cookie en el navegador → rebote a /entrar.
      await new Promise((r) => setTimeout(r, 0))
      return response
    }
  }
  return NextResponse.redirect(`${origin}/es/entrar?error=auth`)
}
