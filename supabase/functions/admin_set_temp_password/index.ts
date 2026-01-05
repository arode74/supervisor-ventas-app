import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===============================
// Utils
// ===============================
function last4RutBody(rut: string): string {
  // Acepta: "12.345.678-9", "12345678-9", "12345678"
  const clean = rut.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();

  // Quita DV si viene (0-9 o K)
  const body = clean.length > 1 ? clean.slice(0, -1) : clean;

  // Deja solo dígitos
  const digits = body.replace(/\D/g, "");

  // Últimos 4 del cuerpo (rellena con 0 si hace falta)
  return digits.slice(-4).padStart(4, "0");
}

function tempPasswordFromRut(rut: string): string {
  const year = new Date().getFullYear();
  const last4 = last4RutBody(rut);
  return `Habitat-${year}-${last4}!`;
}

// ===============================
// Handler
// ===============================
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("APP_SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("APP_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(
      JSON.stringify({ error: "Missing secrets APP_SUPABASE_URL / APP_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const { email, rut } = await req.json();

    if (!email || !rut) {
      return new Response(
        JSON.stringify({ error: "email y rut son obligatorios" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // =================================================
    // 1) Buscar usuario en Auth (EDGE SAFE)
    // =================================================
    const { data, error } = await admin.auth.admin.listUsers({
      email,
      perPage: 1,
    });

    if (error || !data?.users?.length) {
      return new Response(
        JSON.stringify({ error: "Usuario no existe en Auth" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = data.users[0].id;

    // =================================================
    // 2) Generar password temporal
    // =================================================
    const tempPassword = tempPasswordFromRut(rut);

    // =================================================
    // 3) Setear password en Auth (Admin API)
    // =================================================
    const { error: pErr } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (pErr) {
      return new Response(
        JSON.stringify({ error: pErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // =================================================
    // 4) Forzar cambio de password en profiles
    // =================================================
    const { error: fErr } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", userId);

    if (fErr) {
      return new Response(
        JSON.stringify({ error: fErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // =================================================
    // OK (DEV devuelve la temporal; en PROD puedes ocultarla)
    // =================================================
    return new Response(
      JSON.stringify({
        ok: true,
        email,
        temp_password: tempPassword,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
