-- Novedades: afiches informativos. Imágenes múltiples (patrón fotos[] de mascotas/
-- desaparecidos) + botón de acción opcional (enlace + etiqueta bilingüe).
-- Novedades no tiene vista pública (la página lee la tabla directo con RLS), así que
-- no hay vista que dropear/recrear. Idempotente.
alter table novedades add column if not exists fotos text[] not null default '{}';
alter table novedades add column if not exists enlace text;
alter table novedades add column if not exists enlace_texto_es text;
alter table novedades add column if not exists enlace_texto_en text;
