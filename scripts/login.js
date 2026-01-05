// scripts/login.js
import {
  mostrarCarga as mostrarOverlay,
  ocultarCarga as ocultarOverlay,
  mostrarToast as toast,
} from "./utils.js";

const supabasePromise = import("../config.js");

/* ============================================================================
   LOGIN (index.html) — Opción recomendada
   - Permite login por email o por usuario
   - Si se ingresa usuario (ej: "arode"), resuelve email vía RPC (NO REST, NO profiles direct)
   - Si profiles.must_change_password = true => redirige a /views/cambiar-password.html
   - Anti-loop: navegación una sola vez
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

async function obtenerPerfil(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, activo, must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

function redirectPorRol(role) {
  const r = (role || "").toLowerCase();
  if (r === "admin") navegarUnaVez("./views/admin.html");
  else if (r === "supervisor") navegarUnaVez("./views/supervisor.html");
  else if (r === "vendedor") navegarUnaVez("./views/vendedor.html");
  else navegarUnaVez("./views/supervisor.html");
}

/**
 * Resuelve email desde usuario SOLO vía RPC.
 * Requisito: existe RPC `get_email_by_username(p_usuario text) returns text`
 * (SECURITY DEFINER recomendado en SQL para no depender de RLS)
 */
async function resolverEmailDesdeUsuarioRPC(supabase, usuario) {
  const u = (usuario || "").trim();
  if (!u) return null;

  const { data, error } = await supabase.rpc("get_email_by_username", {
    p_usuario: u,
  });

  if (error) {
    console.error("RPC get_email_by_username error:", error);
    return null;
  }

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

  // Este script SOLO debe correr en index.html
  if (!form || !inputUsuario || !inputPassword) return;

  let supabase;
  try {
    ({ supabase } = await supabasePromise);
  } catch (e) {
    console.error("Error cargando config/supabase:", e);
    toast("No se pudo iniciar Supabase. Revisa env.js / config.js.");
    return;
  }

  // Si ya hay sesión, decide destino (pero NO loops si no hay sesión)
  try {
    const { data } = await supabase.auth.getSession();
    const sess = data?.session;

    if (sess?.user?.id) {
      const perfil = await obtenerPerfil(supabase, sess.user.id);

      if (!perfil?.activo) {
        await supabase.auth.signOut();
      } else if (perfil.must_change_password === true) {
        navegarUnaVez("./views/cambiar-password.html");
        return;
      } else {
        redirectPorRol(perfil.role);
        return;
      }
    }
  } catch (e) {
    console.warn("Session check warning (no bloquea login):", e);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rawUsuario = (inputUsuario.value || "").trim();
    const rawPw = (inputPassword.value || "").trim();

    if (!rawUsuario) return toast("Ingresa tu usuario o correo.");
    if (!rawPw) return toast("Ingresa tu contraseña.");

    mostrarOverlay("Validando credenciales...");

    let email = null;

    if (esEmail(rawUsuario)) {
      email = rawUsuario;
    } else {
      email = await resolverEmailDesdeUsuarioRPC(supabase, rawUsuario);
    }

    if (!email) {
      ocultarOverlay();
      toast("Usuario no encontrado. Verifica el usuario o usa tu correo.");
      return;
    }

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password: rawPw,
      });

    if (authError || !authData?.user?.id) {
      ocultarOverlay();
      console.error("Auth signIn error:", authError);
      toast("Credenciales inválidas.");
      return;
    }

    let perfil = null;
    try {
      perfil = await obtenerPerfil(supabase, authData.user.id);
    } catch (err) {
      console.error("Error obteniendo perfil:", err);
    }

    if (!perfil) {
      ocultarOverlay();
      toast("No se pudo validar tu perfil. Contacta a soporte.");
      return;
    }

    if (!perfil.activo) {
      await supabase.auth.signOut();
      ocultarOverlay();
      toast("Usuario inactivo. Contacta al administrador.");
      return;
    }

    // Cambio de password SOLO si el flag está en true
    if (perfil.must_change_password === true) {
      ocultarOverlay();
      navegarUnaVez("./views/cambiar-password.html");
      return;
    }

    ocultarOverlay();
    redirectPorRol(perfil.role);
  });
});
