-- =====================================================
-- BACKUP POST-RBAC PROD (Supabase Free)
-- Fecha: 2026-01-15
-- Descripción: Snapshot reproducible post migración RBAC
-- =====================================================

-- ===== SNAPSHOT DE OBJETOS CRÍTICOS =====

-- Tablas / vistas clave
select to_regclass('public.perfiles') as perfiles;
select to_regclass('public.user_roles') as user_roles;
select to_regclass('public.supervisores') as supervisores_debe_ser_null;
select to_regclass('public.vista_supervisor_equipo_vendedor') as vista_supervisor_equipo_vendedor;

-- Columnas actuales de profiles (role NO debe existir)
select column_name
from information_schema.columns
where table_schema='public' and table_name='profiles'
order by ordinal_position;

-- Constraints RBAC críticos
select conname
from pg_constraint
where conname in (
  'user_roles_no_overlap',
  'zona_equipo_no_overlap',
  'zona_zonal_no_overlap',
  'presupuesto_ux_anio_mes_equipo'
)
order by conname;

-- ===== MASTER DATA IDÉMPOTENTE =====

insert into public.perfiles (perfil)
values ('admin'), ('vendedor'), ('supervisor'), ('zonal'), ('subgerente')
on conflict (perfil) do nothing;

-- ===== GO / NO-GO CHECKS =====

-- profiles.role NO debe existir
select column_name
from information_schema.columns
where table_schema='public'
  and table_name='profiles'
  and column_name='role';

-- supervisores NO debe existir
select to_regclass('public.supervisores') as supervisores_existe;

-- No debe haber solapamientos de perfil vigente
select count(*) as overlaps
from (
  select user_id
  from public.user_roles
  where coalesce(activo,true)=true
  group by user_id
  having count(*) filter (
    where fecha_inicio <= current_date
      and (fecha_fin is null or fecha_fin >= current_date)
  ) > 1
) t;
