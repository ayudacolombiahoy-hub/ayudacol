# Plan 3 — Autenticación + Panel de Moderación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los moderadores (cuentas provisionadas por el admin) entren con un enlace mágico por email y, desde un panel protegido, vean la cola de reportes "sin verificar"/"por reconfirmar" con el contacto visible, y los verifiquen / rechacen / marquen duplicado usando la máquina de estados; además puedan transcribir reportes que llegan por WhatsApp.

**Architecture:** Supabase Auth con **magic link (passwordless)** vía **`@supabase/ssr`** (sesión en cookies). Un middleware combina el enrutado de idioma (next-intl) con el refresco de sesión de Supabase. Las cuentas se provisionan con un script de `service_role` (sin registro público). El panel es un Server Component protegido por rol; las acciones son Server Actions que usan el **cliente de servidor autenticado** (el RLS del Plan 1 ya permite a moderadores leer con contacto y actualizar). **No requiere migración nueva.**

**Tech Stack:** Next.js 16 (App Router, middleware, Server Actions) · `@supabase/ssr` · Supabase Auth (OTP/magic link) · next-intl · zod · Vitest.

**Spec:** `docs/superpowers/specs/...-design.md` (§5 flujo de verificación y roles).
**Base:** Planes 1 y 2 en `main`. RLS relevante ya existente (Plan 1, migración 0002): `equipo_lee_solicitudes` (moderador/admin SELECT sobre la tabla base, ve contacto), `equipo_edita_solicitudes` (UPDATE), `usuario_lee_su_perfil`, y `reporte_publico_solicitudes` (INSERT sin_verificar para `anon, authenticated`). `src/lib/estados.ts` con `puedeTransicionar(desde, hacia, rol)`.

**Roadmap:** 1) Fundación ✓ · 2) Flujo público ✓ · 3) **Auth + moderación** ← este · 3b) Organizaciones (aprobación, dashboard, tomar/resolver, acopios) · 4) Visualizador + mapa + tiempo real · 5) Estadísticas + despliegue.

---

## ⚙️ Configuración manual previa en Supabase (una vez)

Antes de la Task 4, en el dashboard de Supabase:
1. **Authentication → URL Configuration → Redirect URLs:** añadir `http://localhost:3000/auth/callback` (y más tarde la URL de producción). Sin esto, el magic link es rechazado.
2. **Authentication → Providers → Email:** dejar habilitado "Email" con "Magic Link". En free tier el correo de Supabase sirve para pruebas (con límite de ~pocos por hora); para producción se configura SMTP propio (Plan 5).

---

## Estructura de archivos

```
src/lib/supabase/navegador.ts        ← createBrowserClient (@supabase/ssr)
src/lib/supabase/servidor.ts         ← createServerClient con cookies (async)
src/lib/auth/sesion.ts               ← obtenerPerfil(), type Perfil, ROLES_PANEL
src/middleware.ts                    ← (modificar) next-intl + refresco de sesión
src/app/[locale]/entrar/page.tsx     ← login magic link (client)
src/app/auth/callback/route.ts       ← intercambia code por sesión (no localizado)
src/lib/datos/moderacion.ts          ← listarCola(), cambiarEstadoSolicitud(), crearTranscripcion()
src/app/[locale]/panel/page.tsx      ← panel protegido (cola)
src/app/[locale]/panel/acciones.ts   ← server actions verificar/rechazar/duplicar/transcribir + salir
src/app/[locale]/panel/FilaSolicitud.tsx   ← fila con botones (client)
src/app/[locale]/panel/FormularioTranscripcion.tsx ← form WhatsApp (client)
src/componentes/BotonSalir.tsx       ← logout (client)
scripts/crear-perfil.mjs             ← provisiona perfiles (service_role)
tests/unit/moderacion.test.ts        ← lógica de decisión de acciones (unit)
```
Se modifican `src/messages/{es,en}.json` (claves `auth`, `panel`) y `src/componentes/Navegacion.tsx` (enlace a "Entrar"/"Panel").

---

### Task 1: Dependencia y clientes SSR de Supabase

