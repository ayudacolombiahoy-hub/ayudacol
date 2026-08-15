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
