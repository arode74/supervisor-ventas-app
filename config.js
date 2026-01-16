// ============================================================
//  CONFIG.JS — Cliente Supabase único + sesión (NORMALIZADA)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
// Mantén versión fija para evitar sorpresas en runtime.

// ------------------------------------------------------------
//  Variables desde env.js (OBLIGATORIO)
// ------------------------------------------------------------
const SUPABASE_URL = window.__ENV__?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "❌ Faltan SUPABASE_URL o SUPABASE_ANON_KEY. Revisa env.js y que esté cargado antes de config.js."
  );
}

// ------------------------------------------------------------
//  Cliente ÚNICO de Supabase para toda la APP
// ------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export ES Modules
export { supabase };

// Para módulos legacy que usan window.supabase
window.supabase = supabase;

// ------------------------------------------------------------
//  Helpers de sesión
// ------------------------------------------------------------
export function limpiarSesion() {
  localStorage.removeItem("appVentasUser");
  localStorage.removeItem("usuarioActivo");
  localStorage.removeItem("idSupervisorActivo");

  supabase.auth.signOut().catch((err) => {
    console.error("Error cerrando sesión Supabase:", err);
  });
}

export function guardarUsuarioNormalizado(user, perfil) {
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

// ------------------------------------------------------------
//  Obtener usuario activo (AUTH + PROFILES)
//  Retorna: {id, email, nombre, genero}
// ------------------------------------------------------------
export async function obtenerUsuarioActivo() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      limpiarSesion();
      return null;
    }

    const user = data.user;

    // Intentar enriquecer con profiles
    let perfil = null;
    try {
      const { data: p, error: errP } = await supabase
        .from("profiles")
        .select("nombre, genero")
        .eq("id", user.id)
        .single();

      if (!errP) perfil = p;
    } catch (e) {
      console.warn("No se pudo leer profiles:", e);
    }

    const payload = guardarUsuarioNormalizado(user, perfil);

    // (RBAC) No persistimos identidad en storage: supervisor = auth.uid()
    return payload;
  } catch (err) {
    console.error("Error reconstruyendo usuario desde Supabase:", err);
    limpiarSesion();
    return null;
  }
}

// Exponer helpers globales (compatibilidad legacy)
window.obtenerUsuarioActivo = obtenerUsuarioActivo;
window.guardarUsuarioNormalizado = guardarUsuarioNormalizado;
window.limpiarSesion = limpiarSesion;
