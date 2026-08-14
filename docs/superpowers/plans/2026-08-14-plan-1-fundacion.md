# Plan 1 — Fundación de la Plataforma de Ayuda Humanitaria

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proyecto Next.js bilingüe (ES/EN) desplegable, con el esquema completo de datos en Supabase, seguridad RLS probada automáticamente (los contactos privados son ilegibles para anónimos) y la máquina de estados de solicitudes con tests.

**Architecture:** Una sola app Next.js (App Router, `src/`) que habla con Supabase (Postgres + Auth + Realtime). Las migraciones SQL viven versionadas en `supabase/migrations/` y se aplican con la CLI de Supabase. El público lee a través de **vistas públicas** sin columnas de contacto; las tablas base con datos privados niegan SELECT al rol anónimo. La lógica de transiciones de estado es una función pura TypeScript compartida por los planes siguientes.

**Tech Stack:** Next.js 15 (TypeScript, Tailwind, src-dir) · Supabase (supabase-js v2, CLI) · next-intl v4 · Vitest · dotenv

**Spec:** `docs/superpowers/specs/2026-08-14-plataforma-ayuda-humanitaria-design.md`

**Roadmap general (este es el Plan 1 de 5):** 1) Fundación ← este plan · 2) Flujo público (formularios + listas) · 3) Moderación y organizaciones · 4) Visualizador de focos + mapa + tiempo real · 5) Estadísticas + campañas + despliegue Hostinger.

---

## Estructura de archivos que crea este plan

```
(raíz del repo — ya existen docs/, recursos/, .gitignore)
package.json, next.config.ts, tsconfig.json, vitest.config.ts
.env.example            ← plantilla de credenciales (SÍ se versiona)
.env.local              ← credenciales reales (NO se versiona)
supabase/
  config.toml           ← generado por `supabase init`
  migrations/
    0001_esquema.sql    ← tipos, tablas, triggers
    0002_seguridad.sql  ← RLS, vistas públicas, función de rol
    0003_municipios.sql ← semilla del catálogo de municipios
src/
  middleware.ts         ← enrutado de idiomas
  i18n/routing.ts, request.ts, navegacion.ts
  messages/es.json, en.json
  lib/supabase/cliente.ts
  lib/estados.ts        ← máquina de estados (función pura)
  app/[locale]/layout.tsx, page.tsx
  componentes/selector-idioma.tsx
tests/
  setup.ts
  unit/estados.test.ts
  unit/mensajes-paridad.test.ts
  rls/seguridad.test.ts ← la suite innegociable
```

**Responsabilidades:** `lib/estados.ts` solo decide transiciones válidas (sin I/O). `lib/supabase/cliente.ts` solo crea el cliente browser/anon. Las migraciones son la única fuente de verdad del esquema. Los mensajes de UI viven únicamente en `src/messages/*.json`.

---

### Task 1: Scaffold del proyecto Next.js

**Files:**
- Create: toda la estructura de Next.js en la raíz del repo (vía carpeta temporal, porque la raíz ya tiene `docs/` y `recursos/` y el nombre de la carpeta lleva espacio)
- Modify: `.gitignore`, `package.json`

- [ ] **Step 1: Verificar Node**

Run: `node -v`
Expected: v18.18+ o v20+. Si no, detenerse y avisar al usuario.

- [ ] **Step 2: Generar el proyecto en carpeta temporal y moverlo a la raíz**

```bash
cd "/Volumes/Datadriven/02_PROYECTOS/ayuda humanitaria"
npx create-next-app@latest fundacion-tmp --typescript --eslint --tailwind --app --src-dir --turbopack --import-alias "@/*" --use-npm
rsync -a fundacion-tmp/ ./
rm -rf fundacion-tmp
```

- [ ] **Step 3: Reparar `.gitignore` y nombre del paquete**

El `.gitignore` generado reemplazó al nuestro. Verificar con `grep -c "superpowers" .gitignore` (esperado: 0) y añadir al final:

```
# Companion de brainstorming
.superpowers/
.DS_Store
```

Verificar que el template ya ignora env: `grep "env" .gitignore` (esperado: líneas `.env*` o equivalente; si no están, añadir `.env*`).

En `package.json` cambiar `"name": "fundacion-tmp"` por `"name": "plataforma-ayuda-humanitaria"`.

- [ ] **Step 4: Smoke test del dev server**

Run: `npm run dev &` … esperar 5 s … `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` … matar el proceso.
Expected: `200`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 (TS, Tailwind, src-dir)"
```

---

### Task 2: Credenciales de Supabase y dependencias

**Files:**
- Create: `.env.example`, `.env.local`, `vitest.config.ts`, `tests/setup.ts`, `src/lib/supabase/cliente.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: 🧑 PASO HUMANO — crear el proyecto Supabase**

