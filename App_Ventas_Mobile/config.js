// ============================================================
//  CONFIG.JS — Cliente Supabase único + sesión (NO MODULES)
// ============================================================

(function () {
  "use strict";

  const SUPABASE_URL = window.__ENV__?.SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY en window.__ENV__ (env.js).");
  }

  if (!window.supabase?.createClient) {
    throw new Error("Falta cargar supabase-js antes de config.js.");
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.sb = sb;
  window.supabaseClient = sb;

  function limpiarSesion() {
    localStorage.clear();
    sb.auth.signOut().catch(() => {});
  }

  async function obtenerUsuarioActivo() {
    try {
      const { data } = await sb.auth.getUser();
      return data?.user ?? null;
    } catch {
      return null;
    }
  }

  window.limpiarSesion = limpiarSesion;
  window.obtenerUsuarioActivo = obtenerUsuarioActivo;
})();
