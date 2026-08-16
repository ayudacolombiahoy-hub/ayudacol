-- Desaparecidos: múltiples imágenes. foto_url (una) → fotos[] (varias),
-- migrando la imagen existente. Idempotente.

alter table personas_desaparecidas add column if not exists fotos text[] not null default '{}';
update personas_desaparecidas set fotos = array[foto_url]
  where foto_url is not null and coalesce(array_length(fotos, 1), 0) = 0;

-- Primero se dropea la vista (depende de foto_url), luego la columna, y se recrea la vista.
drop view if exists personas_desaparecidas_publicas;
alter table personas_desaparecidas drop column if exists foto_url;

create view personas_desaparecidas_publicas as
  select id, nombre, edad, descripcion, municipio_id, ultima_ubicacion, fotos, estado, creada_en
  from personas_desaparecidas where estado <> 'cerrado';
grant select on personas_desaparecidas_publicas to anon, authenticated;
