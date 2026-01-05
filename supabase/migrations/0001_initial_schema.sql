--
-- PostgreSQL database dump
--

\restrict e7cHOUVCv35tPth6cIxEnVkUhJFYoOMfzOvYtQAH22KcdxMAEplTymM1GOi6NDf

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: crear_vendedor_y_asignar_equipo(uuid, character varying, bigint, character, date, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_vendedor_y_asignar_equipo(p_id_equipo uuid, p_nombre character varying, p_rut bigint, p_dv character, p_fecha_ingreso date DEFAULT CURRENT_DATE, p_creado_por uuid DEFAULT auth.uid(), p_id_usuario uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_id_vendedor uuid;
begin
  -- 1) Insert vendedor
  insert into public.vendedores (
    nombre,
    fecha_ingreso,
    estado,
    creado_por,
    fecha_creacion,
    rut,
    dv,
    id_usuario
  )
  values (
    p_nombre,
    coalesce(p_fecha_ingreso, current_date),
    'activo',
    coalesce(p_creado_por, auth.uid()),
    now(),
    p_rut,
    p_dv,
    p_id_usuario
  )
  returning id_vendedor into v_id_vendedor;

  -- 2) Asignación a equipo (misma transacción)
  insert into public.equipo_vendedor (
    id_equipo,
    id_vendedor,
    fecha_inicio,
    fecha_fin,
    estado
  )
  values (
    p_id_equipo,
    v_id_vendedor,
    coalesce(p_fecha_ingreso, current_date),
    null,
    true
  );

  return v_id_vendedor;
end;
$$;


--
-- Name: editar_ventas_dia(uuid, date, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.editar_ventas_dia(p_id_vendedor uuid, p_fecha_venta date, p_registros jsonb) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_es_supervisor boolean;
  v_es_vendedor   boolean;
  v_row   jsonb;
  v_tipo  text;
  v_monto numeric;
  v_desc  text;
begin
  -- ¿Es el propio vendedor?
  v_es_vendedor := (p_id_vendedor = auth.uid());

  -- ¿Es supervisor del equipo al que pertenece el vendedor?
  select exists (
    select 1
    from equipo_vendedor ev
    join vista_equipo_supervisor_dia vs
      on vs.id_equipo = ev.id_equipo
     and vs.id_supervisor = auth.uid()
     and vs.vigente = true
    where ev.id_vendedor = p_id_vendedor
      and ev.estado = true
      and ev.fecha_fin is null
  )
  into v_es_supervisor;

  if not (v_es_supervisor or v_es_vendedor) then
    raise exception 'PERMISO_DENEGADO';
  end if;

  -- 1) Borra ventas del día de ese vendedor
  delete from ventas
   where id_vendedor = p_id_vendedor
     and fecha_venta = p_fecha_venta;

  -- 2) Inserta nuevas ventas desde el JSON (si vienen)
  if p_registros is not null then
    for v_row in
      select jsonb_array_elements(p_registros)
    loop
      v_tipo := upper(trim(v_row->>'tipo_venta'));

      if v_tipo = 'PRODUCTO_VOLUNTARIO' then
        v_tipo := 'PV';
      end if;

      -- Normalizar a tipos permitidos
      if v_tipo not in ('TOPE','SOBRE','BAJO','PLAN','PV') then
        continue;
      end if;

      v_monto := (v_row->>'monto')::numeric;
      v_desc  := v_row->>'descripcion';

      if coalesce(v_monto,0) <= 0 then
        continue;
      end if;

      insert into ventas (id_vendedor, fecha_venta, monto, descripcion, tipo_venta)
      values (p_id_vendedor, p_fecha_venta, v_monto, v_desc, v_tipo);
    end loop;
  end if;

  return 'OK';
end;
$$;


--
-- Name: eliminar_vendedor_sin_ventas(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eliminar_vendedor_sin_ventas(p_id_vendedor uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_supervisor_id uuid := auth.uid();
  v_es_dueno      boolean;
  v_tiene_ventas  boolean;
BEGIN
  -- 1) Validar que haya usuario autenticado
  IF v_supervisor_id IS NULL THEN
    RETURN 'SIN_AUTH';
  END IF;

  -- 2) Validar que el supervisor logueado sea dueño del vendedor
  SELECT EXISTS (
    SELECT 1
    FROM public.vista_supervisor_equipo_vendedor_full v
    WHERE v.id_vendedor   = p_id_vendedor
      AND v.id_supervisor = v_supervisor_id
  )
  INTO v_es_dueno;

  IF NOT v_es_dueno THEN
    RETURN 'SIN_PERMISO';
  END IF;

  -- 3) Verificar si el vendedor tiene ventas
  SELECT EXISTS (
    SELECT 1
    FROM public.ventas ve
    WHERE ve.id_vendedor = p_id_vendedor
  )
  INTO v_tiene_ventas;

  IF v_tiene_ventas THEN
    RETURN 'TIENE_VENTAS';
  END IF;

  -- 4) Eliminar primero las relaciones en equipo_vendedor
  DELETE FROM public.equipo_vendedor
  WHERE id_vendedor = p_id_vendedor;

  -- 5) Eliminar el registro de vendedores
  DELETE FROM public.vendedores
  WHERE id_vendedor = p_id_vendedor;

  RETURN 'ELIMINADO';
END;
$$;


--
-- Name: fn_cerrar_asignacion_supervisor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_cerrar_asignacion_supervisor() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
    -- Cierra cualquier asignación vigente del mismo tipo (principal o suplente)
    UPDATE equipo_supervisor
       SET fecha_fin = CURRENT_DATE - 1
     WHERE id_supervisor = NEW.id_supervisor
       AND fecha_fin IS NULL
       AND id_equipo <> NEW.id_equipo
       AND es_principal = NEW.es_principal;

    RETURN NEW;
END;
$$;


--
-- Name: fn_cerrar_asignacion_vendedor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_cerrar_asignacion_vendedor() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
    -- Cerrar cualquier asignación vigente del mismo vendedor
    UPDATE equipo_vendedor
       SET fecha_fin = CURRENT_DATE - 1,
           estado = FALSE
     WHERE id_vendedor = NEW.id_vendedor
       AND fecha_fin IS NULL
       AND id_equipo <> NEW.id_equipo;

    RETURN NEW;
END;
$$;


--
-- Name: fn_es_admin_o_supervisor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_es_admin_o_supervisor() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  return exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and trim(lower(p.role)) in ('admin', 'supervisor')
  );
end;
$$;


--
-- Name: generar_objetivo_equipo_auto(uuid, date, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generar_objetivo_equipo_auto(p_id_equipo uuid, p_semana_inicio date, p_factor numeric DEFAULT 1.00) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_base numeric;
  v_obj numeric;
begin
  -- promedio 4 semanas previas (excluye semana actual)
  select coalesce(avg(total_semana), 0)
  into v_base
  from (
    select semana_inicio, sum(monto_total) as total_semana
    from public.mv_compromisos_semana
    where id_equipo = p_id_equipo
      and semana_inicio >= (p_semana_inicio - interval '28 days')
      and semana_inicio < p_semana_inicio
    group by semana_inicio
  ) s;

  v_obj := round(v_base * p_factor, 2);

  insert into public.objetivos_semanales (id_equipo, semana_inicio, id_vendedor, objetivo, fuente)
  values (p_id_equipo, p_semana_inicio, null, v_obj, 'auto')
  on conflict (id_equipo, semana_inicio, id_vendedor)
  do update set objetivo = excluded.objetivo, fuente = 'auto', creado_en = now();

  return jsonb_build_object('base_4s', v_base, 'factor', p_factor, 'objetivo', v_obj);
end;
$$;


--
-- Name: get_alertas_compromisos_hoy(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_alertas_compromisos_hoy(p_id_equipo uuid, p_fecha date) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id_vendedor', v.id_vendedor,
      'nombre', v.nombre
    )
  ), '[]'::jsonb)
  from public.equipo_vendedor ev
  join public.vendedores v on v.id_vendedor = ev.id_vendedor
  where ev.id_equipo = p_id_equipo
    and ev.estado = true
    and not exists (
      select 1
      from public.compromisos c
      where c.id_equipo = p_id_equipo
        and c.id_vendedor = v.id_vendedor
        and c.fecha_compromiso = p_fecha
    );
$$;