**Files:**
- Create: `src/lib/supabase/navegador.ts`, `src/lib/supabase/servidor.ts`
- Modify: `package.json`

- [ ] **Step 1: Instalar @supabase/ssr**

Run: `npm install @supabase/ssr`
Expected: 0 vulnerabilidades; aparece en `dependencies`.

- [ ] **Step 2: Cliente de navegador** — `src/lib/supabase/navegador.ts`

```ts
import { createBrowserClient } from '@supabase/ssr'

export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 3: Cliente de servidor** — `src/lib/supabase/servidor.ts`

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function crearClienteServidor() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Llamado desde un Server Component: el middleware refresca la sesión.
          }
        },
      },
    },
  )
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/supabase/navegador.ts src/lib/supabase/servidor.ts
git commit -m "feat: clientes Supabase SSR (navegador y servidor) para auth"
```

---

### Task 2: Middleware combinado (idioma + sesión)

El middleware actual solo hace enrutado de idioma. Debe además refrescar la sesión de Supabase en cada navegación, y NO localizar las rutas `/auth/*`.

**Files:**
- Modify: `src/middleware.ts` (reemplazo completo)

- [ ] **Step 1: Reemplazar `src/middleware.ts`**

```ts
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

  return response
}

export const config = {
  // Todo excepto estáticos, api y las rutas /auth (que manejan su propia sesión)
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
}
```

- [ ] **Step 2: Smoke test — el sitio sigue funcionando y redirige idioma**

```bash
npm run dev > /tmp/p3dev.log 2>&1 &
sleep 9
curl -s -o /dev/null -w "raiz=%{http_code} es=%{http_code}\n" http://localhost:3000/
curl -s http://localhost:3000/es | grep -o "Ayuda verificada" | head -1
pkill -f "next dev"; pkill -f "next-server"
```
Expected: la raíz redirige (307) y `/es` responde con el título. Sin errores en el log. Matar el server.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: middleware combina enrutado i18n con refresco de sesión Supabase"
```

---

### Task 3: Helper de sesión/rol + script de provisión

**Files:**
- Create: `src/lib/auth/sesion.ts`, `scripts/crear-perfil.mjs`

- [ ] **Step 1: Helper de sesión** — `src/lib/auth/sesion.ts`

```ts
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
```

- [ ] **Step 2: Script de provisión** — `scripts/crear-perfil.mjs`

```js
// Crea/actualiza el perfil (rol) de un usuario ya existente en Supabase Auth.
// El usuario debe haber iniciado sesión al menos una vez (magic link) para existir en auth.users.
// Uso: node scripts/crear-perfil.mjs <email> <admin|moderador|org> [nombre]
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const [email, rol, nombre] = process.argv.slice(2)
if (!email || !['admin', 'moderador', 'org'].includes(rol)) {
  console.error('Uso: node scripts/crear-perfil.mjs <email> <admin|moderador|org> [nombre]')
  process.exit(1)
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Buscar el usuario por email en auth.users (vía admin API)
let usuario = null
for (let pagina = 1; pagina <= 20 && !usuario; pagina++) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 })
  if (error) { console.error('Error listando usuarios:', error.message); process.exit(1) }
  usuario = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (data.users.length < 200) break
}
if (!usuario) {
  console.error(`No existe un usuario con email ${email}. Pídele que inicie sesión una vez (magic link) y reintenta.`)
  process.exit(1)
}

const { error } = await admin.from('perfiles').upsert({
  id: usuario.id,
  nombre: nombre ?? email.split('@')[0],
  rol,
})
if (error) { console.error('Error creando perfil:', error.message); process.exit(1) }
console.log(`✅ Perfil ${rol} asignado a ${email} (${usuario.id})`)
```

- [ ] **Step 3: Verificar tipos y que el script carga**

Run: `npx tsc --noEmit && node --check scripts/crear-perfil.mjs && echo OK`
Expected: `OK` (tsc sin errores; el script es sintácticamente válido).

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/sesion.ts scripts/crear-perfil.mjs
git commit -m "feat: helper de sesión/rol y script de provisión de perfiles (service_role)"
```

---

### Task 4: Mensajes i18n de auth y panel