Pedir al usuario (o hacer con él): en https://supabase.com/dashboard → New project (nombre `ayuda-humanitaria`, región us-east más cercana, guardar la contraseña de la base de datos). De Settings → API copiar: Project URL, `anon` key y `service_role` key. El plan NO puede continuar a la Task 4 sin esto; Tasks 2-3 sí.

- [ ] **Step 2: Crear `.env.example` (versionado) y `.env.local` (real)**

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=pega-aqui-la-anon-key
# Solo para limpieza de datos de prueba en tests. NUNCA usar en código de la app cliente.
SUPABASE_SERVICE_ROLE_KEY=pega-aqui-la-service-role-key
```

`.env.local`: mismo contenido con los valores reales.

- [ ] **Step 3: Instalar dependencias**

```bash
npm install @supabase/supabase-js
npm install -D vitest dotenv
```

- [ ] **Step 4: Configurar Vitest**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    testTimeout: 15000,
  },
})
```

`tests/setup.ts`:
```ts
import { config } from 'dotenv'

config({ path: '.env.local' })
```

En `package.json`, dentro de `"scripts"`, añadir:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Cliente Supabase**

`src/lib/supabase/cliente.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

export function crearClienteAnonimo() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6: Verificar que la suite corre (vacía)**

Run: `npm test`
Expected: Vitest corre y reporta "no test files found" (código de salida puede ser 1; es lo esperado en este punto).

- [ ] **Step 7: Commit**

```bash
git add .env.example vitest.config.ts tests/setup.ts src/lib/supabase/cliente.ts package.json package-lock.json
git commit -m "chore: Supabase client, Vitest y plantilla de credenciales"
```

---

### Task 3: Tests de seguridad RLS (primero, en rojo)

Estos tests codifican la regla innegociable del spec §11: *un anónimo jamás puede leer teléfonos de contacto*. Se escriben ANTES de las migraciones y deben FALLAR ahora.

**Files:**
- Create: `tests/rls/seguridad.test.ts`

- [ ] **Step 1: Escribir la suite completa**

`tests/rls/seguridad.test.ts`:
```ts
import { describe, test, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const idsInsertados: string[] = []

describe('RLS: tablas privadas', () => {
  test('anónimo NO puede leer la tabla base solicitudes_ayuda', async () => {
    const { error } = await anon.from('solicitudes_ayuda').select('*').limit(1)
    expect(error).not.toBeNull()
  })

  test('anónimo NO puede leer la tabla base voluntarios', async () => {
    const { error } = await anon.from('voluntarios').select('*').limit(1)
    expect(error).not.toBeNull()
  })

  test('anónimo NO puede leer la tabla base ofertas_servicios', async () => {
    const { error } = await anon.from('ofertas_servicios').select('*').limit(1)
    expect(error).not.toBeNull()
  })

  test('anónimo NO puede actualizar solicitudes', async () => {
    const { error } = await anon
      .from('solicitudes_ayuda')
      .update({ estado: 'verificada' })
      .eq('categoria', 'alimentos')
    expect(error).not.toBeNull()
  })
})

describe('RLS: vistas públicas', () => {
  test('la vista solicitudes_publicas es legible y NO expone contacto', async () => {
    const { data, error } = await anon.from('solicitudes_publicas').select('*').limit(5)
    expect(error).toBeNull()
    for (const fila of data ?? []) {
      expect(fila).not.toHaveProperty('contacto_nombre')
      expect(fila).not.toHaveProperty('contacto_telefono')
    }
  })

  test('la vista voluntarios_publicos es legible y NO expone contacto', async () => {
    const { data, error } = await anon.from('voluntarios_publicos').select('*').limit(5)
    expect(error).toBeNull()
    for (const fila of data ?? []) {
      expect(fila).not.toHaveProperty('nombre')
      expect(fila).not.toHaveProperty('contacto_telefono')
    }
  })

  test('el catálogo de municipios es público y tiene datos', async () => {
    const { data, error } = await anon.from('municipios').select('codigo_dane, nombre, departamento')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThanOrEqual(20)
  })
})

describe('RLS: inserción pública de reportes', () => {
  test('anónimo SÍ puede reportar una necesidad (queda sin_verificar)', async () => {
    const { data, error } = await anon
      .from('solicitudes_ayuda')
      .insert({
        categoria: 'agua',
        descripcion: 'PRUEBA AUTOMATICA — familia sin agua potable en la vereda',
        personas_afectadas: 4,
        urgencia: 'alta',
        municipio_id: '27001',
        contacto_nombre: 'Prueba RLS',
        contacto_telefono: '+57 300 000 0000',
      })
      .select('id')
    // La política permite INSERT; el select de retorno usa la política de la tabla
    // base y por eso puede fallar: aceptamos error===null (insert minimal ok) si data es null.
    if (error) {
      // Reintento sin retorno de representación:
      const { error: e2 } = await anon.from('solicitudes_ayuda').insert({
        categoria: 'agua',
        descripcion: 'PRUEBA AUTOMATICA — familia sin agua potable en la vereda',
        personas_afectadas: 4,
        urgencia: 'alta',
        municipio_id: '27001',
        contacto_nombre: 'Prueba RLS',
        contacto_telefono: '+57 300 000 0000',
      })
      expect(e2).toBeNull()
    } else if (data && data[0]) {
      idsInsertados.push(data[0].id)
    }
  })

  test('anónimo NO puede insertar con estado distinto de sin_verificar', async () => {
    const { error } = await anon.from('solicitudes_ayuda').insert({
      categoria: 'agua',
      descripcion: 'PRUEBA AUTOMATICA — intento de auto-verificacion',
      urgencia: 'alta',
      municipio_id: '27001',
      contacto_nombre: 'Prueba RLS',
      contacto_telefono: '+57 300 000 0000',
      estado: 'verificada',
    })
    expect(error).not.toBeNull()
  })
})

afterAll(async () => {
  // Limpieza con service_role si está disponible (borra solo filas de prueba)
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave) return
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, llave)
  await admin
    .from('solicitudes_ayuda')
    .delete()
    .like('descripcion', 'PRUEBA AUTOMATICA%')
})
```

- [ ] **Step 2: Ejecutar y confirmar que FALLA por esquema inexistente**

Run: `npm test -- tests/rls`
Expected: FAIL — errores de PostgREST tipo `relation "public.solicitudes_publicas" does not exist` / los asserts de vistas públicas fallan. (Los tests de "NO puede leer" pueden pasar ya: negar acceso a una tabla inexistente también es un error. Eso está bien.)

No se hace commit todavía: la suite queda en rojo hasta la Task 6.

---

### Task 4: Migración 0001 — esquema

**Files:**
- Create: `supabase/config.toml` (generado), `supabase/migrations/0001_esquema.sql`

- [ ] **Step 1: Inicializar y enlazar la CLI de Supabase**

```bash
npx supabase init
npx supabase link --project-ref REF-DEL-PROYECTO
```

El `REF` es el subdominio de la Project URL (`https://REF.supabase.co`). Pide la contraseña de la base de datos del Step 1 de la Task 2. *(Alternativa si la CLI falla: pegar cada migración en el SQL Editor del dashboard de Supabase, en orden.)*