--
-- Name: get_compromisos_bootstrap(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_compromisos_bootstrap(p_id_equipo uuid, p_fecha_base date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_inicio date;
  v_fin date;
  v_dow int;
  v_offset int;
  v_user uuid;
  j_tipos jsonb;
  j_vendedores jsonb;
  j_compromisos jsonb;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'No autenticado';
  end if;

  -- Semana Lunes-Domingo
  v_dow := extract(dow from p_fecha_base)::int; -- 0=domingo .. 6=sábado
  v_offset := case when v_dow = 0 then -6 else 1 - v_dow end;
  v_inicio := p_fecha_base + v_offset;
  v_fin := v_inicio + 6;

  -- Tipos activos
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'nombre', t.nombre,
      'descripcion', t.descripcion,
      'supervisor_id', t.supervisor_id,
      'activo', t.activo,
      'es_obligatorio', t.es_obligatorio
    )
    order by t.nombre
  ), '[]'::jsonb)
  into j_tipos
  from public.tipos_compromisos t
  where t.activo = true;

  -- Vendedores activos del equipo
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id_vendedor', v.id_vendedor,
      'nombre', v.nombre
    )
    order by v.nombre
  ), '[]'::jsonb)
  into j_vendedores
  from public.equipo_vendedor ev
  join public.vendedores v on v.id_vendedor = ev.id_vendedor
  where ev.id_equipo = p_id_equipo
    and ev.estado = true;

  -- Compromisos semana (equipo + rango)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id_vendedor', c.id_vendedor,
      'id_tipo', c.id_tipo,
      'fecha_compromiso', c.fecha_compromiso,
      'monto_comprometido', c.monto_comprometido,
      'comentario', c.comentario,
      'id_supervisor', c.id_supervisor,
      'id_equipo', c.id_equipo
    )
  ), '[]'::jsonb)
  into j_compromisos
  from public.compromisos c
  where c.id_equipo = p_id_equipo
    and c.fecha_compromiso between v_inicio and v_fin;

  return jsonb_build_object(
    'semana_inicio', v_inicio,
    'semana_fin', v_fin,
    'tipos', j_tipos,
    'vendedores', j_vendedores,
    'compromisos', j_compromisos
  );
end;
$$;


--
-- Name: get_compromisos_semana_mv(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_compromisos_semana_mv(p_id_equipo uuid, p_semana_inicio date) RETURNS TABLE(id_vendedor uuid, id_tipo uuid, monto_total numeric)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select
    id_vendedor,
    id_tipo,
    monto_total
  from public.mv_compromisos_semana
  where id_equipo = p_id_equipo
    and semana_inicio = p_semana_inicio;
$$;


--
-- Name: get_kpi_cumplimiento_semana(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_kpi_cumplimiento_semana(p_id_equipo uuid, p_semana_inicio date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_compromiso numeric;
  v_real numeric;
begin
  -- Compromiso semanal (desde MV)
  select coalesce(sum(monto_total),0)
  into v_compromiso
  from public.mv_compromisos_semana
  where id_equipo = p_id_equipo
    and semana_inicio = p_semana_inicio;

  -- Ventas reales semana (ajusta tabla/campo si es necesario)
  select coalesce(sum(v.cantidad),0)
  into v_real
  from public.ventas v
  where v.id_equipo = p_id_equipo
    and v.fecha_venta between p_semana_inicio and (p_semana_inicio + 6);

  return jsonb_build_object(
    'compromiso', v_compromiso,
    'real', v_real,
    'cumplimiento_pct',
      case when v_compromiso = 0 then 0
           else round((v_real / v_compromiso) * 100, 1)
      end
  );
end;
$$;


--
-- Name: get_kpis_compromisos_semana(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_kpis_compromisos_semana(p_id_equipo uuid, p_semana_inicio date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  j_totales jsonb;
  j_por_vendedor jsonb;
  j_tendencia jsonb;
begin
  -- Totales semana
  select jsonb_build_object(
    'monto_total',
    coalesce(sum(monto_total),0)
  )
  into j_totales
  from public.mv_compromisos_semana
  where id_equipo = p_id_equipo
    and semana_inicio = p_semana_inicio;

  -- Ranking por vendedor
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id_vendedor', id_vendedor,
      'monto', sum(monto_total)
    )
    order by sum(monto_total) desc
  ), '[]'::jsonb)
  into j_por_vendedor
  from public.mv_compromisos_semana
  where id_equipo = p_id_equipo
    and semana_inicio = p_semana_inicio
  group by id_vendedor;

  -- Tendencia 4 semanas
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'semana_inicio', semana_inicio,
      'monto', sum(monto_total)
    )
    order by semana_inicio desc
  ), '[]'::jsonb)
  into j_tendencia
  from public.mv_compromisos_semana
  where id_equipo = p_id_equipo
    and semana_inicio >= (p_semana_inicio - interval '21 days')
  group by semana_inicio;

  return jsonb_build_object(
    'totales', j_totales,
    'por_vendedor', j_por_vendedor,
    'tendencia', j_tendencia
  );
end;
$$;