**Files:**
- Modify: `src/messages/es.json`, `src/messages/en.json`

- [ ] **Step 1: Añadir a `es.json`**

```json
"auth": {
  "entrar": "Entrar",
  "salir": "Salir",
  "panel": "Panel",
  "email": "Correo electrónico",
  "enviarEnlace": "Enviarme un enlace",
  "revisaCorreo": "Te enviamos un enlace de acceso. Revisa tu correo.",
  "errorAcceso": "No pudimos iniciar sesión. Solicita un enlace nuevo.",
  "soloEquipo": "Acceso solo para el equipo autorizado."
},
"panel": {
  "titulo": "Cola de moderación",
  "sinPendientes": "No hay reportes pendientes de verificación. 🎉",
  "verificar": "Verificar",
  "rechazar": "Rechazar",
  "duplicar": "Duplicado",
  "contacto": "Contacto",
  "origen": "Origen",
  "noAutorizado": "Tu cuenta no tiene permiso para el panel.",
  "transcribir": "Transcribir reporte de WhatsApp",
  "guardarTranscripcion": "Guardar reporte"
}
```

- [ ] **Step 2: Añadir a `en.json`**

```json
"auth": {
  "entrar": "Sign in",
  "salir": "Sign out",
  "panel": "Panel",
  "email": "Email",
  "enviarEnlace": "Send me a link",
  "revisaCorreo": "We sent you a sign-in link. Check your email.",
  "errorAcceso": "We couldn't sign you in. Request a new link.",
  "soloEquipo": "Access restricted to the authorized team."
},
"panel": {
  "titulo": "Moderation queue",
  "sinPendientes": "No reports pending verification. 🎉",
  "verificar": "Verify",
  "rechazar": "Reject",
  "duplicar": "Duplicate",
  "contacto": "Contact",
  "origen": "Source",
  "noAutorizado": "Your account is not allowed in the panel.",
  "transcribir": "Transcribe WhatsApp report",
  "guardarTranscripcion": "Save report"
}
```

- [ ] **Step 3: Verificar paridad**

Run: `npm test -- tests/unit/mensajes-paridad.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/messages/es.json src/messages/en.json
git commit -m "i18n: claves de autenticación y panel de moderación"
```

---

### Task 5: Login por magic link + callback + logout

**Files:**
- Create: `src/app/[locale]/entrar/page.tsx`, `src/app/auth/callback/route.ts`, `src/componentes/BotonSalir.tsx`

- [ ] **Step 1: Página de login** — `src/app/[locale]/entrar/page.tsx`

```tsx
'use client'
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { crearClienteNavegador } from '@/lib/supabase/navegador'

export default function Entrar() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(false)
    const sb = crearClienteNavegador()
    const redirectTo = `${window.location.origin}/auth/callback?next=/${locale}/panel`
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    if (error) setError(true)
    else setEnviado(true)
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-2 text-2xl font-extrabold">{t('entrar')}</h1>
      <p className="mb-6 text-sm text-gray-500">{t('soloEquipo')}</p>
      {enviado ? (
        <p className="rounded-lg bg-green-100 p-4 text-green-900">{t('revisaCorreo')}</p>
      ) : (
        <form onSubmit={enviar}>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold">{t('email')}</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          {error && <p className="mb-3 text-sm text-red-600">{t('errorAcceso')}</p>}
          <button type="submit" className="rounded-lg bg-blue-700 px-5 py-2.5 font-bold text-white">
            {t('enviarEnlace')}
          </button>
        </form>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Ruta de callback** — `src/app/auth/callback/route.ts`

```ts
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
    if (!error) return response
  }
  return NextResponse.redirect(`${origin}/es/entrar?error=auth`)
}
```

- [ ] **Step 3: Botón de salir** — `src/componentes/BotonSalir.tsx`

```tsx
'use client'
import { useRouter } from '@/i18n/navegacion'
import { useTranslations } from 'next-intl'
import { crearClienteNavegador } from '@/lib/supabase/navegador'

