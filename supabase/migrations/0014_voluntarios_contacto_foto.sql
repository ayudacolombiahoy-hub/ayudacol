-- Voluntarios: teléfono visible al público + foto opcional.
-- (Decisión de producto: contacto directo del voluntario + foto opcional.)
-- Idempotente: la columna/vista pueden existir ya en algún entorno.

alter table voluntarios add column if not exists foto_url text;

-- Recrear la vista pública para incluir contacto_telefono y foto_url.
drop view if exists voluntarios_publicos;
create view voluntarios_publicos as
  select id, habilidades, disponibilidad, municipio_id, estado, creada_en,
         contacto_telefono, foto_url
  from voluntarios
  where estado <> 'inactivo';
grant select on voluntarios_publicos to anon, authenticated;
