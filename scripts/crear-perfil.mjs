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