export default function BotonSalir() {
  const t = useTranslations('auth')
  const router = useRouter()
  async function salir() {
    await crearClienteNavegador().auth.signOut()
    router.replace('/entrar')
    router.refresh()
  }
  return (
    <button onClick={salir} className="rounded border px-3 py-1 text-sm font-semibold">
      {t('salir')}
    </button>
  )
}
```

- [ ] **Step 4: Smoke test — la página de login carga**

```bash
npm run dev > /tmp/p3dev.log 2>&1 &
sleep 9
curl -s -o /dev/null -w "entrar_es=%{http_code} entrar_en=%{http_code}\n" http://localhost:3000/es/entrar
curl -s http://localhost:3000/es/entrar | grep -o "Entrar" | head -1
pkill -f "next dev"; pkill -f "next-server"
```
Expected: `200` en ES y EN; el grep encuentra "Entrar". (El flujo de correo se prueba manualmente.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/entrar" "src/app/auth/callback" src/componentes/BotonSalir.tsx
git commit -m "feat: login por magic link, callback de sesión y logout"
```

---

### Task 6: Capa de datos de moderación (con test unitario de decisión)

**Files:**
- Create: `src/lib/datos/moderacion.ts`, `tests/unit/moderacion.test.ts`

- [ ] **Step 1: Test que falla** — `tests/unit/moderacion.test.ts`

Prueba la función pura `decidirAccion` que traduce el botón pulsado a un estado destino y valida la transición con la máquina de estados.

```ts
import { describe, test, expect } from 'vitest'
import { decidirAccion } from '../../src/lib/datos/moderacion'

describe('decidirAccion (moderador)', () => {
  test('verificar un sin_verificar es válido', () => {
    expect(decidirAccion('sin_verificar', 'verificar')).toEqual({ ok: true, hacia: 'verificada' })
  })
  test('rechazar un sin_verificar es válido', () => {
    expect(decidirAccion('sin_verificar', 'rechazar')).toEqual({ ok: true, hacia: 'rechazada' })
  })
  test('duplicar un sin_verificar es válido', () => {
    expect(decidirAccion('sin_verificar', 'duplicar')).toEqual({ ok: true, hacia: 'duplicada' })
  })
  test('verificar un por_reconfirmar es válido', () => {
    expect(decidirAccion('por_reconfirmar', 'verificar')).toEqual({ ok: true, hacia: 'verificada' })
  })
  test('verificar algo ya resuelto es inválido', () => {
    expect(decidirAccion('resuelta', 'verificar').ok).toBe(false)
  })
})
```

Run: `npm test -- tests/unit/moderacion.test.ts` → FAIL.

- [ ] **Step 2: Implementar** — `src/lib/datos/moderacion.ts`

```ts
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { puedeTransicionar, type EstadoSolicitud } from '@/lib/estados'
import { esquemaNecesidad, erroresPorCampo } from '@/lib/validacion/esquemas'

export type AccionModeracion = 'verificar' | 'rechazar' | 'duplicar'

const DESTINO: Record<AccionModeracion, EstadoSolicitud> = {
  verificar: 'verificada',
  rechazar: 'rechazada',
  duplicar: 'duplicada',
}

// Función pura: decide el estado destino y valida la transición como moderador.
export function decidirAccion(
  actual: EstadoSolicitud,
  accion: AccionModeracion,
): { ok: true; hacia: EstadoSolicitud } | { ok: false } {
  const hacia = DESTINO[accion]
  return puedeTransicionar(actual, hacia, 'moderador') ? { ok: true, hacia } : { ok: false }
}

// Cola de moderación: reportes que esperan decisión, con contacto (RLS: solo moderador/admin).
export async function listarCola() {
  const sb = await crearClienteServidor()
  const { data, error } = await sb
    .from('solicitudes_ayuda')
    .select('*')
    .in('estado', ['sin_verificar', 'por_reconfirmar'])
    .order('creada_en', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Aplica una decisión de moderación a una solicitud.
export async function moderarSolicitud(id: string, accion: AccionModeracion) {
  const sb = await crearClienteServidor()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, motivo: 'sin_sesion' }

  const { data: fila, error: e1 } = await sb.from('solicitudes_ayuda').select('estado').eq('id', id).single()
  if (e1 || !fila) return { ok: false as const, motivo: 'no_encontrada' }

  const d = decidirAccion(fila.estado as EstadoSolicitud, accion)
  if (!d.ok) return { ok: false as const, motivo: 'transicion_invalida' }

  const parche: Record<string, unknown> = { estado: d.hacia }
  if (d.hacia === 'verificada') {
    parche.verificada_por = user.id
    parche.verificada_en = new Date().toISOString()
  }
  const { error: e2 } = await sb.from('solicitudes_ayuda').update(parche).eq('id', id)
  if (e2) return { ok: false as const, motivo: e2.message }
  return { ok: true as const }
}

// Transcripción de un reporte que llegó por WhatsApp (moderador lo captura).
export async function crearTranscripcion(entrada: unknown) {
  const p = esquemaNecesidad.safeParse(entrada)
  if (!p.success) return { ok: false as const, errores: erroresPorCampo(p.error) }
  const sb = await crearClienteServidor()
  const { error } = await sb
    .from('solicitudes_ayuda')
    .insert({ ...p.data, estado: 'sin_verificar', origen: 'whatsapp' })
  if (error) return { ok: false as const, errores: { _: [error.message] } }
  return { ok: true as const }
}
```

