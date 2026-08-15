-- Casos de portales aliados (MiManizales.info). Solo campos públicos, sin contacto ni pago.
create table casos_aliados (
  case_id text primary key,
  titulo text not null,
  resumen_corto text,
  municipio text,
  sector text,
  prioridad text,
  grupos_objetivo text,
  tipos_necesidad text,
  necesidades_detalle text,
  imagen_url text,
  url_origen text not null,
  estado text not null default 'ACTIVO',
  finalizado boolean not null default false,
  fecha_verificacion timestamptz,
  orden int not null default 100,
  sincronizado_en timestamptz not null default now()
);

alter table casos_aliados enable row level security;
-- Sin políticas de escritura para anon/authenticated: solo el script de sync
-- (conexión de servicio vía SUPABASE_DB_URL) escribe, saltándose RLS.

create view casos_aliados_publicos as
  select case_id, titulo, resumen_corto, municipio, sector, prioridad,
         grupos_objetivo, tipos_necesidad, necesidades_detalle, imagen_url,
         url_origen, fecha_verificacion, sincronizado_en
  from casos_aliados
  where estado = 'ACTIVO' and not finalizado
  order by case prioridad when 'ALTA' then 0 when 'MEDIA' then 1 else 2 end,
           orden asc, fecha_verificacion desc nulls last;

grant select on casos_aliados_publicos to anon, authenticated;
