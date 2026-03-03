// scripts/login.js
import {
  mostrarCarga as mostrarOverlay,
  ocultarCarga as ocultarOverlay,
  mostrarToast as toast,
} from "./utils.js";

import { startSessionManager } from "./session-manager.js";

// Config en raíz (publicado como /config.js)
import { supabase } from "../config.js";

/* ============================================================================
   LOGIN (index.html)
   - Login por email o usuario
   - RBAC vía get_perfil_actual (user_roles → perfiles)
   - Redirección robusta (evita 404 por base path)
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

function esMobile() {
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

/**
 * Detecta si tu sitio está publicado dentro de una subcarpeta (ej: /App_Ventas_Mobile)
 * y arma rutas correctas para evitar 404.
 */
function basePrefix() {
  const p = window.location.pathname || "/";
  return p.includes("/App_Ventas_Mobile/") ? "/App_Ventas_Mobile" : "";
}

/**
 * Reglas de redirección (RBAC)
 */
function redirectPostLogin(perfil_actual) {
  const base = basePrefix();
  const r = (perfil_actual || "").toLowerCase();

  // Admin / Zonal (desktop)
  if (r === "admin") return navegarUnaVez(`${base}/views/admin.html`);
  if (r === "zonal") return navegarUnaVez(`${base}/views/zonal.html`);

  // Canal mobile
  if (esMobile()) return navegarUnaVez(`${base}/views/supervisor.mobile.html`);

  // Desktop por rol
  if (r === "supervisor") return navegarUnaVez(`${base}/views/supervisor.html`);
  if (r === "vendedor") return navegarUnaVez(`${base}/views/vendedor.html`);

  // Fallback
  return navegarUnaVez(`${base}/views/supervisor.html`);
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

  // Session Manager (manejo auth / expiración)
  try {
    startSessionManager({
      supabase,
      loginPath: "./index.html",
    });
  } catch (e) {
    console.warn("Session Manager no inició:", e);
  }

  // Si ya hay sesión, redirige
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
        navegarUnaVez(`${basePrefix()}/views/cambiar-password.html`);
        return;
      } else if (perfil) {
        redirectPostLogin(perfil.perfil_actual);
        return;
      }
    }
  } catch {}

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rawUsuario = inputUsuario.value.trim();
    const rawPw = inputPassword.value.trim();

    if (!rawUsuario) return toast("Ingresa tu usuario o correo.");
    if (!rawPw) return toast("Ingresa tu contraseña.");

    mostrarOverlay("Validando credenciales...");

    const email = esEmail(rawUsuario)
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
      await supabase.auth.signOut().catch(() => {});
      ocultarOverlay();
      toast("Usuario inactivo.");
      return;
    }

    if (perfil.must_change_password === true) {
      ocultarOverlay();
      navegarUnaVez(`${basePrefix()}/views/cambiar-password.html`);
      return;
    }

    ocultarOverlay();
    redirectPostLogin(perfil.perfil_actual);
  });
});