-- Centros de acopio: múltiples imágenes. foto_url (una) → fotos[] (varias),
-- migrando la imagen existente. Idempotente. centros_acopio se lee directo con RLS
-- (no tiene vista pública), así que no hay vista que dropear ni recrear.

alter table centros_acopio add column if not exists fotos text[] not null default '{}';
update centros_acopio set fotos = array[foto_url]
  where foto_url is not null and coalesce(array_length(fotos, 1), 0) = 0;
alter table centros_acopio drop column if exists foto_url;