--
-- Name: get_objetivo_y_semaforo_semana(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_objetivo_y_semaforo_semana(p_id_equipo uuid, p_semana_inicio date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_obj numeric;
  k jsonb;
  v_real numeric;
  v_pct numeric;
  v_verde numeric;
  v_amarillo numeric;
  v_color text;
begin
  select objetivo
  into v_obj
  from public.objetivos_semanales
  where id_equipo = p_id_equipo
    and semana_inicio = p_semana_inicio
    and id_vendedor is null;

  if v_obj is null then
    v_obj := 0;
  end if;

  k := public.get_kpi_cumplimiento_semana(p_id_equipo, p_semana_inicio);
  v_real := coalesce((k->>'real')::numeric, 0);

  v_pct := case when v_obj = 0 then 0 else round((v_real / v_obj) * 100, 1) end;

  select coalesce(pct_verde, 100), coalesce(pct_amarillo, 85)
  into v_verde, v_amarillo
  from public.semaforo_config
  where id_equipo = p_id_equipo;

  v_color :=
    case
      when v_pct >= v_verde then 'VERDE'
      when v_pct >= v_amarillo then 'AMARILLO'
      else 'ROJO'
    end;

  return jsonb_build_object(
    'objetivo', v_obj,
    'real', v_real,
    'avance_pct', v_pct,
    'semaforo', v_color,
    'verde_desde', v_verde,
    'amarillo_desde', v_amarillo
  );
end;
$$;


--
-- Name: get_semaforo_equipo_semana(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_semaforo_equipo_semana(p_id_equipo uuid, p_semana_inicio date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  k jsonb;
  v_verde numeric;
  v_amarillo numeric;
  v_pct numeric;
  v_color text;
begin
  select coalesce(pct_verde, 100), coalesce(pct_amarillo, 85)
  into v_verde, v_amarillo
  from public.semaforo_config
  where id_equipo = p_id_equipo;

  k := public.get_kpi_cumplimiento_semana(p_id_equipo, p_semana_inicio);
  v_pct := coalesce((k->>'cumplimiento_pct')::numeric, 0);

  v_color :=
    case
      when v_pct >= v_verde then 'VERDE'
      when v_pct >= v_amarillo then 'AMARILLO'
      else 'ROJO'
    end;

  return jsonb_build_object(
    'cumplimiento_pct', v_pct,
    'verde_desde', v_verde,
    'amarillo_desde', v_amarillo,
    'semaforo', v_color,
    'compromiso', (k->>'compromiso')::numeric,
    'real', (k->>'real')::numeric
  );
end;
$$;


--
-- Name: get_semaforo_objetivo_vs_compromiso(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_semaforo_objetivo_vs_compromiso(p_id_equipo uuid, p_semana_inicio date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_objetivo numeric;
  v_compromiso numeric;
  v_pct numeric;
  v_verde numeric;
  v_amarillo numeric;
  v_color text;
begin
  -- Objetivo semanal
  select coalesce(objetivo, 0)
  into v_objetivo
  from public.objetivos_semanales
  where id_equipo = p_id_equipo
    and semana_inicio = p_semana_inicio
    and id_vendedor is null;

  -- Compromiso semanal (desde MV)
  select coalesce(sum(monto_total), 0)
  into v_compromiso
  from public.mv_compromisos_semana
  where id_equipo = p_id_equipo
    and semana_inicio = p_semana_inicio;

  v_pct :=
    case
      when v_objetivo = 0 then 0
      else round((v_compromiso / v_objetivo) * 100, 1)
    end;

  select coalesce(pct_verde,100), coalesce(pct_amarillo,85)
  into v_verde, v_amarillo
  from public.semaforo_config
  where id_equipo = p_id_equipo;

  v_color :=
    case
      when v_pct >= v_verde then 'VERDE'
      when v_pct >= v_amarillo then 'AMARILLO'
      else 'ROJO'
    end;

  return jsonb_build_object(
    'objetivo', v_objetivo,
    'compromiso', v_compromiso,
    'avance_pct', v_pct,
    'semaforo', v_color,
    'verde_desde', v_verde,
    'amarillo_desde', v_amarillo
  );
end;
$$;


--
-- Name: get_supervisor_bootstrap(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_supervisor_bootstrap() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_perfil jsonb;
  v_equipos jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  -- Perfil
  select to_jsonb(p) into v_perfil
  from (
    select id, nombre, usuario, email, role, activo, genero
    from public.profiles
    where id = v_uid
    limit 1
  ) p;

  -- Equipos del supervisor
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id_equipo', es.id_equipo,
        'nombre_equipo', e.nombre_equipo
      )
      order by e.nombre_equipo
    ),
    '[]'::jsonb
  )
  into v_equipos
  from public.equipo_supervisor es
  join public.equipos e on e.id_equipo = es.id_equipo
  where es.id_supervisor = v_uid;

  return jsonb_build_object(
    'perfil', v_perfil,
    'equipos', v_equipos
  );
end;
$$;


--
-- Name: get_vendedores_supervisor(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_vendedores_supervisor(p_solo_vigentes boolean DEFAULT true) RETURNS TABLE(id_vendedor uuid, nombre_vendedor text, rut text, dv text, id_equipo uuid, nombre_equipo text, fecha_ingreso date, fecha_egreso date)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select
    v.id_vendedor,
    v.nombre as nombre_vendedor,
    v.rut,
    v.dv,
    e.id_equipo,
    e.nombre_equipo,
    v.fecha_ingreso,
    v.fecha_egreso
  from public.equipo_supervisor es
  join public.equipo_vendedor ev on ev.id_equipo = es.id_equipo
  join public.vendedores v on v.id_vendedor = ev.id_vendedor
  join public.equipos e on e.id_equipo = es.id_equipo
  where es.id_supervisor = auth.uid()
    and (not p_solo_vigentes or v.fecha_egreso is null)
  order by e.nombre_equipo, v.nombre;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.profiles (id, email, usuario, nombre, role, activo, fecha_inicio, creado)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    '',
    'vendedor',
    true,
    now(),
    now()
  );
  return new;
end;
$$;


--
-- Name: handle_role_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_role_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if exists (select 1 from public.profiles p where p.id = new.user_id) then
    update public.profiles
       set role = lower(new.role)
     where id = new.user_id;
  end if;

  return new;
end;
$$;


--
-- Name: handle_user_deleted(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_user_deleted() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  perfil record;
begin
  -- Tomamos el registro activo actual
  select * into perfil
  from public.profiles
  where id = old.id and activo = true
  order by fecha_inicio desc
  limit 1;

  if perfil is not null then
    -- Cerramos la vigencia actual
    update public.profiles
    set activo = false,
        fecha_fin = now()
    where id = perfil.id
      and fecha_inicio = perfil.fecha_inicio;
  end if;

  -- Creamos un nuevo registro histórico, inactivo
  insert into public.profiles (id, email, usuario, nombre, role, activo, fecha_inicio, fecha_fin, creado)
  values (
    old.id,
    old.email,
    split_part(old.email, '@', 1),
    perfil.nombre,
    perfil.role,
    false,
    now(),
    now(),
    now()
  );

  return old;
end;
$$;


--
-- Name: has_any_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_any_role() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.activo = true
      and ur.fecha_fin is null
  );
$$;


--
-- Name: has_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(p_role text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    SET row_security TO 'off'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = p_role
      and ur.activo = true
      and ur.fecha_fin is null
  );
$$;


--
-- Name: FUNCTION has_role(p_role text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.has_role(p_role text) IS 'INTERNAL ONLY. Do not GRANT EXECUTE. Uses row_security=off.';


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select public.has_role('admin');
$$;


--
-- Name: is_owner_vendedor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_owner_vendedor(p_id_vendedor uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1
    from public.vendedores v
    where v.id_vendedor = p_id_vendedor
      and v.id_usuario = auth.uid()
  );
$$;


--
-- Name: is_supervisor_of_equipo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_supervisor_of_equipo(p_id_equipo uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select
    public.has_role('supervisor')
    and exists (
      select 1
      from public.equipo_supervisor es
      where es.id_equipo = p_id_equipo
        and es.id_supervisor = auth.uid()
        and (es.fecha_fin is null or es.fecha_fin >= current_date)
    );
$$;


--
-- Name: is_supervisor_of_vendedor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_supervisor_of_vendedor(p_id_vendedor uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select
    public.has_role('supervisor')
    and exists (
      select 1
      from public.equipo_vendedor ev
      join public.equipo_supervisor es
        on es.id_equipo = ev.id_equipo
      where ev.id_vendedor = p_id_vendedor
        and (ev.fecha_fin is null or ev.fecha_fin >= current_date)
        and es.id_supervisor = auth.uid()
        and (es.fecha_fin is null or es.fecha_fin >= current_date)
    );
$$;


--
-- Name: migrar_vendedores(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrar_vendedores() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.vendedores (nombre, rut, dv, equipo_id, supervisor_id, activo)
  SELECT
    t.nombre,
    t.rut,
    t.dv,
    e.id AS equipo_id,
    p.id AS supervisor_id,
    TRUE
  FROM public.tmp_vendedores t
  JOIN public.equipos e ON lower(e.nombre) = lower(t.equipo)
  JOIN public.profiles p ON lower(p.nombre) = lower(t.supervisor)
  WHERE public.validar_rut(t.rut, t.dv)
    AND NOT EXISTS (
      SELECT 1 FROM public.vendedores v WHERE v.rut = t.rut
    );
END;
$$;


--
-- Name: migrar_ventas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrar_ventas() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.ventas (vendedor_id, supervisor_id, equipo_id, fecha, monto)
  SELECT
    v.id AS vendedor_id,
    v.supervisor_id,
    v.equipo_id,
    t.fecha,
    COALESCE(t.monto_millones, 0)
  FROM public.tmp_ventas t
  JOIN public.vendedores v
    ON v.rut = t.vendedor_rut
   AND v.dv  = t.vendedor_dv
  JOIN public.equipos e
    ON e.id = v.equipo_id
  WHERE public.validar_rut(t.vendedor_rut, t.vendedor_dv);
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: sync_profile_role_from_user_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profile_role_from_user_roles(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare v_role text;
begin
  select ur.role into v_role
  from public.user_roles ur
  where ur.user_id = p_user_id
    and ur.activo = true
    and ur.fecha_inicio <= current_date
    and (ur.fecha_fin is null or ur.fecha_fin >= current_date)
  order by ur.fecha_inicio desc, ur.creado desc
  limit 1;

  if v_role is not null then
    update public.profiles
       set role = lower(v_role)
     where id = p_user_id;
  end if;
end;
$$;


--
-- Name: trg_bloqueo_compromisos_por_dia(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_bloqueo_compromisos_por_dia() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_hoy date := current_date;
  v_es_principal boolean := false;
begin
  -- Permitir siempre HOY
  if new.fecha_compromiso = v_hoy then
    return new;
  end if;

  -- (Opcional) Excepción: supervisor principal
  -- Ajusta esta consulta si tu modelo difiere
  select exists (
    select 1
    from public.equipo_supervisor es
    where es.id_equipo = new.id_equipo
      and es.id_supervisor = auth.uid()
      and es.es_principal = true
  )
  into v_es_principal;

  if v_es_principal then
    return new;
  end if;

  -- Bloquear AYER y anteriores
  if new.fecha_compromiso < v_hoy then
    raise exception
      'Compromisos de días anteriores están bloqueados. Solo hoy es editable.';
  end if;

  return new;
end;
$$;


--
-- Name: trg_compromisos_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_compromisos_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.compromisos_audit (
      id_compromiso,
      id_equipo,
      id_vendedor,
      id_tipo,
      fecha_compromiso,
      monto_anterior,
      monto_nuevo,
      accion,
      usuario
    )
    values (
      new.id_compromiso,
      new.id_equipo,
      new.id_vendedor,
      new.id_tipo,
      new.fecha_compromiso,
      null,
      new.monto_comprometido,
      'INSERT',
      auth.uid()
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.compromisos_audit (
      id_compromiso,
      id_equipo,
      id_vendedor,
      id_tipo,
      fecha_compromiso,
      monto_anterior,
      monto_nuevo,
      accion,
      usuario
    )
    values (
      new.id_compromiso,
      new.id_equipo,
      new.id_vendedor,
      new.id_tipo,
      new.fecha_compromiso,
      old.monto_comprometido,
      new.monto_comprometido,
      'UPDATE',
      auth.uid()
    );
    return new;
  end if;

  return new;
end;
$$;


--
-- Name: trg_user_roles_sync_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_user_roles_sync_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  perform public.sync_profile_role_from_user_roles(coalesce(new.user_id, old.user_id));
  return null;
end;
$$;


--
-- Name: trg_validar_rut_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_validar_rut_profile() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if new.rut is null or btrim(new.rut) = '' or new.dv is null or btrim(new.dv::text) = '' then
    return new;
  end if;

  if not public.validar_rut(new.rut, new.dv) then
    raise exception 'RUT inválido';
  end if;

  return new;
end;
$$;


--
-- Name: trg_validar_rut_vendedor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_validar_rut_vendedor() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NOT public.validar_rut(NEW.rut, NEW.dv) THEN
    RAISE EXCEPTION 'RUT inválido para vendedor: %-%', NEW.rut, NEW.dv;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: upsert_compromiso(uuid, uuid, uuid, date, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_compromiso(p_id_equipo uuid, p_id_vendedor uuid, p_id_tipo uuid, p_fecha date, p_monto numeric, p_comentario text DEFAULT NULL::text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  insert into public.compromisos (
    id_compromiso,
    id_tipo,
    id_supervisor,
    id_equipo,
    id_vendedor,
    fecha_compromiso,
    monto_comprometido,
    cumplido,
    comentario,
    fecha_creacion
  )
  values (
    gen_random_uuid(),
    p_id_tipo,
    auth.uid(),
    p_id_equipo,
    p_id_vendedor,
    p_fecha,
    p_monto,
    false,
    p_comentario,
    now()
  )
  on conflict (id_equipo, id_vendedor, id_tipo, fecha_compromiso)
  do update set
    monto_comprometido = excluded.monto_comprometido,
    comentario = excluded.comentario;
$$;


--
-- Name: user_roles_require_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_roles_require_profile() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.user_id) then
    raise exception 'No existe profile para user_id %. Cree el profile (rut/dv) antes de asignar roles.', new.user_id;
  end if;
  return new;
end;
$$;


--
-- Name: validar_fecha_venta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_fecha_venta() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  hoy date := current_date;
  inicio_mes_actual date := date_trunc('month', hoy)::date;
  ultimo_mes_anterior date := (date_trunc('month', hoy) - interval '1 day')::date;
  penultimo_mes_anterior date := (date_trunc('month', hoy) - interval '2 days')::date;
begin
  -- Caso 1: mes actual
  if new.fecha_venta >= inicio_mes_actual then
    return new;
  end if;

  -- Caso 2: excepción días 1 o 2
  if extract(day from hoy) <= 2
     and new.fecha_venta between penultimo_mes_anterior and ultimo_mes_anterior then
    return new;
  end if;

  -- Caso inválido
  raise exception
    'Fecha de venta fuera de rango permitido. Mes actual o últimos 2 días del mes anterior (si hoy es día 1 o 2).'
    using errcode = '22007';
end;
$$;


--
-- Name: validar_recontratacion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_recontratacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  ult_egreso date;
BEGIN
  -- Normaliza DV y fecha_ingreso
  NEW.dv := UPPER(NEW.dv);
  IF NEW.fecha_ingreso IS NULL THEN
    NEW.fecha_ingreso := CURRENT_DATE;
  END IF;

  -- Busca la última fecha de egreso para el mismo RUT+DV
  SELECT MAX(v.fecha_egreso)
    INTO ult_egreso
  FROM public.vendedores v
  WHERE v.rut = NEW.rut
    AND UPPER(v.dv::text) = NEW.dv::text;

  -- Si existe egreso y la nueva fecha de ingreso es <= a ese egreso -> error
  IF ult_egreso IS NOT NULL AND NEW.fecha_ingreso <= ult_egreso THEN
    RAISE EXCEPTION
      'El RUT %-% ya tiene una desvinculación igual o posterior a la fecha de ingreso indicada.',
      NEW.rut, NEW.dv;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: validar_rut(text, character); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_rut(p_rut text, p_dv character) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  rut_limpio text;
  dv_in text;
  i integer;
  factor integer := 2;
  suma integer := 0;
  dig integer;
  resto integer;
  dv_calc text;
begin
  -- Null/empty safe
  if p_rut is null or btrim(p_rut) = '' or p_dv is null or btrim(p_dv::text) = '' then
    return false;
  end if;

  rut_limpio := regexp_replace(lower(btrim(p_rut)), '[^0-9]', '', 'g');
  dv_in := lower(btrim(p_dv::text));

  if rut_limpio is null or length(rut_limpio) < 1 then
    return false;
  end if;

  for i in reverse length(rut_limpio)..1 loop
    dig := substr(rut_limpio, i, 1)::int;
    suma := suma + dig * factor;
    factor := case when factor = 7 then 2 else factor + 1 end;
  end loop;

  resto := 11 - (suma % 11);
  dv_calc :=
    case
      when resto = 11 then '0'
      when resto = 10 then 'k'
      else resto::text
    end;

  return dv_calc = dv_in;
end;
$$;


--
-- Name: validar_supervisor_activo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_supervisor_activo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM equipo_supervisor
    WHERE id_equipo = NEW.id_equipo
      AND id_supervisor = NEW.id_supervisor
      AND fecha_fin IS NULL
      AND id_relacion <> NEW.id_relacion
  ) THEN
    RAISE EXCEPTION 'Ya existe un registro activo para este supervisor y equipo.';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validar_vendedor_activo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_vendedor_activo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.fecha_fin IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.equipo_vendedor
      WHERE id_equipo   = NEW.id_equipo
        AND id_vendedor = NEW.id_vendedor
        AND fecha_fin IS NULL
        AND id_relacion IS DISTINCT FROM NEW.id_relacion
    ) THEN
      RAISE EXCEPTION 'El vendedor ya tiene una asignación activa en este equipo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: vendedores_enforce_creado_por(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vendedores_enforce_creado_por() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Operación sin usuario autenticado';
  END IF;
  NEW.creado_por := auth.uid();
  RETURN NEW;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: compromisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compromisos (
    id_compromiso uuid DEFAULT gen_random_uuid() NOT NULL,
    id_tipo uuid NOT NULL,
    id_supervisor uuid NOT NULL,
    id_equipo uuid NOT NULL,
    id_vendedor uuid NOT NULL,
    fecha_compromiso date NOT NULL,
    monto_comprometido numeric NOT NULL,
    cumplido boolean DEFAULT false,
    comentario text,
    fecha_creacion timestamp without time zone DEFAULT now()
);


--
-- Name: compromisos_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compromisos_audit (
    id_audit uuid DEFAULT gen_random_uuid() NOT NULL,
    id_compromiso uuid,
    id_equipo uuid NOT NULL,
    id_vendedor uuid,
    id_tipo uuid,
    fecha_compromiso date,
    monto_anterior numeric,
    monto_nuevo numeric NOT NULL,
    accion text NOT NULL,
    usuario uuid NOT NULL,
    fecha_evento timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT compromisos_audit_accion_check CHECK ((accion = ANY (ARRAY['INSERT'::text, 'UPDATE'::text])))
);


--
-- Name: equipo_supervisor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipo_supervisor (
    id_relacion uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    id_equipo uuid NOT NULL,
    id_supervisor uuid NOT NULL,
    es_principal boolean DEFAULT false,
    fecha_inicio date DEFAULT CURRENT_DATE NOT NULL,
    fecha_fin date,
    motivo_suplencia character varying(100),
    id_motivo uuid,
    CONSTRAINT suplente_con_motivo_chk CHECK (((es_principal = true) OR (id_motivo IS NOT NULL))),
    CONSTRAINT titular_sin_motivo_chk CHECK (((es_principal = false) OR (id_motivo IS NULL)))
);


--
-- Name: equipo_vendedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipo_vendedor (
    id_relacion uuid DEFAULT gen_random_uuid() NOT NULL,
    id_equipo uuid NOT NULL,
    id_vendedor uuid NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    estado boolean DEFAULT true
);

ALTER TABLE ONLY public.equipo_vendedor FORCE ROW LEVEL SECURITY;


--
-- Name: equipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipos (
    id_equipo uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nombre_equipo character varying(100) NOT NULL,
    fecha_creacion date DEFAULT CURRENT_DATE
);


--
-- Name: historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historial (
    id integer NOT NULL,
    descripcion text,
    fecha timestamp without time zone DEFAULT now()
);


--
-- Name: historial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.historial_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.historial_id_seq OWNED BY public.historial.id;


--
-- Name: historial_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historial_roles (
    id_historial uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario uuid NOT NULL,
    rol_anterior text,
    rol_nuevo text NOT NULL,
    fecha_evento timestamp with time zone DEFAULT now() NOT NULL,
    actor uuid,
    motivo text
);


--
-- Name: motivo_suplencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.motivo_suplencia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre_motivo character varying(100) NOT NULL,
    descripcion text
);


--
-- Name: motivo_suplencia_id_motivo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.motivo_suplencia_id_motivo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: motivo_suplencia_id_motivo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.motivo_suplencia_id_motivo_seq OWNED BY public.motivo_suplencia.id;


--
-- Name: movimientos_personales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_personales (
    id bigint NOT NULL,
    usuario_id uuid,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    tipo text,
    detalle text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT movimientos_personales_tipo_check CHECK ((tipo = ANY (ARRAY['cambio_equipo'::text, 'ascenso'::text, 'baja'::text])))
);


--
-- Name: movimientos_personales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimientos_personales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_personales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimientos_personales_id_seq OWNED BY public.movimientos_personales.id;


--
-- Name: mv_compromisos_semana; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.mv_compromisos_semana AS
 SELECT id_equipo,
    id_vendedor,
    id_tipo,
    (date_trunc('week'::text, (fecha_compromiso)::timestamp with time zone))::date AS semana_inicio,
    sum(monto_comprometido) AS monto_total
   FROM public.compromisos c
  GROUP BY id_equipo, id_vendedor, id_tipo, ((date_trunc('week'::text, (fecha_compromiso)::timestamp with time zone))::date)
  WITH NO DATA;


--
-- Name: objetivos_semanales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objetivos_semanales (
    id_objetivo uuid DEFAULT gen_random_uuid() NOT NULL,
    id_equipo uuid NOT NULL,
    semana_inicio date NOT NULL,
    id_vendedor uuid,
    objetivo numeric NOT NULL,
    fuente text DEFAULT 'manual'::text NOT NULL,
    creado_por uuid DEFAULT auth.uid() NOT NULL,
    creado_en timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario text NOT NULL,
    nombre text NOT NULL,
    role text NOT NULL,
    rut text NOT NULL,
    dv character(1) NOT NULL,
    email text NOT NULL,
    activo boolean DEFAULT true,
    creado timestamp without time zone DEFAULT now(),
    genero text NOT NULL,
    fecha_fin timestamp without time zone,
    fecha_inicio timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_fechas_ok CHECK (((fecha_fin IS NULL) OR (fecha_fin >= fecha_inicio))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'vendedor'::text]))),
    CONSTRAINT profiles_valid_dates CHECK (((fecha_fin IS NULL) OR (fecha_inicio <= fecha_fin)))
);


--
-- Name: COLUMN profiles.genero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.genero IS 'Genero del Usuario';


--
-- Name: profiles_activos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profiles_activos WITH (security_invoker='true') AS
 SELECT id,
    usuario,
    nombre,
    email,
    role,
    genero,
    activo,
    fecha_inicio,
    fecha_fin,
    creado
   FROM public.profiles
  WHERE ((activo = true) AND ((fecha_fin IS NULL) OR (fecha_fin >= now())) AND (id = auth.uid()));


--
-- Name: profiles_historial; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profiles_historial WITH (security_invoker='true') AS
 SELECT id,
    usuario,
    nombre,
    email,
    role,
    activo,
    fecha_inicio,
    fecha_fin,
    genero,
    creado
   FROM public.profiles
  WHERE (id = auth.uid())
  ORDER BY id, fecha_inicio;


--
-- Name: supervisores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervisores (
    id_supervisor uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nombre_supervisor character varying(100) NOT NULL,
    vigente boolean DEFAULT true,
    id_usuario uuid
);


--
-- Name: tipos_compromisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_compromisos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supervisor_id uuid,
    nombre text NOT NULL,
    descripcion text,
    activo boolean DEFAULT true,
    fecha_creacion timestamp without time zone DEFAULT now(),
    es_obligatorio boolean DEFAULT false NOT NULL,
    orden integer
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    fecha_inicio date DEFAULT CURRENT_DATE NOT NULL,
    fecha_fin date,
    creado timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_roles_fechas_ok CHECK (((fecha_fin IS NULL) OR (fecha_fin >= fecha_inicio))),
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'vendedor'::text])))
);


--
-- Name: vendedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendedores (
    id_vendedor uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nombre character varying(100) NOT NULL,
    fecha_ingreso date DEFAULT CURRENT_DATE,
    fecha_egreso date,
    estado text DEFAULT 'ACTIVO'::text,
    creado_por uuid DEFAULT auth.uid(),
    fecha_creacion timestamp without time zone DEFAULT now(),
    rut bigint NOT NULL,
    dv character(1) NOT NULL,
    id_usuario uuid
);

ALTER TABLE ONLY public.vendedores FORCE ROW LEVEL SECURITY;


--
-- Name: ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ventas (
    id_venta uuid DEFAULT gen_random_uuid() NOT NULL,
    id_vendedor uuid,
    fecha_venta date DEFAULT now() NOT NULL,
    monto numeric(12,2) NOT NULL,
    descripcion text,
    tipo_venta text,
    es_plan boolean DEFAULT false,
    CONSTRAINT ventas_tipo_venta_check CHECK ((tipo_venta = ANY (ARRAY['TOPE'::text, 'SOBRE'::text, 'BAJO'::text, 'PLAN'::text, 'PV'::text])))
);

ALTER TABLE ONLY public.ventas FORCE ROW LEVEL SECURITY;


--
-- Name: vista_equipo_supervisor_dia; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vista_equipo_supervisor_dia WITH (security_invoker='true') AS
 SELECT es.id_supervisor,
    p.nombre AS nombre_supervisor,
    p.genero,
    e.id_equipo,
    e.nombre_equipo,
        CASE
            WHEN es.es_principal THEN 'principal'::text
            ELSE 'suplente'::text
        END AS tipo_asignacion,
    ((CURRENT_DATE >= es.fecha_inicio) AND (CURRENT_DATE <= COALESCE(es.fecha_fin, CURRENT_DATE))) AS vigente
   FROM ((public.equipo_supervisor es
     JOIN public.equipos e ON ((e.id_equipo = es.id_equipo)))
     JOIN public.profiles p ON ((p.id = es.id_supervisor)))
  WHERE (es.id_supervisor = auth.uid());


--
-- Name: vista_supervisor_equipo_vendedor; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vista_supervisor_equipo_vendedor WITH (security_invoker='true') AS
 SELECT v.id_vendedor,
    v.rut,
    v.dv,
    ((replace(to_char(v.rut, 'FM999G999G999'::text), ','::text, '.'::text) || '-'::text) || (v.dv)::text) AS rut_vendedor_formateado,
    v.nombre AS nombre_vendedor,
    ev.id_relacion,
    ev.id_equipo,
    e.nombre_equipo,
    es.id_supervisor,
    s.nombre_supervisor,
    v.fecha_ingreso,
    v.fecha_egreso
   FROM ((((public.vendedores v
     JOIN public.equipo_vendedor ev ON (((ev.id_vendedor = v.id_vendedor) AND (ev.fecha_fin IS NULL) AND COALESCE(ev.estado, true))))
     JOIN public.equipos e ON ((e.id_equipo = ev.id_equipo)))
     JOIN public.equipo_supervisor es ON (((es.id_equipo = e.id_equipo) AND (es.fecha_fin IS NULL))))
     JOIN public.supervisores s ON ((s.id_supervisor = es.id_supervisor)))
  WHERE (es.id_supervisor = auth.uid());


--
-- Name: vista_supervisor_equipo_vendedor_full; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vista_supervisor_equipo_vendedor_full AS
 SELECT v.id_vendedor,
    v.rut,
    v.dv,
    ((replace(to_char(v.rut, 'FM999G999G999'::text), ','::text, '.'::text) || '-'::text) || (v.dv)::text) AS rut_vendedor_formateado,
    v.nombre AS nombre_vendedor,
    ev.id_relacion,
    ev.id_equipo,
    e.nombre_equipo,
    es.id_supervisor,
    s.nombre_supervisor,
    v.fecha_ingreso,
    v.fecha_egreso
   FROM ((((public.vendedores v
     LEFT JOIN public.equipo_vendedor ev ON ((ev.id_vendedor = v.id_vendedor)))
     LEFT JOIN public.equipos e ON ((e.id_equipo = ev.id_equipo)))
     LEFT JOIN public.equipo_supervisor es ON ((es.id_equipo = e.id_equipo)))
     LEFT JOIN public.supervisores s ON ((s.id_supervisor = es.id_supervisor)))
  WHERE (es.id_supervisor = auth.uid());


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: historial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial ALTER COLUMN id SET DEFAULT nextval('public.historial_id_seq'::regclass);


--
-- Name: movimientos_personales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_personales ALTER COLUMN id SET DEFAULT nextval('public.movimientos_personales_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: compromisos_audit compromisos_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compromisos_audit
    ADD CONSTRAINT compromisos_audit_pkey PRIMARY KEY (id_audit);


--
-- Name: compromisos compromisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compromisos
    ADD CONSTRAINT compromisos_pkey PRIMARY KEY (id_compromiso);


--
-- Name: equipo_supervisor equipo_supervisor_id_equipo_id_supervisor_fecha_inicio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_supervisor
    ADD CONSTRAINT equipo_supervisor_id_equipo_id_supervisor_fecha_inicio_key UNIQUE (id_equipo, id_supervisor, fecha_inicio);


--
-- Name: equipo_supervisor equipo_supervisor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_supervisor
    ADD CONSTRAINT equipo_supervisor_pkey PRIMARY KEY (id_relacion);


--
-- Name: equipo_vendedor equipo_vendedor_no_solapado; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_vendedor
    ADD CONSTRAINT equipo_vendedor_no_solapado EXCLUDE USING gist (id_vendedor WITH =, daterange(fecha_inicio, COALESCE(fecha_fin, 'infinity'::date)) WITH &&);


--
-- Name: equipo_vendedor equipo_vendedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_vendedor
    ADD CONSTRAINT equipo_vendedor_pkey PRIMARY KEY (id_relacion);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id_equipo);


--
-- Name: historial historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial
    ADD CONSTRAINT historial_pkey PRIMARY KEY (id);


--
-- Name: historial_roles historial_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_roles
    ADD CONSTRAINT historial_roles_pkey PRIMARY KEY (id_historial);


--
-- Name: motivo_suplencia motivo_suplencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motivo_suplencia
    ADD CONSTRAINT motivo_suplencia_pkey PRIMARY KEY (id);


--
-- Name: movimientos_personales movimientos_personales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_personales
    ADD CONSTRAINT movimientos_personales_pkey PRIMARY KEY (id);


--
-- Name: objetivos_semanales objetivos_semanales_id_equipo_semana_inicio_id_vendedor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objetivos_semanales
    ADD CONSTRAINT objetivos_semanales_id_equipo_semana_inicio_id_vendedor_key UNIQUE (id_equipo, semana_inicio, id_vendedor);


--
-- Name: objetivos_semanales objetivos_semanales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objetivos_semanales
    ADD CONSTRAINT objetivos_semanales_pkey PRIMARY KEY (id_objetivo);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pk PRIMARY KEY (id, fecha_inicio);


--
-- Name: profiles profiles_usuario_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_usuario_key UNIQUE (usuario);


--
-- Name: equipo_supervisor supervisor_principal_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_supervisor
    ADD CONSTRAINT supervisor_principal_no_overlap EXCLUDE USING gist (id_equipo WITH =, id_supervisor WITH =, tsrange((fecha_inicio)::timestamp without time zone, (fecha_fin)::timestamp without time zone, '[]'::text) WITH &&);


--
-- Name: supervisores supervisores_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisores
    ADD CONSTRAINT supervisores_id_usuario_key UNIQUE (id_usuario);


--
-- Name: supervisores supervisores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisores
    ADD CONSTRAINT supervisores_pkey PRIMARY KEY (id_supervisor);


--
-- Name: tipos_compromisos tipos_compromisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_compromisos
    ADD CONSTRAINT tipos_compromisos_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: equipo_vendedor vendedor_equipo_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_vendedor
    ADD CONSTRAINT vendedor_equipo_no_overlap EXCLUDE USING gist (id_equipo WITH =, id_vendedor WITH =, tsrange((fecha_inicio)::timestamp without time zone, (fecha_fin)::timestamp without time zone, '[]'::text) WITH &&);


--
-- Name: vendedores vendedores_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendedores
    ADD CONSTRAINT vendedores_id_usuario_key UNIQUE (id_usuario);


--
-- Name: vendedores vendedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendedores
    ADD CONSTRAINT vendedores_pkey PRIMARY KEY (id_vendedor);


--
-- Name: vendedores vendedores_rut_dv_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendedores
    ADD CONSTRAINT vendedores_rut_dv_unico UNIQUE (rut, dv);


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id_venta);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: idx_compromisos_audit_equipo_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compromisos_audit_equipo_fecha ON public.compromisos_audit USING btree (id_equipo, fecha_evento);


