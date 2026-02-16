// ============================================================
//  CONFIG.JS — Cliente Supabase único + sesión (NO MODULES)
// ============================================================

(function () {
  "use strict";

  // Requiere que env.js esté cargado antes y defina window.__ENV__
  const SUPABASE_URL = window.__ENV__?.SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("❌ Faltan SUPABASE_URL o SUPABASE_ANON_KEY en window.__ENV__ (env.js).");
  }

  // OJO: window.supabase DEBE ser la LIBRERÍA (supabase-js). No la pises.
  if (!window.supabase?.createClient) {
    throw new Error("❌ Falta cargar supabase-js antes de config.js.");
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Exponer cliente sin romper compatibilidad
  window.sb = sb;                 // recomendado
  window.supabaseClient = sb;     // alias por si acaso

  function limpiarSesion() {
    localStorage.removeItem("appVentasUser");
    localStorage.removeItem("usuarioActivo");
    localStorage.removeItem("idSupervisorActivo");
    sb.auth.signOut().catch((err) => console.error("Error cerrando sesión Supabase:", err));
  }

  function guardarUsuarioNormalizado(user, perfil) {
    if (!user) return null;
    const payload = {
      id: user.id,
      email: user.email ?? null,
      nombre: perfil?.nombre ?? null,
      genero: perfil?.genero ?? null,
    };
    localStorage.setItem("appVentasUser", JSON.stringify(payload));
    return payload;
  }

  async function obtenerUsuarioActivo() {
    try {
      const { data, error } = await sb.auth.getUser();
      if (error || !data?.user) {
        limpiarSesion();
        return null;
      }

      const user = data.user;

      let perfil = null;
      try {
        const { data: p, error: errP } = await sb
          .from("profiles")
          .select("nombre, genero")
          .eq("id", user.id)
          .single();
        if (!errP) perfil = p;
      } catch (e) {
        console.warn("No se pudo leer profiles:", e);
      }

      return guardarUsuarioNormalizado(user, perfil);
    } catch (err) {
      console.error("Error reconstruyendo usuario desde Supabase:", err);
      limpiarSesion();
      return null;
    }
  }

  // Helpers globales
  window.limpiarSesion = limpiarSesion;
  window.guardarUsuarioNormalizado = guardarUsuarioNormalizado;
  window.obtenerUsuarioActivo = obtenerUsuarioActivo;
})();