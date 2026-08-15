-- ============ ALBERGUES (con cupos) ============
create type estado_albergue as enum ('abierto', 'lleno', 'cerrado');
create table albergues (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  municipio_id text not null references municipios(codigo_dane),
  direccion text not null,
  capacidad int check (capacidad >= 0),
  ocupacion int not null default 0 check (ocupacion >= 0),
  contacto_publico text,
  estado estado_albergue not null default 'abierto',
  organizacion_id uuid references organizaciones(id),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
alter table albergues enable row level security;
create policy lectura_publica_albergues on albergues for select to anon, authenticated using (true);
create policy equipo_gestiona_albergues on albergues for all to authenticated using (es_moderador_o_admin()) with check (es_moderador_o_admin());
create trigger trg_albergues_actualizada before update on albergues for each row execute function set_actualizada_en();
create index idx_albergues_municipio on albergues (municipio_id);

-- ============ PERSONAS DESAPARECIDAS (contacto privado como en solicitudes) ============
create type estado_persona as enum ('buscando', 'encontrada', 'cerrado');
create table personas_desaparecidas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  edad int check (edad >= 0 and edad < 130),
  descripcion text not null check (char_length(descripcion) between 5 and 2000),
  municipio_id text references municipios(codigo_dane),
  ultima_ubicacion text,
  foto_url text,
  estado estado_persona not null default 'buscando',
  contacto_nombre text not null,
  contacto_telefono text not null,
  verificada_por uuid references perfiles(id),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
alter table personas_desaparecidas enable row level security;
revoke select on personas_desaparecidas from anon;
create policy reporte_publico_desaparecidos on personas_desaparecidas for insert to anon, authenticated with check (estado = 'buscando');
create policy equipo_lee_desaparecidos on personas_desaparecidas for select to authenticated using (es_moderador_o_admin());
create policy equipo_edita_desaparecidos on personas_desaparecidas for update to authenticated using (es_moderador_o_admin());
create view personas_desaparecidas_publicas as
  select id, nombre, edad, descripcion, municipio_id, ultima_ubicacion, foto_url, estado, creada_en
  from personas_desaparecidas where estado <> 'cerrado';
grant select on personas_desaparecidas_publicas to anon, authenticated;
create trigger trg_desaparecidos_actualizada before update on personas_desaparecidas for each row execute function set_actualizada_en();

-- ============ NOVEDADES / AVISOS ============
create table novedades (
  id uuid primary key default gen_random_uuid(),
  titulo_es text not null,
  titulo_en text not null,
  contenido_es text not null,
  contenido_en text not null,
  publicada boolean not null default true,
  autor uuid references perfiles(id),
  creada_en timestamptz not null default now()
);
alter table novedades enable row level security;
create policy lectura_publica_novedades on novedades for select to anon, authenticated using (publicada = true);
create policy admin_gestiona_novedades on novedades for all to authenticated using (es_admin()) with check (es_admin());

-- ============ SUSCRIPCIONES A ALERTAS ============
create table suscripciones_alertas (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  municipio_id text references municipios(codigo_dane),
  creada_en timestamptz not null default now()
);
alter table suscripciones_alertas enable row level security;
create policy suscripcion_publica on suscripciones_alertas for insert to anon, authenticated with check (true);
create policy admin_lee_suscripciones on suscripciones_alertas for select to authenticated using (es_admin());

-- ============ STORAGE: fotos de reportes y personas ============
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true) on conflict (id) do nothing;
create policy "fotos lectura publica" on storage.objects for select to anon, authenticated using (bucket_id = 'fotos');
create policy "fotos subida publica" on storage.objects for insert to anon, authenticated with check (bucket_id = 'fotos');
