// ============================================================
//  CONFIG.JS — Cliente Supabase único + sesión (ROBUSTO PROD)
//  - env.js independiente (window.__ENV__)
//  - Autocarga /env.js si no está presente
//  - Compatible con módulos legacy (window.supabase)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

// -------------------------
// Cargar env.js si falta
// -------------------------
function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Si ya existe el script, no lo dupliques
    const existing = document.querySelector(`script[data-env-src="${src}"]`);
    if (existing) return resolve(true);

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.dataset.envSrc = src;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureEnvLoaded() {
  // Si ya está, listo.
  if (window.__ENV__?.SUPABASE_URL && window.__ENV__?.SUPABASE_ANON_KEY) return;

  // Intentar rutas típicas (Netlify + app estática)
  const candidates = [
    "/env.js",       // producción (raíz)
    "./env.js",      // fallback
    "../env.js",     // si estás en /views/
  ];

  let lastErr = null;

  for (const src of candidates) {
    try {
      await loadScript(src);
      if (window.__ENV__?.SUPABASE_URL && window.__ENV__?.SUPABASE_ANON_KEY) return;
    } catch (e) {
      lastErr = e;
    }
  }

  // Si llegamos acá, no existe env.js o no define window.__ENV__
  const detail = lastErr ? ` (${lastErr.message})` : "";
  throw new Error(
    `❌ Supabase no inicializado: falta window.__ENV__.SUPABASE_URL / SUPABASE_ANON_KEY. ` +
    `Verifica que /env.js exista y se cargue antes de la app${detail}.`
  );
}

// -------------------------
// Init Supabase (con await)
// -------------------------
await ensureEnvLoaded();

const SUPABASE_URL = window.__ENV__.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.__ENV__.SUPABASE_ANON_KEY;

// Cliente ÚNICO
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export ESM
export { supabase };

// Compatibilidad legacy
window.supabase = supabase;

// -------------------------
// Helpers de sesión
// -------------------------
export function limpiarSesion() {
  localStorage.removeItem("appVentasUser");
  localStorage.removeItem("usuarioActivo");
  localStorage.removeItem("idSupervisorActivo");

  // Sign out Supabase (best effort)
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

    // Enriquecer con profiles (si existe y RLS lo permite)
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

    return guardarUsuarioNormalizado(user, perfil);
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