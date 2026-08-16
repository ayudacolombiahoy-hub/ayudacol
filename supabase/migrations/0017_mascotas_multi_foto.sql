-- Mascotas: múltiples imágenes. Se pasa de foto_url (una) a fotos[] (varias),
-- migrando la imagen existente al arreglo. Idempotente.

alter table mascotas add column if not exists fotos text[] not null default '{}';
update mascotas set fotos = array[foto_url]
  where foto_url is not null and coalesce(array_length(fotos, 1), 0) = 0;
alter table mascotas drop column if exists foto_url;

-- Recrear la vista pública con `fotos` en vez de `foto_url`.
drop view if exists mascotas_publicas;
create view mascotas_publicas as
  select id, tipo_reporte, especie, nombre, descripcion, municipio_id, ultima_ubicacion,
         fotos, estado, contacto_nombre, contacto_telefono, creada_en
  from mascotas where estado <> 'cerrado';
grant select on mascotas_publicas to anon, authenticated;
