-- Acopios: imagen opcional (una), para que capturas y el formulario público puedan
-- adjuntarla. Consistente con mascotas/desaparecidos/voluntarios (foto_url).
-- La lectura pública de centros_acopio es directa (select *), así que no hay vista que recrear.

alter table centros_acopio add column if not exists foto_url text;