--
-- Name: idx_compromisos_audit_vendedor_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compromisos_audit_vendedor_fecha ON public.compromisos_audit USING btree (id_vendedor, fecha_evento);


--
-- Name: idx_compromisos_equipo_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compromisos_equipo_fecha ON public.compromisos USING btree (id_equipo, fecha_compromiso);


--
-- Name: idx_compromisos_equipo_tipo_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compromisos_equipo_tipo_fecha ON public.compromisos USING btree (id_equipo, id_tipo, fecha_compromiso) WHERE (id_tipo IS NOT NULL);


--
-- Name: idx_compromisos_equipo_vendedor_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compromisos_equipo_vendedor_fecha ON public.compromisos USING btree (id_equipo, id_vendedor, fecha_compromiso) WHERE (id_vendedor IS NOT NULL);


--
-- Name: idx_es_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_es_equipo ON public.equipo_supervisor USING btree (id_equipo);


--
-- Name: idx_es_superv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_es_superv ON public.equipo_supervisor USING btree (id_supervisor);


--
-- Name: idx_ev_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ev_equipo ON public.equipo_vendedor USING btree (id_equipo);


--
-- Name: idx_ev_vendedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ev_vendedor ON public.equipo_vendedor USING btree (id_vendedor);


--
-- Name: idx_mv_comp_semana_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mv_comp_semana_equipo ON public.mv_compromisos_semana USING btree (id_equipo, semana_inicio);


