-- Voluntarios: descripción de lo que ofrecen / cómo pueden ayudar.
-- Idempotente.

alter table voluntarios add column if not exists descripcion text;

-- Recrear la vista pública incluyendo descripcion (junto a contacto_telefono y foto_url).
drop view if exists voluntarios_publicos;
create view voluntarios_publicos as
  select id, habilidades, disponibilidad, descripcion, municipio_id, estado, creada_en,
         contacto_telefono, foto_url
  from voluntarios
  where estado <> 'inactivo';
grant select on voluntarios_publicos to anon, authenticated;
