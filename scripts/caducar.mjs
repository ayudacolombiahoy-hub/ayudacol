// Ejecuta la caducidad de 72h. Correr periódicamente (cron/tarea programada).
// Uso: node scripts/caducar.mjs
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await admin.rpc('caducar_solicitudes')
if (error) { console.error('❌', error.message); process.exit(1) }
console.log(`✅ Solicitudes caducadas a por_reconfirmar: ${data}`)