--
-- Name: idx_mv_comp_semana_equipo_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mv_comp_semana_equipo_tipo ON public.mv_compromisos_semana USING btree (id_equipo, semana_inicio, id_tipo);


--
-- Name: idx_mv_comp_semana_equipo_vendedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mv_comp_semana_equipo_vendedor ON public.mv_compromisos_semana USING btree (id_equipo, semana_inicio, id_vendedor);


--
-- Name: idx_obj_semana_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obj_semana_equipo ON public.objetivos_semanales USING btree (id_equipo, semana_inicio);


--
-- Name: idx_profiles_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_activo ON public.profiles USING btree (activo);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_profiles_vigencia; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_profiles_vigencia ON public.profiles USING btree (id, fecha_inicio);


--
-- Name: idx_tipos_compromisos_activo_supervisor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tipos_compromisos_activo_supervisor ON public.tipos_compromisos USING btree (activo, supervisor_id);


--
-- Name: idx_tipos_compromisos_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tipos_compromisos_orden ON public.tipos_compromisos USING btree (orden);


--
-- Name: idx_v_idusuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v_idusuario ON public.vendedores USING btree (id_usuario);


--
-- Name: idx_ventas_vendedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_vendedor ON public.ventas USING btree (id_vendedor);


--
-- Name: profiles_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_unique_active ON public.profiles USING btree (id) WHERE (activo = true);


