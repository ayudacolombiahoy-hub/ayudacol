-- Necesidades: exponer contacto en la vista pública (decisión de producto).
-- Antes la vista OCULTABA el contacto (gestión vía equipo/organizaciones). Ahora,
-- igual que mascotas, se muestra el contacto del reportante para permitir que
-- quien quiera ayudar lo llame/escriba directo.
--
-- Se usa CREATE OR REPLACE (no DROP): así se preservan el dueño de la vista
-- (postgres → sigue saltando el RLS de la tabla base) y los GRANT a anon.
-- Solo se pueden AGREGAR columnas al final; no se reordena ni cambia lo existente.
create or replace view solicitudes_publicas as
  select id, categoria, descripcion, personas_afectadas, urgencia,
         municipio_id, detalle_ubicacion, lat, lng, estado, origen, fotos,
         verificada_en, creada_en, actualizada_en,
         contacto_nombre, contacto_telefono
  from solicitudes_ayuda
  where estado not in ('rechazada','duplicada');
