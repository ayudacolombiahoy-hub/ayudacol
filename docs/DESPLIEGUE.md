# Guía de despliegue — AyudaCol (Hostinger + Node.js)

Esta guía lleva la plataforma de tu `localhost` a producción con HTTPS. La base de datos (Supabase) ya está en la nube; aquí desplegamos la app Next.js.

---

## ✅ Checklist de lanzamiento (marca cada paso)

- [ ] 1. Subir el código a GitHub
- [ ] 2. Crear la app Node.js en Hostinger y clonar el repo
- [ ] 3. Configurar variables de entorno en el servidor
- [ ] 4. `npm ci` + `npm run build` + arrancar con PM2
- [ ] 5. Apuntar el dominio a la app y activar SSL (HTTPS)
- [ ] 6. Supabase: añadir la Redirect URL de producción y el Site URL
- [ ] 7. (Recomendado) Configurar SMTP para los correos de acceso
- [ ] 8. **Limpiar los datos de demo** (`node scripts/limpiar-demo.mjs`)
- [ ] 9. Provisionar tu cuenta admin y las de moderadores
- [ ] 10. Publicar tus campañas reales en `/admin/campanas`
- [ ] 11. Probar el flujo completo en el dominio real

---

## 1. Subir el código a GitHub

Desde tu Mac, en la carpeta del proyecto:

```bash
# si aún no tienes el repo en GitHub, créalo (requiere la CLI de GitHub 'gh' autenticada)
gh repo create ayudacol --private --source=. --remote=origin --push

# o manualmente: crea el repo vacío en github.com y luego:
git remote add origin https://github.com/TU-USUARIO/ayudacol.git
git branch -M main
git push -u origin main
```

> `.env.local` NO se sube (está en `.gitignore`) — las credenciales se configuran en el servidor.

## 2. App Node.js en Hostinger

**Requisito:** un plan que permita **Node.js** (VPS, o un plan con "Node.js app" en hPanel). Node 20+.

**Opción A — hPanel con "Node.js app"** (si tu plan lo trae):
1. hPanel → **Sitios web / Node.js** → Crear aplicación.
2. Versión de Node: **20** (o superior). Comando de inicio: `npm run start`. Puerto: el que asigne Hostinger.
3. Conecta el repositorio de GitHub (o sube el código por Git/SFTP).

**Opción B — VPS (SSH):**
```bash
ssh usuario@TU_IP_VPS
# instala Node 20 (nvm) si no está
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 20
# clona el proyecto
git clone https://github.com/TU-USUARIO/ayudacol.git
cd ayudacol
```

## 3. Variables de entorno en el servidor

Crea un archivo `.env.local` en el servidor (NO se commitea) o configúralas en el panel de Hostinger:

```
NEXT_PUBLIC_SUPABASE_URL=https://uftvkknbrcphkttoqyvv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  (tu anon key)
NEXT_PUBLIC_SITE_URL=https://TU-DOMINIO.com
```

> La app en producción **solo** necesita esas tres. La `service_role` y la `SUPABASE_DB_URL` son solo para scripts locales (migraciones, demo, provisión) — NO las pongas en el servidor web.

## 4. Instalar, compilar y arrancar

```bash
npm ci
npm run build
# arrancar con PM2 (mantiene la app viva y la reinicia si falla)
npm install -g pm2
pm2 start npm --name ayudacol -- run start
pm2 save
pm2 startup   # sigue la instrucción que imprime, para que arranque tras reinicios
```
Por defecto Next escucha en el puerto **3000**. Si Hostinger te asigna otro, arranca así:
```bash
PORT=8080 pm2 start npm --name ayudacol -- run start
```

## 5. Dominio + HTTPS

- **hPanel:** asocia tu dominio a la app Node.js; Hostinger gestiona el proxy y el **SSL gratis** (Let's Encrypt) — actívalo en la sección SSL.
- **VPS manual:** configura **nginx** como reverse proxy hacia `localhost:3000` y saca el certificado con **certbot**:
  ```nginx
  server {
    server_name TU-DOMINIO.com;
    location / { proxy_pass http://localhost:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
  }
  ```
  ```bash
  sudo certbot --nginx -d TU-DOMINIO.com
  ```

## 6. Supabase: configuración de producción

En el dashboard de Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://TU-DOMINIO.com`
- **Redirect URLs:** añade `https://TU-DOMINIO.com/auth/callback`

Sin esto, el login por enlace mágico **no completa** en producción.

## 7. (Recomendado) Correo para los enlaces de acceso — SMTP

El correo integrado de Supabase tiene un límite bajo (pocos por hora). Para un equipo real, en **Authentication → Emails / SMTP Settings** configura un SMTP propio (por ejemplo **Resend**, **SendGrid** o el SMTP de tu dominio). Mientras el equipo sea muy pequeño, el correo integrado puede bastar para arrancar.

## 8. Limpiar los datos de demostración ⚠️

**Antes de anunciar la plataforma**, borra los ~4.000 reportes de demo (son ficticios):
```bash
# desde tu Mac (usa .env.local con SUPABASE_DB_URL y service_role)
node scripts/limpiar-demo.mjs
```

## 9. Provisionar admin y moderadores

Sigue `docs/superpowers/BOOTSTRAP-ADMIN.md`:
1. Cada persona entra una vez a `https://TU-DOMINIO.com/es/entrar` con su correo y abre el enlace.
2. Tú (con `.env.local` local) le asignas el rol:
   ```bash
   node scripts/crear-perfil.mjs correo@ejemplo.com admin "Tu Nombre"
   node scripts/crear-perfil.mjs otro@ejemplo.com moderador "Nombre"
   ```

## 10. Publicar campañas reales de donación

Entra como admin a `https://TU-DOMINIO.com/es/admin/campanas` y añade tus campañas **verificadas** (título ES/EN, descripción, organización y el enlace real de donación: GoFundMe, cuenta de la ONG, etc.). Aparecerán en `/donar`.

## 11. Prueba final en producción

- [ ] La home carga con HTTPS y el visualizador se ve.
- [ ] Reportar una necesidad funciona y aparece en `/necesidades`.
- [ ] El login por correo entra al `/panel` (con tu cuenta admin).
- [ ] `/donar` muestra tus campañas.
- [ ] Compartir el enlace en WhatsApp muestra la imagen y el texto (Open Graph).

---

## Notas y mejoras futuras (post-lanzamiento)

- **Rendimiento del visualizador:** con miles de reportes reales, mover la agregación por departamento a una vista/función en Supabase (hoy se calcula en memoria, trae hasta 5.000 filas).
- **`middleware.ts` → `proxy.ts`:** Next 16 marca `middleware` como deprecado; migrar cuando sea conveniente (hoy funciona).
- **Rate-limiting por IP** en los formularios públicos (hoy hay honeypot anti-bot).
- **Catálogo de municipios:** completar con el DIVIPOLA oficial del DANE (hoy hay 74, curados).
- **Tiempo real push:** hoy es auto-refresco cada 30 s; el push real de Supabase requiere un agregado público en la publicación de realtime.
- **Estadísticas:** dashboard exportable (§8 del spec) pendiente.