--
-- Name: profiles_unique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_unique_id ON public.profiles USING btree (id);


--
-- Name: ux_compromisos_upsert; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_compromisos_upsert ON public.compromisos USING btree (id_equipo, id_vendedor, id_tipo, fecha_compromiso);


--
-- Name: ux_mv_compromisos_semana; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_mv_compromisos_semana ON public.mv_compromisos_semana USING btree (id_equipo, semana_inicio, id_vendedor, id_tipo);


--
-- Name: ux_user_roles_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_user_roles_one_active ON public.user_roles USING btree (user_id) WHERE ((activo = true) AND (fecha_fin IS NULL));


--
-- Name: ux_user_roles_vigente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_user_roles_vigente ON public.user_roles USING btree (user_id) WHERE (fecha_fin IS NULL);


--
-- Name: vendedores_rut_dv_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vendedores_rut_dv_uniq ON public.vendedores USING btree (rut, dv);


--
-- Name: vendedores_rut_dv_vigente_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vendedores_rut_dv_vigente_uniq ON public.vendedores USING btree (rut, dv) WHERE (fecha_egreso IS NULL);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: users on_auth_user_deleted; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_deleted AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();


--
-- Name: equipo_supervisor tr_cerrar_asignacion_supervisor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_cerrar_asignacion_supervisor BEFORE INSERT ON public.equipo_supervisor FOR EACH ROW EXECUTE FUNCTION public.fn_cerrar_asignacion_supervisor();


