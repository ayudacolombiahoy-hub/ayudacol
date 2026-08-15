-- Propuesta pública de centros de acopio + moderación.
-- organizacion_id pasa a opcional (propuestas sin org); nueva bandera 'verificado'.

alter table centros_acopio alter column organizacion_id drop not null;
alter table centros_acopio add column verificado boolean not null default true;
-- Los acopios existentes quedan verificado=true → siguen públicos.

-- Inserción pública: anon inserta propuestas SIN org y SIN verificar.
create policy propuesta_publica_acopio on centros_acopio
  for insert to anon
  with check (organizacion_id is null and verificado = false);

-- Lectura pública: solo verificados.
drop policy if exists lectura_publica_acopios on centros_acopio;
create policy lectura_publica_acopios on centros_acopio
  for select to anon, authenticated using (verificado = true);

-- El equipo (admin/moderador) ve, edita y borra cualquier acopio (moderación).
create policy equipo_lee_acopios on centros_acopio
  for select to authenticated using (es_moderador_o_admin());
create policy equipo_edita_acopios on centros_acopio
  for update to authenticated using (es_moderador_o_admin());
create policy equipo_borra_acopios on centros_acopio
  for delete to authenticated using (es_moderador_o_admin());
