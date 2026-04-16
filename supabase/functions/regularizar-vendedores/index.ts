import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

function generarPassword(rut: string) {
  const limpio = String(rut ?? "").replace(/\D/g, "");
  const ultimos4 = limpio.slice(-4);
  return `Habitat${ultimos4}`;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (_req) => {
  console.log("inicio regularizar-vendedores");

  try {
    const { data: filas, error } = await supabase
      .from("stg_regularizacion_vendedores")
      .select("*")
      .eq("procesado", false)
      .order("id_staging", { ascending: true });

    if (error) {
      console.error("error leyendo staging:", error.message);
      return json(500, {
        ok: false,
        etapa: "select_staging",
        error: error.message,
      });
    }

    const pendientes = filas ?? [];
    console.log("filas pendientes:", pendientes.length);

    let creados = 0;
    let omitidos = 0;
    let errores = 0;

    for (const fila of pendientes) {
      try {
        const rut = String(fila.rut ?? "").trim();
        const dv = String(fila.dv ?? "").trim().toUpperCase();
        const email = String(fila.email ?? "").trim().toLowerCase();
        const usuario = String(fila.usuario ?? "").trim().toLowerCase();
        const genero = fila.genero ? String(fila.genero).trim() : null;
        const idVendedor = fila.id_vendedor;

        if (!rut || !dv || !email || !usuario || !idVendedor) {
          await supabase
            .from("stg_regularizacion_vendedores")
            .update({
              procesado: true,
              ok: false,
              mensaje: "Fila incompleta: faltan rut, dv, email, usuario o id_vendedor.",
              fecha_proceso: new Date().toISOString(),
            })
            .eq("id_staging", fila.id_staging);

          errores++;
          continue;
        }

        // 1) Verificar si el vendedor ya quedó vinculado
        const { data: relVendedor, error: relVendedorError } = await supabase
          .from("vendedor_usuario")
          .select("id_relacion,id_usuario")
          .eq("id_vendedor", idVendedor)
          .limit(1);

        if (relVendedorError) {
          throw new Error(`Error verificando vendedor_usuario por vendedor: ${relVendedorError.message}`);
        }

        if ((relVendedor ?? []).length > 0) {
          await supabase
            .from("stg_regularizacion_vendedores")
            .update({
              procesado: true,
              ok: true,
              mensaje: "OMITIDO: el vendedor ya tiene usuario relacionado.",
              fecha_proceso: new Date().toISOString(),
            })
            .eq("id_staging", fila.id_staging);

          omitidos++;
          continue;
        }

        // 2) Verificar colisión previa en profiles por email o usuario o rut
        const { data: profileEmail, error: profileEmailError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .limit(1);

        if (profileEmailError) {
          throw new Error(`Error verificando profiles por email: ${profileEmailError.message}`);
        }

        if ((profileEmail ?? []).length > 0) {
          await supabase
            .from("stg_regularizacion_vendedores")
            .update({
              procesado: true,
              ok: false,
              mensaje: "Ya existe profile con ese email.",
              fecha_proceso: new Date().toISOString(),
            })
            .eq("id_staging", fila.id_staging);

          errores++;
          continue;
        }

        const { data: profileUsuario, error: profileUsuarioError } = await supabase
          .from("profiles")
          .select("id")
          .eq("usuario", usuario)
          .limit(1);

        if (profileUsuarioError) {
          throw new Error(`Error verificando profiles por usuario: ${profileUsuarioError.message}`);
        }

        if ((profileUsuario ?? []).length > 0) {
          await supabase
            .from("stg_regularizacion_vendedores")
            .update({
              procesado: true,
              ok: false,
              mensaje: "Ya existe profile con ese usuario.",
              fecha_proceso: new Date().toISOString(),
            })
            .eq("id_staging", fila.id_staging);

          errores++;
          continue;
        }

        const { data: profileRut, error: profileRutError } = await supabase
          .from("profiles")
          .select("id")
          .eq("rut", rut)
          .limit(1);

        if (profileRutError) {
          throw new Error(`Error verificando profiles por rut: ${profileRutError.message}`);
        }

        if ((profileRut ?? []).length > 0) {
          await supabase
            .from("stg_regularizacion_vendedores")
            .update({
              procesado: true,
              ok: false,
              mensaje: "Ya existe profile con ese rut.",
              fecha_proceso: new Date().toISOString(),
            })
            .eq("id_staging", fila.id_staging);

          errores++;
          continue;
        }

        // 3) Crear usuario en auth
        const password = generarPassword(rut);

        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              usuario,
              rut,
              dv,
              proceso: "regularizacion_vendedores",
            },
          });

        if (authError || !authData.user) {
          throw new Error(authError?.message || "No fue posible crear el usuario en auth.users.");
        }

        const userId = authData.user.id;

        // 4) Llamar RPC de negocio
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "admin_regularizar_vendedor_existente",
          {
            p_user_id: userId,
            p_id_vendedor: idVendedor,
            p_email: email,
            p_usuario: usuario,
            p_genero: genero,
            p_must_change_password: true,
          }
        );

        if (rpcError || !rpcData?.ok) {
          // rollback auth
          await supabase.auth.admin.deleteUser(userId);

          throw new Error(
            rpcError?.message ||
              rpcData?.message ||
              "Falló la regularización en base de datos."
          );
        }

        // 5) Marcar OK en staging
        await supabase
          .from("stg_regularizacion_vendedores")
          .update({
            procesado: true,
            ok: true,
            mensaje: "OK",
            auth_user_id: userId,
            fecha_proceso: new Date().toISOString(),
          })
          .eq("id_staging", fila.id_staging);

        creados++;
      } catch (err: any) {
        console.error("error fila", fila?.id_staging, err?.message ?? err);

        await supabase
          .from("stg_regularizacion_vendedores")
          .update({
            procesado: true,
            ok: false,
            mensaje: err?.message ?? String(err),
            fecha_proceso: new Date().toISOString(),
          })
          .eq("id_staging", fila.id_staging);

        errores++;
      }
    }

    return json(200, {
      ok: true,
      total_pendientes: pendientes.length,
      creados,
      omitidos,
      errores,
    });
  } catch (err: any) {
    console.error("catch general:", err?.message ?? err);

    return json(500, {
      ok: false,
      error: err?.message ?? String(err),
    });
  }
});