--
-- Name: equipo_vendedor tr_cerrar_asignacion_vendedor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_cerrar_asignacion_vendedor BEFORE INSERT ON public.equipo_vendedor FOR EACH ROW EXECUTE FUNCTION public.fn_cerrar_asignacion_vendedor();


--
-- Name: compromisos trg_bloqueo_compromisos_por_dia; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bloqueo_compromisos_por_dia BEFORE INSERT OR UPDATE ON public.compromisos FOR EACH ROW EXECUTE FUNCTION public.trg_bloqueo_compromisos_por_dia();


--
-- Name: compromisos trg_compromisos_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compromisos_audit AFTER INSERT OR UPDATE ON public.compromisos FOR EACH ROW EXECUTE FUNCTION public.trg_compromisos_audit();


--
-- Name: user_roles trg_user_roles_require_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_roles_require_profile BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.user_roles_require_profile();


--
-- Name: user_roles trg_user_roles_sync_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_roles_sync_profile AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.trg_user_roles_sync_profile();


--
-- Name: vendedores trg_validar_recontratacion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_recontratacion BEFORE INSERT ON public.vendedores FOR EACH ROW EXECUTE FUNCTION public.validar_recontratacion();


--
-- Name: equipo_supervisor trg_validar_supervisor_activo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_supervisor_activo BEFORE INSERT OR UPDATE ON public.equipo_supervisor FOR EACH ROW EXECUTE FUNCTION public.validar_supervisor_activo();


--
-- Name: equipo_vendedor trg_validar_vendedor_activo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_vendedor_activo BEFORE INSERT OR UPDATE ON public.equipo_vendedor FOR EACH ROW EXECUTE FUNCTION public.validar_vendedor_activo();


--
-- Name: vendedores trg_vendedores_enforce_creado_por; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vendedores_enforce_creado_por BEFORE INSERT ON public.vendedores FOR EACH ROW EXECUTE FUNCTION public.vendedores_enforce_creado_por();


--
-- Name: profiles validar_rut_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validar_rut_profile BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_validar_rut_profile();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: compromisos compromisos_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compromisos
    ADD CONSTRAINT compromisos_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_equipo);


--
-- Name: compromisos compromisos_id_supervisor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compromisos
    ADD CONSTRAINT compromisos_id_supervisor_fkey FOREIGN KEY (id_supervisor) REFERENCES public.supervisores(id_supervisor);


--
-- Name: compromisos compromisos_id_tipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compromisos
    ADD CONSTRAINT compromisos_id_tipo_fkey FOREIGN KEY (id_tipo) REFERENCES public.tipos_compromisos(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: compromisos compromisos_id_vendedor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compromisos
    ADD CONSTRAINT compromisos_id_vendedor_fkey FOREIGN KEY (id_vendedor) REFERENCES public.vendedores(id_vendedor);


--
-- Name: equipo_supervisor equipo_supervisor_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_supervisor
    ADD CONSTRAINT equipo_supervisor_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_equipo) ON DELETE CASCADE;


--
-- Name: equipo_supervisor equipo_supervisor_id_motivo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_supervisor
    ADD CONSTRAINT equipo_supervisor_id_motivo_fkey FOREIGN KEY (id_motivo) REFERENCES public.motivo_suplencia(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: equipo_supervisor equipo_supervisor_id_supervisor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_supervisor
    ADD CONSTRAINT equipo_supervisor_id_supervisor_fkey FOREIGN KEY (id_supervisor) REFERENCES public.supervisores(id_supervisor) ON DELETE CASCADE;


--
-- Name: equipo_vendedor equipo_vendedor_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_vendedor
    ADD CONSTRAINT equipo_vendedor_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_equipo);


--
-- Name: equipo_vendedor equipo_vendedor_id_vendedor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_vendedor
    ADD CONSTRAINT equipo_vendedor_id_vendedor_fkey FOREIGN KEY (id_vendedor) REFERENCES public.vendedores(id_vendedor);


--
-- Name: ventas fk_ventas_vendedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT fk_ventas_vendedor FOREIGN KEY (id_vendedor) REFERENCES public.vendedores(id_vendedor);


--
-- Name: historial_roles historial_roles_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_roles
    ADD CONSTRAINT historial_roles_actor_fkey FOREIGN KEY (actor) REFERENCES public.profiles(id);


--
-- Name: historial_roles historial_roles_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_roles
    ADD CONSTRAINT historial_roles_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.profiles(id);


--
-- Name: supervisores supervisores_id_usuario_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisores
    ADD CONSTRAINT supervisores_id_usuario_fk FOREIGN KEY (id_usuario) REFERENCES public.profiles(id);


--
-- Name: tipos_compromisos tipos_compromisos_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_compromisos
    ADD CONSTRAINT tipos_compromisos_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.supervisores(id_supervisor);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vendedores vendedores_creado_por_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendedores
    ADD CONSTRAINT vendedores_creado_por_fk FOREIGN KEY (creado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: vendedores vendedores_id_usuario_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendedores
    ADD CONSTRAINT vendedores_id_usuario_fk FOREIGN KEY (id_usuario) REFERENCES public.profiles(id);


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: tipos_compromisos admin_o_supervisor_actualiza_tipos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_o_supervisor_actualiza_tipos ON public.tipos_compromisos FOR UPDATE TO authenticated USING (((auth.uid() = supervisor_id) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text))) WITH CHECK (((auth.uid() = supervisor_id) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)));


--
-- Name: compromisos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compromisos ENABLE ROW LEVEL SECURITY;

--
-- Name: compromisos_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compromisos_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: compromisos compromisos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compromisos_delete ON public.compromisos FOR DELETE USING (public.is_admin());


--
-- Name: compromisos compromisos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compromisos_insert ON public.compromisos FOR INSERT WITH CHECK ((public.is_admin() OR public.is_supervisor_of_vendedor(id_vendedor)));


--
-- Name: compromisos compromisos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compromisos_select ON public.compromisos FOR SELECT USING ((public.is_admin() OR public.is_owner_vendedor(id_vendedor) OR public.is_supervisor_of_vendedor(id_vendedor)));


--
-- Name: compromisos compromisos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compromisos_update ON public.compromisos FOR UPDATE USING ((public.is_admin() OR public.is_supervisor_of_vendedor(id_vendedor))) WITH CHECK ((public.is_admin() OR public.is_supervisor_of_vendedor(id_vendedor)));


--
-- Name: equipo_supervisor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipo_supervisor ENABLE ROW LEVEL SECURITY;

--
-- Name: equipo_supervisor equipo_supervisor_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipo_supervisor_delete ON public.equipo_supervisor FOR DELETE USING (public.is_admin());


--
-- Name: equipo_supervisor equipo_supervisor_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipo_supervisor_insert ON public.equipo_supervisor FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: equipo_supervisor equipo_supervisor_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipo_supervisor_select_own ON public.equipo_supervisor FOR SELECT TO authenticated USING ((id_supervisor = auth.uid()));


--
-- Name: equipo_supervisor equipo_supervisor_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipo_supervisor_update ON public.equipo_supervisor FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: equipo_vendedor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipo_vendedor ENABLE ROW LEVEL SECURITY;

--
-- Name: equipo_vendedor equipo_vendedor_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipo_vendedor_delete ON public.equipo_vendedor FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: equipo_vendedor equipo_vendedor_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipo_vendedor_insert ON public.equipo_vendedor FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_supervisor_of_equipo(id_equipo)));


--
-- Name: equipo_vendedor equipo_vendedor_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipo_vendedor_select ON public.equipo_vendedor FOR SELECT TO authenticated USING ((public.is_admin() OR public.is_supervisor_of_equipo(id_equipo) OR (EXISTS ( SELECT 1
   FROM public.vendedores v
  WHERE ((v.id_vendedor = equipo_vendedor.id_vendedor) AND (v.id_usuario = auth.uid()))))));


--
-- Name: equipo_vendedor equipo_vendedor_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipo_vendedor_update ON public.equipo_vendedor FOR UPDATE TO authenticated USING ((public.is_admin() OR public.is_supervisor_of_equipo(id_equipo))) WITH CHECK ((public.is_admin() OR public.is_supervisor_of_equipo(id_equipo)));


--
-- Name: equipos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipos ENABLE ROW LEVEL SECURITY;

--
-- Name: equipos equipos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipos_delete ON public.equipos FOR DELETE USING (public.is_admin());


--
-- Name: equipos equipos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipos_insert ON public.equipos FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: equipos equipos_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipos_select_own ON public.equipos FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.equipo_supervisor es
  WHERE ((es.id_equipo = equipos.id_equipo) AND (es.id_supervisor = auth.uid())))));


