// ===========================================================
// GUARD GLOBAL — must_change_password (ESTABLE)
// - No interfiere con logout (bypass por flag global)
// - Redirige a cambiar-password.html si must_change_password=true
// - Si perfil no existe o está inactivo => signOut + index
// ===========================================================

const supabasePromise = import("../config.js");

export async function enforceMustChangePassword() {
  try {
    // Bypass explícito (por ejemplo durante logout)
    if (window.__AV_SKIP_GUARD__ === true) return;

    const { supabase } = await supabasePromise;

    // 1) Sesión
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      console.warn("⚠️ guard: getSession error:", sessionError);
      return; // fail-open
    }

    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    // 2) Perfil (si esto falla por RLS, NO rompas la app)
    const { data: perfil, error: perfilError } = await supabase
      .from("profiles")
      .select("activo, must_change_password")
      .eq("id", userId)
      .maybeSingle();

    if (perfilError) {
      console.warn("⚠️ guard: error leyendo profiles:", perfilError);
      return; // fail-open
    }

    // Perfil inválido o inactivo => cortar sesión
    if (!perfil || perfil.activo !== true) {
      window.__AV_SKIP_GUARD__ = true;
      try { await supabase.auth.signOut(); } catch (_) {}
      window.location.replace("../index.html");
      return;
    }

    // 3) Redirección obligatoria si aplica
    if (perfil.must_change_password === true) {
      const path = (window.location.pathname || "").toLowerCase();
      if (!path.includes("cambiar-password.html")) {
        window.location.replace("cambiar-password.html"); // desde /views/*
      }
    }
  } catch (err) {
    console.warn("⚠️ guard: error inesperado:", err);
  }
}