Run: `npm test -- tests/unit/moderacion.test.ts` → PASS (5 tests).

- [ ] **Step 3: Suite completa (sin regresiones)**

Run: `npm test`
Expected: PASS todo (los tests previos + los 5 nuevos).

- [ ] **Step 4: Commit**

```bash
git add src/lib/datos/moderacion.ts tests/unit/moderacion.test.ts
git commit -m "feat: capa de datos de moderación (cola, moderar, transcribir) + decisión validada (TDD)"
```

---

### Task 7: Panel de moderación protegido (cola + acciones)

**Files:**
- Create: `src/app/[locale]/panel/acciones.ts`, `FilaSolicitud.tsx`, `page.tsx`

- [ ] **Step 1: Server actions** — `src/app/[locale]/panel/acciones.ts`

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { moderarSolicitud, crearTranscripcion, type AccionModeracion } from '@/lib/datos/moderacion'

export async function accionModerar(id: string, accion: AccionModeracion) {
  const r = await moderarSolicitud(id, accion)
  revalidatePath('/[locale]/panel', 'page')
  return r
}

export type EstadoTranscripcion = { enviado: boolean; errores?: Record<string, string[]> }

export async function accionTranscribir(
  _prev: EstadoTranscripcion,
  formData: FormData,
): Promise<EstadoTranscripcion> {
  const entrada = {
    categoria: formData.get('categoria'),
    descripcion: formData.get('descripcion'),
    personas_afectadas: (formData.get('personas_afectadas') as string) || undefined,
    urgencia: formData.get('urgencia'),
    municipio_id: formData.get('municipio_id'),
    detalle_ubicacion: (formData.get('detalle_ubicacion') as string) || undefined,
    contacto_nombre: formData.get('contacto_nombre'),
    contacto_telefono: formData.get('contacto_telefono'),
  }
  const res = await crearTranscripcion(entrada)
  if (!res.ok) return { enviado: false, errores: res.errores }
  revalidatePath('/[locale]/panel', 'page')
  return { enviado: true }
}
```

- [ ] **Step 2: Fila con botones** — `src/app/[locale]/panel/FilaSolicitud.tsx`

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { accionModerar } from './acciones'
import type { AccionModeracion } from '@/lib/datos/moderacion'

type Solicitud = {
  id: string; categoria: string; descripcion: string; urgencia: string
  estado: string; municipio_id: string; origen: string
  contacto_nombre: string; contacto_telefono: string; creada_en: string
}

export default function FilaSolicitud({ s }: { s: Solicitud }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [oculta, setOculta] = useState(false)

  function moderar(accion: AccionModeracion) {
    start(async () => {
      const r = await accionModerar(s.id, accion)
      if (r.ok) setOculta(true)
    })
  }
  if (oculta) return null

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold">{t(`categorias.${s.categoria}`)}</span>
        <span className="text-xs text-gray-500">{t('panel.origen')}: {s.origen}</span>
      </div>
      <p className="text-sm text-gray-700">{s.descripcion}</p>
      <p className="mt-2 text-xs text-gray-600">
        📍 {s.municipio_id} · {t('panel.contacto')}: <b>{s.contacto_nombre} — {s.contacto_telefono}</b>
      </p>
      <div className="mt-3 flex gap-2">
        <button disabled={pending} onClick={() => moderar('verificar')}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
          ✓ {t('panel.verificar')}
        </button>
        <button disabled={pending} onClick={() => moderar('duplicar')}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {t('panel.duplicar')}
        </button>
        <button disabled={pending} onClick={() => moderar('rechazar')}
          className="rounded bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-800 disabled:opacity-50">
          {t('panel.rechazar')}
        </button>
      </div>
    </article>
  )
}
```

