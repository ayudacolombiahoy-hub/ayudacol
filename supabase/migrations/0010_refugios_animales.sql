-- Refugios / rescate animal. Espejo de albergues: lectura pública, gestión solo
-- del equipo (moderador/admin). 'especies' describe qué animales recibe/atiende.

create type estado_refugio as enum ('abierto', 'lleno', 'cerrado');

create table refugios_animales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  municipio_id text not null references municipios(codigo_dane),
  direccion text not null,
  capacidad int check (capacidad >= 0),
  ocupacion int not null default 0 check (ocupacion >= 0),
  especies text,
  contacto_publico text,
  estado estado_refugio not null default 'abierto',
  organizacion_id uuid references organizaciones(id),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
alter table refugios_animales enable row level security;
create policy lectura_publica_refugios on refugios_animales for select to anon, authenticated using (true);
create policy equipo_gestiona_refugios on refugios_animales for all to authenticated using (es_moderador_o_admin()) with check (es_moderador_o_admin());
create trigger trg_refugios_actualizada before update on refugios_animales for each row execute function set_actualizada_en();
create index idx_refugios_municipio on refugios_animales (municipio_id);
