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