- [ ] **Step 3: Página del panel (protegida)** — `src/app/[locale]/panel/page.tsx`

```tsx
export const dynamic = 'force-dynamic'

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navegacion'
import { obtenerPerfil, ROLES_PANEL } from '@/lib/auth/sesion'
import { listarCola } from '@/lib/datos/moderacion'
import BotonSalir from '@/componentes/BotonSalir'
import FilaSolicitud from './FilaSolicitud'

export default async function Panel({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const perfil = await obtenerPerfil()
  if (!perfil) redirect({ href: '/entrar', locale })
  if (perfil && !ROLES_PANEL.includes(perfil.rol)) {
    return <main className="mx-auto max-w-2xl p-8"><p className="rounded bg-red-100 p-4 text-red-800">{t('panel.noAutorizado')}</p></main>
  }

  const cola = await listarCola()

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t('panel.titulo')}</h1>
        <BotonSalir />
      </div>
      {cola.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{t('panel.sinPendientes')}</p>
      ) : (
        <div className="grid gap-3">
          {cola.map((s) => <FilaSolicitud key={s.id} s={s} />)}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 4: `tsc` + build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores; la ruta `/[locale]/panel` aparece como dinámica (`ƒ`).

- [ ] **Step 5: Smoke test — el panel sin sesión redirige a /entrar**

```bash
npm run dev > /tmp/p3dev.log 2>&1 &
sleep 9
curl -s -o /dev/null -w "panel_sin_sesion=%{http_code}\n" -L http://localhost:3000/es/panel
curl -s -o /dev/null -w "panel_redirect=%{redirect_url}\n" http://localhost:3000/es/panel
pkill -f "next dev"; pkill -f "next-server"
```
Expected: sin sesión, `/es/panel` redirige a `/es/entrar` (el `-L` termina en 200 en la página de login; sin `-L` el código es 307 hacia `/es/entrar`).

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/panel"
git commit -m "feat: panel de moderación protegido con cola y acciones verificar/rechazar/duplicar"
```

---

### Task 8: Transcripción de reportes de WhatsApp

**Files:**
- Create: `src/app/[locale]/panel/FormularioTranscripcion.tsx`
- Modify: `src/app/[locale]/panel/page.tsx` (montar el formulario y pasar municipios)

- [ ] **Step 1: Formulario de transcripción** — `src/app/[locale]/panel/FormularioTranscripcion.tsx`