--
-- Name: equipos equipos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipos_update ON public.equipos FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: historial; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historial ENABLE ROW LEVEL SECURITY;

--
-- Name: historial_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historial_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: historial_roles hr_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_select_admin ON public.historial_roles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text) AND (p.activo = true)))));


--
-- Name: historial_roles hr_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_select_self ON public.historial_roles FOR SELECT TO authenticated USING ((id_usuario = auth.uid()));


--
-- Name: motivo_suplencia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.motivo_suplencia ENABLE ROW LEVEL SECURITY;

--
-- Name: motivo_suplencia motivo_suplencia_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY motivo_suplencia_select_auth ON public.motivo_suplencia FOR SELECT TO authenticated USING (true);


--
-- Name: movimientos_personales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.movimientos_personales ENABLE ROW LEVEL SECURITY;

--
-- Name: objetivos_semanales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.objetivos_semanales ENABLE ROW LEVEL SECURITY;

--
-- Name: compromisos_audit p_compromisos_audit_select_by_supervisor_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_compromisos_audit_select_by_supervisor_equipo ON public.compromisos_audit FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.equipo_supervisor es
  WHERE ((es.id_equipo = compromisos_audit.id_equipo) AND (es.id_supervisor = auth.uid()) AND (CURRENT_DATE >= es.fecha_inicio) AND (CURRENT_DATE <= COALESCE(es.fecha_fin, CURRENT_DATE))))));


--
-- Name: objetivos_semanales p_obj_semanales_delete_by_supervisor_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_obj_semanales_delete_by_supervisor_equipo ON public.objetivos_semanales FOR DELETE TO authenticated USING (((creado_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.equipo_supervisor es
  WHERE ((es.id_equipo = objetivos_semanales.id_equipo) AND (es.id_supervisor = auth.uid()) AND (CURRENT_DATE >= es.fecha_inicio) AND (CURRENT_DATE <= COALESCE(es.fecha_fin, CURRENT_DATE)))))));


--
-- Name: objetivos_semanales p_obj_semanales_insert_by_supervisor_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_obj_semanales_insert_by_supervisor_equipo ON public.objetivos_semanales FOR INSERT TO authenticated WITH CHECK (((creado_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.equipo_supervisor es
  WHERE ((es.id_equipo = objetivos_semanales.id_equipo) AND (es.id_supervisor = auth.uid()) AND (CURRENT_DATE >= es.fecha_inicio) AND (CURRENT_DATE <= COALESCE(es.fecha_fin, CURRENT_DATE)))))));


--
-- Name: objetivos_semanales p_obj_semanales_select_by_supervisor_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_obj_semanales_select_by_supervisor_equipo ON public.objetivos_semanales FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.equipo_supervisor es
  WHERE ((es.id_equipo = objetivos_semanales.id_equipo) AND (es.id_supervisor = auth.uid()) AND (CURRENT_DATE >= es.fecha_inicio) AND (CURRENT_DATE <= COALESCE(es.fecha_fin, CURRENT_DATE))))));


--
-- Name: objetivos_semanales p_obj_semanales_update_by_supervisor_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_obj_semanales_update_by_supervisor_equipo ON public.objetivos_semanales FOR UPDATE TO authenticated USING (((creado_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.equipo_supervisor es
  WHERE ((es.id_equipo = objetivos_semanales.id_equipo) AND (es.id_supervisor = auth.uid()) AND (CURRENT_DATE >= es.fecha_inicio) AND (CURRENT_DATE <= COALESCE(es.fecha_fin, CURRENT_DATE))))))) WITH CHECK (((creado_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.equipo_supervisor es
  WHERE ((es.id_equipo = objetivos_semanales.id_equipo) AND (es.id_supervisor = auth.uid()) AND (CURRENT_DATE >= es.fecha_inicio) AND (CURRENT_DATE <= COALESCE(es.fecha_fin, CURRENT_DATE)))))));


--
-- Name: supervisores p_supervisores_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_supervisores_select_own ON public.supervisores FOR SELECT TO authenticated USING ((id_supervisor = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: supervisores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supervisores ENABLE ROW LEVEL SECURITY;

--
-- Name: tipos_compromisos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tipos_compromisos ENABLE ROW LEVEL SECURITY;

--
-- Name: tipos_compromisos tipos_compromisos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tipos_compromisos_insert ON public.tipos_compromisos FOR INSERT TO authenticated WITH CHECK ((((auth.jwt() ->> 'role'::text) = 'admin'::text) OR ((supervisor_id = auth.uid()) AND (COALESCE(es_obligatorio, false) = false))));


--
-- Name: tipos_compromisos tipos_compromisos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tipos_compromisos_select ON public.tipos_compromisos FOR SELECT TO authenticated USING ((((auth.jwt() ->> 'role'::text) = 'admin'::text) OR (supervisor_id = auth.uid()) OR ((es_obligatorio = true) AND (activo = true))));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_delete ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: user_roles user_roles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_insert ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: user_roles user_roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated USING ((public.is_admin() OR (user_id = auth.uid())));


--
-- Name: user_roles user_roles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_update ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: vendedores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

--
-- Name: vendedores vendedores_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendedores_delete ON public.vendedores FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: vendedores vendedores_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendedores_insert ON public.vendedores FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: vendedores vendedores_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendedores_select ON public.vendedores FOR SELECT TO authenticated USING ((public.is_admin() OR (id_usuario = auth.uid()) OR public.is_supervisor_of_vendedor(id_vendedor)));


--
-- Name: vendedores vendedores_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendedores_update ON public.vendedores FOR UPDATE TO authenticated USING ((public.is_admin() OR (id_usuario = auth.uid()) OR public.is_supervisor_of_vendedor(id_vendedor))) WITH CHECK ((public.is_admin() OR (id_usuario = auth.uid()) OR public.is_supervisor_of_vendedor(id_vendedor)));


--
-- Name: ventas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

--
-- Name: ventas ventas_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ventas_delete ON public.ventas FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = 'admin'::text) AND (p.activo = true)))));


--
-- Name: ventas ventas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ventas_insert ON public.ventas FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.equipo_vendedor ev
     JOIN public.equipo_supervisor es ON ((es.id_equipo = ev.id_equipo)))
  WHERE ((ev.id_vendedor = ventas.id_vendedor) AND (es.id_supervisor = auth.uid()) AND (COALESCE(ev.estado, true) = true) AND ((ev.fecha_inicio IS NULL) OR (ev.fecha_inicio <= CURRENT_DATE)) AND ((ev.fecha_fin IS NULL) OR (ev.fecha_fin >= CURRENT_DATE))))));


--
-- Name: ventas ventas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ventas_select ON public.ventas FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = 'admin'::text) AND (p.activo = true)))) OR (EXISTS ( SELECT 1
   FROM (public.equipo_vendedor ev
     JOIN public.equipo_supervisor es ON ((es.id_equipo = ev.id_equipo)))
  WHERE ((ev.id_vendedor = ventas.id_vendedor) AND (es.id_supervisor = auth.uid()) AND (COALESCE(ev.estado, true) = true) AND ((ev.fecha_inicio IS NULL) OR (ev.fecha_inicio <= CURRENT_DATE)) AND ((ev.fecha_fin IS NULL) OR (ev.fecha_fin >= CURRENT_DATE)) AND ((es.fecha_inicio IS NULL) OR (es.fecha_inicio <= CURRENT_DATE)) AND ((es.fecha_fin IS NULL) OR (es.fecha_fin >= CURRENT_DATE)))))));


--
-- Name: ventas ventas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ventas_update ON public.ventas FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM (public.equipo_vendedor ev
     JOIN public.equipo_supervisor es ON ((es.id_equipo = ev.id_equipo)))
  WHERE ((ev.id_vendedor = ventas.id_vendedor) AND (es.id_supervisor = auth.uid()) AND (COALESCE(ev.estado, true) = true) AND ((ev.fecha_inicio IS NULL) OR (ev.fecha_inicio <= CURRENT_DATE)) AND ((ev.fecha_fin IS NULL) OR (ev.fecha_fin >= CURRENT_DATE)) AND ((es.fecha_inicio IS NULL) OR (es.fecha_inicio <= CURRENT_DATE)) AND ((es.fecha_fin IS NULL) OR (es.fecha_fin >= CURRENT_DATE))))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = 'admin'::text) AND (p.activo = true)))))) WITH CHECK (true);


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict e7cHOUVCv35tPth6cIxEnVkUhJFYoOMfzOvYtQAH22KcdxMAEplTymM1GOi6NDf