- [ ] **Step 2: Escribir `supabase/migrations/0001_esquema.sql`**

```sql
-- ============ TIPOS ============
create type categoria_necesidad as enum
  ('alimentos','agua','albergue','materiales_construccion','remocion_escombros','salud','rescate','otro');
create type nivel_urgencia as enum ('alta','media','baja');
create type estado_solicitud as enum
  ('sin_verificar','verificada','en_atencion','resuelta','rechazada','duplicada','por_reconfirmar');
create type origen_reporte as enum ('web','whatsapp');
create type rol_usuario as enum ('admin','moderador','org');
create type tipo_organizacion as enum ('ong','alcaldia','bomberos','iglesia','empresa','comunitaria');
create type estado_organizacion as enum ('pendiente','aprobada');
create type estado_acopio as enum ('activo','lleno','cerrado');
create type tipo_servicio as enum ('alojamiento','transporte','maquinaria','bodega','otro');
create type habilidad_voluntario as enum
  ('medico','psicologo','remocion_escombros','logistica','transporte','construccion','otro');
create type estado_recurso as enum ('disponible','asignado','inactivo');

-- ============ CATALOGOS ============
create table municipios (
  codigo_dane text primary key,
  nombre text not null,
  departamento text not null
);

-- ============ ORGANIZACIONES Y PERFILES ============
create table organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo tipo_organizacion not null,
  estado estado_organizacion not null default 'pendiente',
  descripcion text,
  contacto_publico text,
  sitio_web text,
  creada_en timestamptz not null default now()
);

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol rol_usuario not null,
  organizacion_id uuid references organizaciones(id),
  creada_en timestamptz not null default now()
);

-- ============ NECESIDADES ============
create table solicitudes_ayuda (
  id uuid primary key default gen_random_uuid(),
  categoria categoria_necesidad not null,
  descripcion text not null check (char_length(descripcion) between 10 and 2000),
  personas_afectadas int check (personas_afectadas > 0),
  urgencia nivel_urgencia not null default 'media',
  municipio_id text not null references municipios(codigo_dane),
  detalle_ubicacion text,
  lat double precision,
  lng double precision,
  estado estado_solicitud not null default 'sin_verificar',
  origen origen_reporte not null default 'web',
  fotos text[] not null default '{}',
  contacto_nombre text not null,
  contacto_telefono text not null,
  verificada_por uuid references perfiles(id),
  verificada_en timestamptz,
  organizacion_asignada uuid references organizaciones(id),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

-- ============ RECURSOS ============
create table centros_acopio (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id),
  nombre text not null,
  direccion text not null,
  municipio_id text not null references municipios(codigo_dane),
  lat double precision,
  lng double precision,
  horarios text,
  contacto_publico text,
  recibe text[] not null default '{}',
  no_necesita text[] not null default '{}',
  estado estado_acopio not null default 'activo',
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

create table voluntarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  habilidades habilidad_voluntario[] not null default '{}',
  disponibilidad text,
  municipio_id text not null references municipios(codigo_dane),
  contacto_telefono text not null,
  estado estado_recurso not null default 'disponible',
  creada_en timestamptz not null default now()
);

create table ofertas_servicios (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_servicio not null,
  descripcion text not null check (char_length(descripcion) between 10 and 2000),
  capacidad text,
  municipio_id text not null references municipios(codigo_dane),
  contacto_nombre text not null,
  contacto_telefono text not null,
  estado estado_recurso not null default 'disponible',
  creada_en timestamptz not null default now()
);

create table solicitudes_personal (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id),
  habilidad habilidad_voluntario not null,
  cantidad int not null default 1 check (cantidad > 0),
  municipio_id text not null references municipios(codigo_dane),
  descripcion text,
  estado estado_recurso not null default 'disponible',
  creada_en timestamptz not null default now()
);

-- ============ TRANSVERSAL ============
create table campanas_dinero (
  id uuid primary key default gen_random_uuid(),
  titulo_es text not null,
  titulo_en text not null,
  descripcion_es text not null,
  descripcion_en text not null,
  organizacion text not null,
  url text not null,
  verificada_por uuid references perfiles(id),
  creada_en timestamptz not null default now()
);

create table historial_cambios (
  id bigint generated always as identity primary key,
  entidad text not null,
  entidad_id uuid not null,
  estado_anterior text,
  estado_nuevo text not null,
  autor uuid,
  nota text,
  creada_en timestamptz not null default now()
);

create index idx_solicitudes_estado on solicitudes_ayuda (estado);
create index idx_solicitudes_municipio on solicitudes_ayuda (municipio_id);
create index idx_acopios_municipio on centros_acopio (municipio_id);
create index idx_historial_entidad on historial_cambios (entidad, entidad_id);

-- ============ TRIGGERS ============
create or replace function public.set_actualizada_en()
returns trigger language plpgsql as $$
begin
  new.actualizada_en = now();
  return new;
end; $$;

create trigger trg_solicitudes_actualizada
  before update on solicitudes_ayuda
  for each row execute function set_actualizada_en();

create trigger trg_acopios_actualizada
  before update on centros_acopio
  for each row execute function set_actualizada_en();

-- Historial de estados: security definer para que también funcione
-- cuando inserta un anónimo (historial_cambios no acepta escrituras directas).
create or replace function public.registrar_cambio_estado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into historial_cambios (entidad, entidad_id, estado_anterior, estado_nuevo, autor)
    values (tg_table_name, new.id, null, new.estado::text, auth.uid());
  elsif new.estado is distinct from old.estado then
    insert into historial_cambios (entidad, entidad_id, estado_anterior, estado_nuevo, autor)
    values (tg_table_name, new.id, old.estado::text, new.estado::text, auth.uid());
  end if;
  return new;
end; $$;

create trigger trg_solicitudes_historial
  after insert or update on solicitudes_ayuda
  for each row execute function registrar_cambio_estado();

create trigger trg_acopios_historial
  after insert or update on centros_acopio
  for each row execute function registrar_cambio_estado();
```