```tsx
'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionTranscribir, type EstadoTranscripcion } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import { CATEGORIAS, URGENCIAS } from '@/lib/validacion/esquemas'

const inicial: EstadoTranscripcion = { enviado: false }

export default function FormularioTranscripcion({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionTranscribir, inicial)
  const cats: Opcion[] = CATEGORIAS.map((c) => ({ valor: c, texto: t(`categorias.${c}`) }))
  const urgs: Opcion[] = URGENCIAS.map((u) => ({ valor: u, texto: t(`urgencias.${u}`) }))
  const e = estado.errores ?? {}

  return (
    <details className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer font-bold">📱 {t('panel.transcribir')}</summary>
      {estado.enviado ? (
        <p className="mt-3 rounded bg-green-100 p-3 text-sm text-green-900">{t('formulario.gracias')}</p>
      ) : (
        <form action={accion} className="mt-4 max-w-lg">
          <Campo etiqueta={t('campos.categoria')} htmlFor="tcategoria" requerido errores={e.categoria}>
            <SelectCatalogo id="tcategoria" name="categoria" opciones={cats} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('campos.urgencia')} htmlFor="turgencia" requerido errores={e.urgencia}>
            <SelectCatalogo id="turgencia" name="urgencia" opciones={urgs} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('campos.municipio')} htmlFor="tmunicipio" requerido errores={e.municipio_id}>
            <SelectCatalogo id="tmunicipio" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('campos.descripcion')} htmlFor="tdesc" requerido errores={e.descripcion}>
            <textarea id="tdesc" name="descripcion" rows={3} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.contactoNombre')} htmlFor="tnombre" requerido errores={e.contacto_nombre}>
            <input id="tnombre" name="contacto_nombre" type="text" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.contactoTelefono')} htmlFor="ttel" requerido errores={e.contacto_telefono}>
            <input id="ttel" name="contacto_telefono" type="tel" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <BotonEnviar texto={t('panel.guardarTranscripcion')} textoEnviando={t('acciones.enviando')} />
        </form>
      )}
    </details>
  )
}
```

- [ ] **Step 2: Montar en el panel** — en `src/app/[locale]/panel/page.tsx`, añadir el import y cargar municipios, e insertar el formulario encima de la cola.

Añadir imports:
```tsx
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioTranscripcion from './FormularioTranscripcion'
```
Tras `const cola = await listarCola()`, añadir:
```tsx
  const municipios = (await listarMunicipios()).map((m) => ({ valor: m.codigo_dane, texto: `${m.nombre} — ${m.departamento}` }))
```
Y justo después del `<div>` del encabezado (antes del bloque de la cola), montar:
```tsx
      <FormularioTranscripcion municipios={municipios} />
```

- [ ] **Step 3: `tsc` + build + smoke**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores; `/[locale]/panel` dinámica.

```bash
npm run dev > /tmp/p3dev.log 2>&1 &
sleep 9
curl -s -o /dev/null -w "panel=%{http_code}\n" http://localhost:3000/es/panel
pkill -f "next dev"; pkill -f "next-server"
```
Expected: 307 (redirige a /entrar sin sesión) — el formulario se prueba manualmente tras iniciar sesión.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/panel"
git commit -m "feat: transcripción de reportes de WhatsApp desde el panel de moderación"
```

---

### Task 9: Enlace en navegación + verificación final + bootstrap del primer admin

**Files:**
- Modify: `src/componentes/Navegacion.tsx` (enlace a Entrar/Panel)
- Create: `docs/superpowers/BOOTSTRAP-ADMIN.md`

- [ ] **Step 1: Enlace en la navegación** — en `src/componentes/Navegacion.tsx`, añadir un enlace a "Entrar" al final de los enlaces existentes. Reemplazar el array `enlaces` para incluir el panel/entrar:

```tsx
  const enlaces: [string, string][] = [
    ['/necesidades', t('necesidades')],
    ['/acopios', t('acopios')],
    ['/voluntarios', t('voluntariado')],
    ['/servicios', t('servicios')],
  ]
```
y, después del `map` de enlaces y antes de `<SelectorIdioma />`, añadir un enlace fijo a Entrar (usa el namespace `auth`):
```tsx
          <Link href="/entrar" className="text-gray-700 hover:text-blue-700">{tAuth('entrar')}</Link>
```
Para ello, al inicio de la función añade `const tAuth = await getTranslations('auth')` junto al `const t = await getTranslations('nav')` existente.

- [ ] **Step 2: Documento de bootstrap** — `docs/superpowers/BOOTSTRAP-ADMIN.md`

```markdown
# Crear el primer admin y moderadores

Las cuentas se provisionan manualmente (no hay registro público).

1. La persona entra a `/es/entrar`, escribe su correo y pide el enlace.
2. Abre el enlace del correo → queda con sesión, pero aún sin rol (verá "no autorizado" en el panel). Esto ya creó su usuario en Supabase Auth.
3. Un admin le asigna el rol con el script (usa `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`):

    node scripts/crear-perfil.mjs correo@ejemplo.com admin "Nombre"
    node scripts/crear-perfil.mjs otro@ejemplo.com moderador "Nombre"

