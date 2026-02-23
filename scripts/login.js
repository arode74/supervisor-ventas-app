// scripts/login.js
import {
  mostrarCarga as mostrarOverlay,
  ocultarCarga as ocultarOverlay,
  mostrarToast as toast,
} from "./utils.js";

import { startSessionManager } from "./session-manager.js";

// Import ESM del config en raíz
import { supabase } from "../config.js";

/* ============================================================================
   LOGIN (index.html)
   - Login por email o usuario
   - RBAC vía get_perfil_actual (user_roles → perfiles)
   ============================================================================ */

let __navLock = false;
function navegarUnaVez(url) {
  if (__navLock) return;
  __navLock = true;
  window.location.replace(url);
}

function esEmail(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((valor || "").trim());
}

async function obtenerPerfil(supabaseClient, userId) {
  const { data: prof, error: profErr } = await supabaseClient
    .from("profiles")
    .select("id, activo, must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (profErr) throw profErr;
  if (!prof) return null;

  const { data: perfil_actual, error: rolErr } = await supabaseClient.rpc(
    "get_perfil_actual",
    { p_user_id: userId }
  );

  if (rolErr) throw rolErr;

  return { ...prof, perfil_actual: perfil_actual ?? null };
}

function esMobile() {
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

/**
 * Reglas de redirección (RBAC)
 */
function redirectPostLogin(perfil_actual) {
  const r = (perfil_actual || "").toLowerCase();

  // Admin
  if (r === "admin") {
    navegarUnaVez("./views/admin.html");
    return;
  }

  // Zonal (NO móvil)
  if (r === "zonal") {
    navegarUnaVez("./views/zonal.html");
    return;
  }

  // Móvil (canal único)
  if (esMobile()) {
    navegarUnaVez("./views/supervisor.mobile.html");
    return;
  }

  // Desktop
  if (r === "supervisor") navegarUnaVez("./views/supervisor.html");
  else if (r === "vendedor") navegarUnaVez("./views/vendedor.html");
  else navegarUnaVez("./views/supervisor.html");
}

/**
 * Resolver email desde usuario vía RPC
 */
async function resolverEmailDesdeUsuarioRPC(supabaseClient, usuario) {
  const u = (usuario || "").trim();
  if (!u) return null;

  const { data, error } = await supabaseClient.rpc("get_email_by_username", {
    p_usuario: u,
  });

  if (error) return null;

  if (typeof data === "string" && data.includes("@")) return data;
  if (data && typeof data === "object") {
    const maybe = data.email || data.correo || data.mail;
    if (typeof maybe === "string" && maybe.includes("@")) return maybe;
  }

  return null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("loginForm");
  const inputUsuario = document.getElementById("usuario");
  const inputPassword = document.getElementById("password");

  if (!form || !inputUsuario || !inputPassword) return;

  // Session Manager transversal (auth + sesión expirada)
  try {
    startSessionManager({
      supabase,
      loginPath: "./index.html",
    });
  } catch (e) {
    console.warn("⚠️ Session Manager no inició:", e);
  }

  // Sesión existente
  try {
    const { data } = await supabase.auth.getSession();
    const sess = data?.session;

    if (sess?.user?.id) {
      // hidrata JWT
      try {
        await supabase.auth.setSession(sess);
      } catch (_) {}

      let perfil = null;

      try {
        perfil = await obtenerPerfil(supabase, sess.user.id);
      } catch (e) {
        await supabase.auth.signOut().catch(() => {});
        perfil = null;
      }

      if (perfil && perfil.activo === false) {
        await supabase.auth.signOut().catch(() => {});
      } else if (perfil?.must_change_password === true) {
        navegarUnaVez("./views/cambiar-password.html");
        return;
      } else if (perfil) {
        redirectPostLogin(perfil.perfil_actual);
        return;
      }
    }
  } catch {}

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rawUsuario = inputUsuario.value.trim();
    const rawPw = inputPassword.value.trim();

    if (!rawUsuario) return toast("Ingresa tu usuario o correo.");
    if (!rawPw) return toast("Ingresa tu contraseña.");

    mostrarOverlay("Validando credenciales...");

    let email = esEmail(rawUsuario)
      ? rawUsuario
      : await resolverEmailDesdeUsuarioRPC(supabase, rawUsuario);

    if (!email) {
      ocultarOverlay();
      toast("Usuario no encontrado.");
      return;
    }

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password: rawPw,
    });

    if (error || !authData?.user?.id) {
      ocultarOverlay();
      toast("Credenciales inválidas.");
      return;
    }

    const perfil = await obtenerPerfil(supabase, authData.user.id);

    if (!perfil || !perfil.activo) {
      await supabase.auth.signOut();
      ocultarOverlay();
      toast("Usuario inactivo.");
      return;
    }

    if (perfil.must_change_password === true) {
      ocultarOverlay();
      navegarUnaVez("./views/cambiar-password.html");
      return;
    }

    ocultarOverlay();
    redirectPostLogin(perfil.perfil_actual);
  });
});