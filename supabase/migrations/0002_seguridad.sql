-- ============ ACTIVAR RLS EN TODO ============
alter table municipios enable row level security;
alter table organizaciones enable row level security;
alter table perfiles enable row level security;
alter table solicitudes_ayuda enable row level security;
alter table centros_acopio enable row level security;
alter table voluntarios enable row level security;
alter table ofertas_servicios enable row level security;
alter table solicitudes_personal enable row level security;
alter table campanas_dinero enable row level security;
alter table historial_cambios enable row level security;

-- ============ DEFENSA EN PROFUNDIDAD ============
-- Las tablas con datos de contacto niegan SELECT al anónimo a nivel de GRANT,
-- para que el intento devuelva error explícito (y no una lista vacía engañosa).
revoke select on solicitudes_ayuda from anon;
revoke select on voluntarios from anon;
revoke select on ofertas_servicios from anon;

-- ============ FUNCION DE ROL ============
create or replace function public.es_moderador_o_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol in ('moderador','admin')
  );
$$;

-- ============ CATALOGOS PUBLICOS ============
create policy lectura_publica_municipios on municipios
  for select to anon, authenticated using (true);

create policy lectura_publica_campanas on campanas_dinero
  for select to anon, authenticated using (true);

create policy lectura_publica_organizaciones on organizaciones
  for select to anon, authenticated using (estado = 'aprobada');

create policy lectura_publica_acopios on centros_acopio
  for select to anon, authenticated using (true);

create policy lectura_publica_personal on solicitudes_personal
  for select to anon, authenticated using (true);

-- ============ INSERCION PUBLICA DE REPORTES ============
create policy reporte_publico_solicitudes on solicitudes_ayuda
  for insert to anon, authenticated
  with check (
    estado = 'sin_verificar'
    and verificada_por is null
    and organizacion_asignada is null
  );

create policy registro_publico_voluntarios on voluntarios
  for insert to anon, authenticated
  with check (estado = 'disponible');

create policy oferta_publica_servicios on ofertas_servicios
  for insert to anon, authenticated
  with check (estado = 'disponible');

-- ============ EQUIPO (moderadores y admins) ============
create policy equipo_lee_solicitudes on solicitudes_ayuda
  for select to authenticated using (es_moderador_o_admin());

create policy equipo_edita_solicitudes on solicitudes_ayuda
  for update to authenticated using (es_moderador_o_admin());

create policy equipo_lee_voluntarios on voluntarios
  for select to authenticated using (es_moderador_o_admin());

create policy equipo_lee_servicios on ofertas_servicios
  for select to authenticated using (es_moderador_o_admin());

create policy equipo_lee_historial on historial_cambios
  for select to authenticated using (es_moderador_o_admin());

create policy usuario_lee_su_perfil on perfiles
  for select to authenticated using (id = auth.uid());

-- (Las políticas de organizaciones —tomar solicitudes, gestionar sus acopios,
--  leer contactos de lo tomado vía RPC— llegan en la migración del Plan 3.)

-- ============ VISTAS PUBLICAS SIN CONTACTO ============
-- Ejecutan con permisos del dueño (postgres): saltan el RLS de la tabla base
-- y exponen SOLO columnas seguras.
create view solicitudes_publicas as
  select id, categoria, descripcion, personas_afectadas, urgencia,
         municipio_id, detalle_ubicacion, lat, lng, estado, origen, fotos,
         verificada_en, creada_en, actualizada_en
  from solicitudes_ayuda
  where estado not in ('rechazada','duplicada');

create view voluntarios_publicos as
  select id, habilidades, disponibilidad, municipio_id, estado, creada_en
  from voluntarios
  where estado <> 'inactivo';

create view ofertas_servicios_publicas as
  select id, tipo, descripcion, capacidad, municipio_id, estado, creada_en
  from ofertas_servicios
  where estado <> 'inactivo';

grant select on solicitudes_publicas, voluntarios_publicos, ofertas_servicios_publicas
  to anon, authenticated;