4. La persona recarga `/es/panel` y ya tiene acceso.

**Primer admin (arranque):** hazlo tú mismo con tu propio correo (paso 1-2) y luego corre el script con `admin`.

Requisito en Supabase (una vez): Authentication → URL Configuration → Redirect URLs debe incluir `http://localhost:3000/auth/callback` (y la URL de producción cuando exista).
```

- [ ] **Step 3: Verificación final**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: todos los tests PASS; sin errores de tipos; build exit 0 con las rutas `/[locale]/entrar` y `/[locale]/panel`.

- [ ] **Step 4: Smoke test de navegación e integración**

```bash
npm run dev > /tmp/p3dev.log 2>&1 &
sleep 9
curl -s http://localhost:3000/es | grep -o "Entrar" | head -1
curl -s -o /dev/null -w "home=%{http_code} entrar=%{http_code}\n" http://localhost:3000/es
pkill -f "next dev"; pkill -f "next-server"
```
Expected: el grep encuentra "Entrar" en la nav; home responde 200.

- [ ] **Step 5: Commit + tag**

```bash
git add src/componentes/Navegacion.tsx docs/superpowers/BOOTSTRAP-ADMIN.md
git commit -m "feat: enlace de acceso en navegación + guía de bootstrap de cuentas"
git tag auth-moderacion-v1
```

---

## Notas para el ejecutor

- **Configuración manual en Supabase (arriba):** la Redirect URL `http://localhost:3000/auth/callback` DEBE estar allowlisted o el magic link falla. Sin esto, Tasks 5-9 compilan y las páginas cargan, pero el login real no completa.
- **Testing de auth:** el flujo de correo/sesión no se testea automáticamente (requeriría interceptar email / Playwright). Se cubre con: tests unitarios de `decidirAccion` (Task 6), verificación de que el panel sin sesión redirige (smoke), y prueba manual de login siguiendo `BOOTSTRAP-ADMIN.md`. La lógica de negocio (transiciones) sí está testeada.
- **No requiere migración:** el RLS del Plan 1 ya autoriza a moderadores a leer solicitudes con contacto (`equipo_lee_solicitudes`) y actualizarlas (`equipo_edita_solicitudes`), y a insertar como `sin_verificar` (`reporte_publico_solicitudes` cubre `authenticated`). La provisión de perfiles usa `service_role` (salta RLS), por eso tampoco necesita política nueva.
- **Locale en el callback:** la ruta `/auth/callback` no está localizada (queda fuera del matcher i18n). El `next` param lleva el locale de vuelta (`/es/panel`). Por defecto cae a `/es/panel`.

## Self-review (hecho)
- **Cobertura del spec (§5):** login del equipo ✓ (magic link); cola de sin_verificar/por_reconfirmar con contacto visible solo a moderadores ✓ (cliente de servidor autenticado + RLS); verificar/rechazar/duplicar con la máquina de estados ✓ (`decidirAccion` usa `puedeTransicionar(...,'moderador')`); sello de verificación con autor/fecha ✓ (`verificada_por`/`verificada_en`); transcripción de WhatsApp con `origen='whatsapp'` ✓; cuentas provisionadas por admin, sin registro público ✓ (script service_role). Caducidad 72h y organizaciones (tomar/resolver, aprobación) NO están aquí: caducidad y orgs son Plan 3b/4 (anotado).
- **Consistencia de tipos:** `AccionModeracion` y `decidirAccion`/`moderarSolicitud`/`crearTranscripcion` en `moderacion.ts` consumidos por `acciones.ts` y `FilaSolicitud.tsx`; `Perfil`/`ROLES_PANEL` de `sesion.ts` usados en `panel/page.tsx`; `Opcion` reutilizado; `EstadoSolicitud` importado de `@/lib/estados`; clientes `crearClienteServidor`/`crearClienteNavegador` con las firmas definidas en Task 1.
- **Sin placeholders:** cada paso trae código completo.
