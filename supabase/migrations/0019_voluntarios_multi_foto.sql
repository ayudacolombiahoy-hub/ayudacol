-- Voluntarios: múltiples imágenes. foto_url (una) → fotos[] (varias),
-- migrando la imagen existente. Idempotente. Mantiene contacto_telefono y descripcion en la vista.

alter table voluntarios add column if not exists fotos text[] not null default '{}';
update voluntarios set fotos = array[foto_url]
  where foto_url is not null and coalesce(array_length(fotos, 1), 0) = 0;

-- Primero se dropea la vista (depende de foto_url), luego la columna, y se recrea la vista.
drop view if exists voluntarios_publicos;
alter table voluntarios drop column if exists foto_url;

create view voluntarios_publicos as
  select id, habilidades, disponibilidad, descripcion, municipio_id, estado, creada_en,
         contacto_telefono, fotos
  from voluntarios
  where estado <> 'inactivo';
grant select on voluntarios_publicos to anon, authenticated;
