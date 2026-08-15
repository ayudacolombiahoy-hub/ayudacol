-- Permite al admin gestionar las campañas de dinero (los enlaces verificados).
-- La lectura pública ya existe (política lectura_publica_campanas del Plan 1).
-- es_admin() se definió en la migración 0004.
create policy admin_inserta_campanas on campanas_dinero for insert to authenticated with check (es_admin());
create policy admin_edita_campanas on campanas_dinero for update to authenticated using (es_admin());
create policy admin_borra_campanas on campanas_dinero for delete to authenticated using (es_admin());