- [ ] **Step 3: Aplicar**

Run: `npx supabase db push`
Expected: `Applying migration 0001_esquema.sql... Finished supabase db push.` Sin errores.

- [ ] **Step 4: Verificación rápida**

Run: `npm test -- tests/rls`
Expected: sigue FAIL (las vistas públicas aún no existen), pero los errores cambian: ya no es "relation solicitudes_ayuda does not exist".

---

### Task 5: Migración 0002 — seguridad (RLS y vistas públicas)

**Files:**
- Create: `supabase/migrations/0002_seguridad.sql`

- [ ] **Step 1: Escribir `supabase/migrations/0002_seguridad.sql`**

```sql
-- ============ ACTIVAR RLS EN TODO ============
alter table municipios enable row level security;
alter table organizaciones enable row level security;
alter table perfiles enable row level security;
alter table solicitudes_ayuda enable row level security;
alter table centros_acopio enable row level security;
alter table voluntarios enable row level security;
alter table ofertas_servicios enable row level security;
alter table solicitudes_personal enable row level security;
alter table campanas_dinero enable row level security;
alter table historial_cambios enable row level security;

-- ============ DEFENSA EN PROFUNDIDAD ============
-- Las tablas con datos de contacto niegan SELECT al anónimo a nivel de GRANT,
-- para que el intento devuelva error explícito (y no una lista vacía engañosa).
revoke select on solicitudes_ayuda from anon;
revoke select on voluntarios from anon;
revoke select on ofertas_servicios from anon;

-- ============ FUNCION DE ROL ============
create or replace function public.es_moderador_o_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol in ('moderador','admin')
  );
$$;

-- ============ CATALOGOS PUBLICOS ============
create policy lectura_publica_municipios on municipios
  for select to anon, authenticated using (true);

create policy lectura_publica_campanas on campanas_dinero
  for select to anon, authenticated using (true);

create policy lectura_publica_organizaciones on organizaciones
  for select to anon, authenticated using (estado = 'aprobada');

create policy lectura_publica_acopios on centros_acopio
  for select to anon, authenticated using (true);

create policy lectura_publica_personal on solicitudes_personal
  for select to anon, authenticated using (true);

-- ============ INSERCION PUBLICA DE REPORTES ============
create policy reporte_publico_solicitudes on solicitudes_ayuda
  for insert to anon, authenticated
  with check (
    estado = 'sin_verificar'
    and verificada_por is null
    and organizacion_asignada is null
  );

create policy registro_publico_voluntarios on voluntarios
  for insert to anon, authenticated
  with check (estado = 'disponible');

create policy oferta_publica_servicios on ofertas_servicios
  for insert to anon, authenticated
  with check (estado = 'disponible');

-- ============ EQUIPO (moderadores y admins) ============
create policy equipo_lee_solicitudes on solicitudes_ayuda
  for select to authenticated using (es_moderador_o_admin());

create policy equipo_edita_solicitudes on solicitudes_ayuda
  for update to authenticated using (es_moderador_o_admin());

create policy equipo_lee_voluntarios on voluntarios
  for select to authenticated using (es_moderador_o_admin());

create policy equipo_lee_servicios on ofertas_servicios
  for select to authenticated using (es_moderador_o_admin());

create policy equipo_lee_historial on historial_cambios
  for select to authenticated using (es_moderador_o_admin());

create policy usuario_lee_su_perfil on perfiles
  for select to authenticated using (id = auth.uid());

-- (Las políticas de organizaciones —tomar solicitudes, gestionar sus acopios,
--  leer contactos de lo tomado vía RPC— llegan en la migración del Plan 3.)

-- ============ VISTAS PUBLICAS SIN CONTACTO ============
-- Ejecutan con permisos del dueño (postgres): saltan el RLS de la tabla base
-- y exponen SOLO columnas seguras.
create view solicitudes_publicas as
  select id, categoria, descripcion, personas_afectadas, urgencia,
         municipio_id, detalle_ubicacion, lat, lng, estado, origen, fotos,
         verificada_en, creada_en, actualizada_en
  from solicitudes_ayuda
  where estado not in ('rechazada','duplicada');

create view voluntarios_publicos as
  select id, habilidades, disponibilidad, municipio_id, estado, creada_en
  from voluntarios
  where estado <> 'inactivo';

create view ofertas_servicios_publicas as
  select id, tipo, descripcion, capacidad, municipio_id, estado, creada_en
  from ofertas_servicios
  where estado <> 'inactivo';

grant select on solicitudes_publicas, voluntarios_publicos, ofertas_servicios_publicas
  to anon, authenticated;
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase db push`
Expected: `Applying migration 0002_seguridad.sql... Finished supabase db push.`

