-- Mascotas perdidas y encontradas. Espejo de personas_desaparecidas, pero la
-- vista pública INCLUYE el contacto (para llamar/WhatsApp directo al reportante).

create type tipo_reporte_mascota as enum ('perdida', 'encontrada');
create type especie_mascota as enum ('perro', 'gato', 'ave', 'otro');
create type estado_mascota as enum ('activo', 'reunida', 'cerrado');

create table mascotas (
  id uuid primary key default gen_random_uuid(),
  tipo_reporte tipo_reporte_mascota not null,
  especie especie_mascota not null,
  nombre text,
  descripcion text not null check (char_length(descripcion) between 5 and 2000),
  municipio_id text references municipios(codigo_dane),
  ultima_ubicacion text,
  foto_url text,
  estado estado_mascota not null default 'activo',
  contacto_nombre text not null,
  contacto_telefono text not null,
  verificada_por uuid references perfiles(id),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
create index idx_mascotas_municipio on mascotas (municipio_id);

alter table mascotas enable row level security;
revoke select on mascotas from anon;
create policy reporte_publico_mascotas on mascotas
  for insert to anon, authenticated with check (estado = 'activo');
create policy equipo_lee_mascotas on mascotas
  for select to authenticated using (es_moderador_o_admin());
create policy equipo_edita_mascotas on mascotas
  for update to authenticated using (es_moderador_o_admin());

-- Vista pública: INCLUYE contacto (decisión de diseño), excluye 'cerrado'.
create view mascotas_publicas as
  select id, tipo_reporte, especie, nombre, descripcion, municipio_id, ultima_ubicacion,
         foto_url, estado, contacto_nombre, contacto_telefono, creada_en
  from mascotas where estado <> 'cerrado';
grant select on mascotas_publicas to anon, authenticated;

create trigger trg_mascotas_actualizada before update on mascotas
  for each row execute function set_actualizada_en();
