-- ===== HELPERS (security definer: no dispara RLS ni recursión) =====
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function public.mi_organizacion()
returns uuid language sql stable security definer set search_path = public as $$
  select organizacion_id from perfiles where id = auth.uid();
$$;

-- ===== ADMIN: organizaciones y perfiles =====
create policy admin_lee_organizaciones on organizaciones for select to authenticated using (es_admin());
create policy admin_inserta_organizaciones on organizaciones for insert to authenticated with check (es_admin());
create policy admin_edita_organizaciones on organizaciones for update to authenticated using (es_admin());

create policy admin_lee_perfiles on perfiles for select to authenticated using (es_admin());
create policy admin_inserta_perfiles on perfiles for insert to authenticated with check (es_admin());
create policy admin_edita_perfiles on perfiles for update to authenticated using (es_admin());

-- ===== ORG: solicitudes (ver verificadas para tomar + las asignadas con contacto) =====
create policy org_lee_solicitudes on solicitudes_ayuda for select to authenticated
  using (
    (mi_organizacion() is not null and estado = 'verificada')
    or organizacion_asignada = mi_organizacion()
  );

create policy org_actualiza_solicitudes on solicitudes_ayuda for update to authenticated
  using (
    (estado = 'verificada' and organizacion_asignada is null and mi_organizacion() is not null)
    or organizacion_asignada = mi_organizacion()
  )
  with check (
    (organizacion_asignada = mi_organizacion() and estado in ('en_atencion', 'resuelta'))
    or (estado = 'verificada' and organizacion_asignada is null)
  );

-- ===== ORG: centros de acopio =====
create policy org_lee_sus_acopios on centros_acopio for select to authenticated
  using (organizacion_id = mi_organizacion() or es_admin());
create policy org_inserta_acopio on centros_acopio for insert to authenticated
  with check (organizacion_id = mi_organizacion());
create policy org_edita_acopio on centros_acopio for update to authenticated
  using (organizacion_id = mi_organizacion());

-- ===== ORG: solicitudes de personal =====
create policy org_inserta_personal on solicitudes_personal for insert to authenticated
  with check (organizacion_id = mi_organizacion());
create policy org_edita_personal on solicitudes_personal for update to authenticated
  using (organizacion_id = mi_organizacion());

-- ===== CADUCIDAD 72h =====
create or replace function public.caducar_solicitudes()
returns integer language plpgsql security definer set search_path = public as $$
declare afectadas integer;
begin
  update solicitudes_ayuda
     set estado = 'por_reconfirmar'
   where estado in ('verificada', 'en_atencion')
     and actualizada_en < now() - interval '72 hours';
  get diagnostics afectadas = row_count;
  return afectadas;
end; $$;
