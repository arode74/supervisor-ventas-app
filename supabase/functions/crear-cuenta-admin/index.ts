import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TipoCuenta = "vendedor" | "supervisor" | "zonal" | "admin";

type Payload = {
  tipo: TipoCuenta;
  nombre: string;
  usuario: string;
  rut: string;
  dv: string;
  email: string;
  activo: boolean;
  genero: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  must_change_password: boolean;
  id_perfil: number;
  id_equipo?: string | null;
  id_zona?: string | null;
  reemplazar_principal_vigente?: boolean;
  id_supervisor_vigente?: string | null;
  id_zonal_vigente?: string | null;
  password_temporal: string;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, message: "Método no permitido." });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, {
        ok: false,
        message: "Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = (await req.json()) as Payload;

    const {
      tipo,
      nombre,
      usuario,
      rut,
      dv,
      email,
      activo,
      genero,
      fecha_inicio = null,
      fecha_fin = null,
      must_change_password,
      id_perfil,
      id_equipo = null,
      id_zona = null,
      reemplazar_principal_vigente = false,
      id_supervisor_vigente = null,
      id_zonal_vigente = null,
      password_temporal,
    } = payload;

    if (!tipo || !nombre || !usuario || !rut || !dv || !email || !genero || !id_perfil || !password_temporal) {
      return json(400, {
        ok: false,
        message: "Faltan campos obligatorios.",
      });
    }

    if (!["vendedor", "supervisor", "zonal", "admin"].includes(tipo)) {
      return json(400, {
        ok: false,
        message: "Tipo de cuenta no soportado.",
      });
    }

    if (tipo === "vendedor" && !id_equipo) {
      return json(400, { ok: false, message: "Para vendedor debe informar id_equipo." });
    }

    if (tipo === "supervisor" && !id_equipo) {
      return json(400, { ok: false, message: "Para supervisor debe informar id_equipo." });
    }

    if (tipo === "zonal" && !id_zona) {
      return json(400, { ok: false, message: "Para zonal debe informar id_zona." });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password_temporal,
      email_confirm: true,
      user_metadata: {
        nombre,
        usuario,
        rut,
        dv,
        tipo,
      },
    });

    if (authError || !authData.user) {
      return json(400, {
        ok: false,
        message: authError?.message || "No fue posible crear el usuario en auth.users.",
      });
    }

    const userId = authData.user.id;

    let rpcName = "";
    let rpcPayload: Record<string, unknown> = {};

    if (tipo === "vendedor") {
      rpcName = "admin_crear_vendedor";
      rpcPayload = {
        p_user_id: userId,
        p_nombre: nombre,
        p_usuario: usuario,
        p_rut: rut,
        p_dv: dv,
        p_email: email,
        p_activo: activo,
        p_genero: genero,
        p_fecha_inicio: fecha_inicio,
        p_fecha_fin: fecha_fin,
        p_must_change_password: must_change_password,
        p_id_perfil: id_perfil,
        p_id_equipo: id_equipo,
      };
    }

    if (tipo === "supervisor") {
      rpcName = "admin_crear_supervisor";
      rpcPayload = {
        p_user_id: userId,
        p_nombre: nombre,
        p_usuario: usuario,
        p_rut: rut,
        p_dv: dv,
        p_email: email,
        p_activo: activo,
        p_genero: genero,
        p_fecha_inicio: fecha_inicio,
        p_fecha_fin: fecha_fin,
        p_must_change_password: must_change_password,
        p_id_perfil: id_perfil,
        p_id_equipo: id_equipo,
        p_reemplazar_principal_vigente: reemplazar_principal_vigente,
        p_id_supervisor_vigente: id_supervisor_vigente,
      };
    }

    if (tipo === "zonal") {
      rpcName = "admin_crear_zonal";
      rpcPayload = {
        p_user_id: userId,
        p_nombre: nombre,
        p_usuario: usuario,
        p_rut: rut,
        p_dv: dv,
        p_email: email,
        p_activo: activo,
        p_genero: genero,
        p_fecha_inicio: fecha_inicio,
        p_fecha_fin: fecha_fin,
        p_must_change_password: must_change_password,
        p_id_perfil: id_perfil,
        p_id_zona: id_zona,
        p_reemplazar_principal_vigente: reemplazar_principal_vigente,
        p_id_zonal_vigente: id_zonal_vigente,
      };
    }

    if (tipo === "admin") {
      rpcName = "admin_crear_admin";
      rpcPayload = {
        p_user_id: userId,
        p_nombre: nombre,
        p_usuario: usuario,
        p_rut: rut,
        p_dv: dv,
        p_email: email,
        p_activo: activo,
        p_genero: genero,
        p_must_change_password: must_change_password,
        p_id_perfil: id_perfil,
      };
    }

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(rpcName, rpcPayload);

    if (rpcError || !rpcData?.ok) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return json(400, {
        ok: false,
        message: rpcError?.message || rpcData?.message || "Falló la creación en base de datos. Se revirtió auth.users.",
      });
    }

    return json(200, {
      ok: true,
      message: rpcData.message || "Cuenta creada correctamente.",
      user_id: userId,
      tipo,
    });
  } catch (e) {
    return json(500, {
      ok: false,
      message: e instanceof Error ? e.message : "Error inesperado en la Edge Function.",
    });
  }
});