- [ ] **Step 3: Verificación rápida**

Run: `npm test -- tests/rls`
Expected: quedan en FAIL el test del catálogo de municipios (`>= 20 filas`) y el de "anónimo SÍ puede reportar" (la FK a `municipios('27001')` aún no existe). Todo lo demás en verde.

---

### Task 6: Migración 0003 — semilla de municipios, y suite en verde

**Files:**
- Create: `supabase/migrations/0003_municipios.sql`

- [ ] **Step 1: Escribir `supabase/migrations/0003_municipios.sql`**

Códigos DANE (verificar contra la DIVIPOLA oficial https://www.dane.gov.co si alguno falla la FK en pruebas manuales; ampliar la lista cuando lleguen reportes de municipios no listados):

```sql
insert into municipios (codigo_dane, nombre, departamento) values
  -- Caldas
  ('17001','Manizales','Caldas'),
  ('17174','Chinchiná','Caldas'),
  ('17873','Villamaría','Caldas'),
  ('17486','Neira','Caldas'),
  ('17524','Palestina','Caldas'),
  ('17042','Anserma','Caldas'),
  -- Risaralda
  ('66001','Pereira','Risaralda'),
  ('66170','Dosquebradas','Risaralda'),
  ('66682','Santa Rosa de Cabal','Risaralda'),
  ('66400','La Virginia','Risaralda'),
  ('66440','Marsella','Risaralda'),
  -- Quindío
  ('63001','Armenia','Quindío'),
  ('63130','Calarcá','Quindío'),
  ('63470','Montenegro','Quindío'),
  ('63401','La Tebaida','Quindío'),
  ('63190','Circasia','Quindío'),
  ('63594','Quimbaya','Quindío'),
  ('63690','Salento','Quindío'),
  ('63272','Filandia','Quindío'),
  -- Valle del Cauca
  ('76001','Cali','Valle del Cauca'),
  ('76892','Yumbo','Valle del Cauca'),
  ('76364','Jamundí','Valle del Cauca'),
  ('76520','Palmira','Valle del Cauca'),
  ('76109','Buenaventura','Valle del Cauca'),
  -- Chocó
  ('27001','Quibdó','Chocó'),
  ('27361','Istmina','Chocó'),
  ('27787','Tadó','Chocó'),
  ('27205','Condoto','Chocó'),
  ('27075','Bahía Solano','Chocó'),
  ('27050','Atrato','Chocó')
on conflict (codigo_dane) do nothing;
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase db push`
Expected: `Applying migration 0003_municipios.sql... Finished supabase db push.`

- [ ] **Step 3: Toda la suite RLS en verde**

Run: `npm test -- tests/rls`
Expected: PASS los 9 tests. Este es el criterio de seguridad del spec cumplido y automatizado.

- [ ] **Step 4: Commit**

```bash
git add supabase tests/rls
git commit -m "feat: esquema Supabase con RLS, vistas públicas sin contacto y semilla de municipios (tests de seguridad en verde)"
```

---

### Task 7: Máquina de estados de solicitudes (TDD)

Función pura que decide qué transición de estado puede hacer cada rol (spec §5). Los Planes 3 y 4 la usan en panel y API.

**Files:**
- Create: `src/lib/estados.ts`
- Test: `tests/unit/estados.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`tests/unit/estados.test.ts`:
```ts
import { describe, test, expect } from 'vitest'
import {
  puedeTransicionar,
  type EstadoSolicitud,
  type RolTransicion,
} from '../../src/lib/estados'

describe('transiciones válidas', () => {
  test('moderador verifica un reporte nuevo', () => {
    expect(puedeTransicionar('sin_verificar', 'verificada', 'moderador')).toBe(true)
  })
  test('moderador rechaza o marca duplicado', () => {
    expect(puedeTransicionar('sin_verificar', 'rechazada', 'moderador')).toBe(true)
    expect(puedeTransicionar('sin_verificar', 'duplicada', 'moderador')).toBe(true)
  })
  test('moderador reconfirma una caducada', () => {
    expect(puedeTransicionar('por_reconfirmar', 'verificada', 'moderador')).toBe(true)
  })
  test('organización toma una verificada y la resuelve o la suelta', () => {
    expect(puedeTransicionar('verificada', 'en_atencion', 'org')).toBe(true)
    expect(puedeTransicionar('en_atencion', 'resuelta', 'org')).toBe(true)
    expect(puedeTransicionar('en_atencion', 'verificada', 'org')).toBe(true)
  })
  test('el sistema caduca a las 72h sin actualización', () => {
    expect(puedeTransicionar('verificada', 'por_reconfirmar', 'sistema')).toBe(true)
    expect(puedeTransicionar('en_atencion', 'por_reconfirmar', 'sistema')).toBe(true)
  })
  test('admin puede todo lo del moderador y de la org', () => {
    expect(puedeTransicionar('sin_verificar', 'verificada', 'admin')).toBe(true)
    expect(puedeTransicionar('verificada', 'en_atencion', 'admin')).toBe(true)
    expect(puedeTransicionar('en_atencion', 'resuelta', 'admin')).toBe(true)
  })
})

describe('transiciones prohibidas', () => {
  test('el público no cambia estados', () => {
    expect(puedeTransicionar('sin_verificar', 'verificada', 'publico')).toBe(false)
  })
  test('una org no verifica reportes', () => {
    expect(puedeTransicionar('sin_verificar', 'verificada', 'org')).toBe(false)
  })
  test('resuelta es terminal para todos los roles', () => {
    const roles: RolTransicion[] = ['publico', 'sistema', 'moderador', 'org', 'admin']
    const estados: EstadoSolicitud[] = [
      'sin_verificar', 'verificada', 'en_atencion', 'resuelta',
      'rechazada', 'duplicada', 'por_reconfirmar',
    ]
    for (const rol of roles) {
      for (const destino of estados) {
        expect(puedeTransicionar('resuelta', destino, rol)).toBe(false)
      }
    }
  })
  test('nadie salta de sin_verificar directo a resuelta', () => {
    const roles: RolTransicion[] = ['publico', 'sistema', 'moderador', 'org', 'admin']
    for (const rol of roles) {
      expect(puedeTransicionar('sin_verificar', 'resuelta', rol)).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test -- tests/unit/estados.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/estados'` (o equivalente).

- [ ] **Step 3: Implementar `src/lib/estados.ts`**

```ts
export type EstadoSolicitud =
  | 'sin_verificar'
  | 'verificada'
  | 'en_atencion'
  | 'resuelta'
  | 'rechazada'
  | 'duplicada'
  | 'por_reconfirmar'

export type RolTransicion = 'publico' | 'sistema' | 'moderador' | 'org' | 'admin'

type Mapa = Partial<Record<EstadoSolicitud, EstadoSolicitud[]>>

const TRANSICIONES: Record<RolTransicion, Mapa> = {
  publico: {},
  sistema: {
    verificada: ['por_reconfirmar'],
    en_atencion: ['por_reconfirmar'],
  },
  moderador: {
    sin_verificar: ['verificada', 'rechazada', 'duplicada'],
    por_reconfirmar: ['verificada', 'rechazada'],
    verificada: ['rechazada', 'duplicada'],
    en_atencion: ['resuelta'],
  },
  org: {
    verificada: ['en_atencion'],
    en_atencion: ['resuelta', 'verificada'],
  },
  admin: {
    sin_verificar: ['verificada', 'rechazada', 'duplicada'],
    por_reconfirmar: ['verificada', 'rechazada'],
    verificada: ['rechazada', 'duplicada', 'en_atencion'],
    en_atencion: ['resuelta', 'verificada'],
  },
}

export function puedeTransicionar(
  desde: EstadoSolicitud,
  hacia: EstadoSolicitud,
  rol: RolTransicion
): boolean {
  return (TRANSICIONES[rol][desde] ?? []).includes(hacia)
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -- tests/unit/estados.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/estados.ts tests/unit/estados.test.ts
git commit -m "feat: máquina de estados de solicitudes por rol (TDD)"
```

---

### Task 8: Bilingüe ES/EN con next-intl

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navegacion.ts`, `src/middleware.ts`, `src/messages/es.json`, `src/messages/en.json`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/componentes/selector-idioma.tsx`
- Modify: `next.config.ts`
- Delete: `src/app/layout.tsx`, `src/app/page.tsx` (los del scaffold)
- Test: `tests/unit/mensajes-paridad.test.ts`

- [ ] **Step 1: Test de paridad de traducciones (falla primero)**

`tests/unit/mensajes-paridad.test.ts`:
```ts
import { test, expect } from 'vitest'
import es from '../../src/messages/es.json'
import en from '../../src/messages/en.json'

function claves(obj: Record<string, unknown>, prefijo = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? claves(v as Record<string, unknown>, `${prefijo}${k}.`)
      : [`${prefijo}${k}`]
  )
}

test('es.json y en.json tienen exactamente las mismas claves', () => {
  expect(claves(en).sort()).toEqual(claves(es).sort())
})
```

Run: `npm test -- tests/unit/mensajes-paridad.test.ts`
Expected: FAIL — los archivos de mensajes no existen.

- [ ] **Step 2: Instalar y configurar next-intl**

```bash
npm install next-intl
```

`src/i18n/routing.ts`:
```ts
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
})
```

`src/i18n/request.ts`:
```ts
import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const solicitado = await requestLocale
  const locale = hasLocale(routing.locales, solicitado)
    ? solicitado
    : routing.defaultLocale
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

`src/i18n/navegacion.ts`:
```ts
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, usePathname, useRouter, redirect } = createNavigation(routing)
```

`src/middleware.ts`:
```ts
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: ['/', '/(es|en)/:path*'],
}
```

Reemplazar el contenido de `next.config.ts`:
```ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {}

export default withNextIntl(nextConfig)
```

- [ ] **Step 3: Diccionarios iniciales**

`src/messages/es.json`:
```json
{
  "comun": {
    "nombrePlataforma": "AyudaCol",
    "enVivo": "Datos en vivo",
    "actualizadoHace": "actualizado hace {tiempo}",
    "cambiarIdioma": "English"
  },
  "nav": {
    "necesidades": "Necesidades",
    "acopios": "Centros de acopio",
    "voluntariado": "Voluntariado",
    "servicios": "Servicios",
    "donar": "Donar",
    "estadisticas": "Estadísticas"
  },
  "inicio": {
    "titulo": "Ayuda verificada para las zonas afectadas por el terremoto",
    "subtitulo": "Información en tiempo real de Manizales, Pereira, Quindío, Cali y Chocó",
    "pedirAyuda": "Pedir ayuda",
    "quieroAyudar": "Quiero ayudar",
    "donarDesdeEEUU": "Donar desde EE. UU."
  },
  "categorias": {
    "alimentos": "Alimentos",
    "agua": "Agua potable",
    "albergue": "Albergue",
    "materiales_construccion": "Materiales de construcción",
    "remocion_escombros": "Remoción de escombros",
    "salud": "Salud",
    "rescate": "Rescate",
    "otro": "Otro"
  },
  "estados": {
    "sin_verificar": "Sin verificar",
    "verificada": "Verificada",
    "en_atencion": "En atención",
    "resuelta": "Resuelta",
    "rechazada": "Rechazada",
    "duplicada": "Duplicada",
    "por_reconfirmar": "Por reconfirmar"
  }
}
```

`src/messages/en.json`:
```json
{
  "comun": {
    "nombrePlataforma": "AyudaCol",
    "enVivo": "Live data",
    "actualizadoHace": "updated {tiempo} ago",
    "cambiarIdioma": "Español"
  },
  "nav": {
    "necesidades": "Needs",
    "acopios": "Donation centers",
    "voluntariado": "Volunteering",
    "servicios": "Services",
    "donar": "Donate",
    "estadisticas": "Statistics"
  },
  "inicio": {
    "titulo": "Verified help for the areas affected by the earthquake",
    "subtitulo": "Real-time information from Manizales, Pereira, Quindío, Cali and Chocó",
    "pedirAyuda": "Request help",
    "quieroAyudar": "I want to help",
    "donarDesdeEEUU": "Donate from the U.S."
  },
  "categorias": {
    "alimentos": "Food",
    "agua": "Drinking water",
    "albergue": "Shelter",
    "materiales_construccion": "Building materials",
    "remocion_escombros": "Debris removal",
    "salud": "Health",
    "rescate": "Rescue",
    "otro": "Other"
  },
  "estados": {
    "sin_verificar": "Unverified",
    "verificada": "Verified",
    "en_atencion": "Being handled",
    "resuelta": "Resolved",
    "rechazada": "Rejected",
    "duplicada": "Duplicate",
    "por_reconfirmar": "Pending reconfirmation"
  }
}
```

- [ ] **Step 4: Layout y página de inicio por idioma**

Borrar `src/app/layout.tsx` y `src/app/page.tsx` del scaffold.

`src/app/[locale]/layout.tsx`:
```tsx
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import '../globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
```

`src/app/[locale]/page.tsx`:
```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server'
import SelectorIdioma from '@/componentes/selector-idioma'

export default async function Inicio({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('inicio')
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex justify-end">
        <SelectorIdioma />
      </div>
      <h1 className="mt-8 text-3xl font-extrabold">{t('titulo')}</h1>
      <p className="mt-3 text-lg text-gray-600">{t('subtitulo')}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <span className="rounded-lg bg-red-100 px-4 py-2 font-bold text-red-900">
          🆘 {t('pedirAyuda')}
        </span>
        <span className="rounded-lg bg-green-100 px-4 py-2 font-bold text-green-900">
          🤝 {t('quieroAyudar')}
        </span>
        <span className="rounded-lg bg-blue-100 px-4 py-2 font-bold text-blue-900">
          💵 {t('donarDesdeEEUU')}
        </span>
      </div>
    </main>
  )
}
```

`src/componentes/selector-idioma.tsx`:
```tsx
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navegacion'

export default function SelectorIdioma() {
  const t = useTranslations('comun')
  const pathname = usePathname()
  const locale = useLocale()
  const otro = locale === 'es' ? 'en' : 'es'
  return (
    <Link
      href={pathname}
      locale={otro}
      className="rounded border px-3 py-1 text-sm font-semibold"
    >
      {t('cambiarIdioma')}
    </Link>
  )
}
```

- [ ] **Step 5: Tests y verificación manual**

Run: `npm test`
Expected: PASS — paridad de mensajes, máquina de estados y suite RLS, todo en verde.

Run: `npm run dev &` … `curl -s http://localhost:3000/es | grep -o "Ayuda verificada"` y `curl -s http://localhost:3000/en | grep -o "Verified help"` … matar el proceso.
Expected: ambos greps encuentran su texto. `curl -sI http://localhost:3000/` responde redirección hacia `/es`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: sitio bilingüe ES/EN con next-intl y página de inicio inicial"
```

---

### Task 9: Verificación final del plan

- [ ] **Step 1: Suite completa y build de producción**

Run: `npm test && npm run build`
Expected: todos los tests PASS y `npm run build` termina sin errores (páginas `/es` y `/en` generadas).

- [ ] **Step 2: Checklist de cierre**

- `.env.local` NO aparece en `git status` (ignorado).
- `git log --oneline` muestra los commits de las Tasks 1, 2, 6, 7 y 8.
- En el dashboard de Supabase (Table Editor) se ven las 10 tablas y las 3 vistas.

- [ ] **Step 3: Etiquetar el hito**

```bash
git commit --allow-empty -m "chore: fundación completa — esquema seguro + bilingüe + estados"
git tag fundacion-v1
```

---

## Notas para el ejecutor

- **Task 2 Step 1 y Task 4 Step 1 requieren al usuario** (crear el proyecto Supabase y la contraseña de la base de datos). Todo lo demás es autónomo.
- Si `npx supabase link/db push` falla por red o versión de CLI, el camino alterno es pegar las tres migraciones **en orden** en el SQL Editor del dashboard; los tests RLS validan el resultado igual.
- Los tests RLS corren contra el proyecto Supabase real (capa gratuita) e insertan filas marcadas `PRUEBA AUTOMATICA`; la limpieza usa `SUPABASE_SERVICE_ROLE_KEY` si está en `.env.local`.
- Los códigos DANE de la semilla se validan contra la DIVIPOLA oficial si alguna FK falla; ampliar la lista es solo añadir filas a `0003_municipios.sql` (o una migración nueva si ya se aplicó).
