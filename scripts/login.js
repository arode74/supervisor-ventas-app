/**
 * scripts/login.js — MOBILE ONLY (sin imports / sin módulos)
 * Login por email o por usuario (username) vía RPC get_email_by_username.
 *
 * Requisitos:
 * - index.html carga: env.js -> supabase-js -> config.js -> scripts/login.js
 * - config.js crea window.sb (Supabase client)
 */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const form = $("loginForm");
  const inputUsuario = $("usuario");
  const inputPassword = $("password");

  function esEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
  }

  function getSb() {
    return window.sb || window.supabaseClient || null;
  }

  async function resolverEmail(sb, usuario) {
    const u = (usuario || "").trim();
    if (!u) return null;
    if (esEmail(u)) return u;

    // RPC: get_email_by_username(p_usuario text) -> text/email
    try {
      const { data, error } = await sb.rpc("get_email_by_username", { p_usuario: u });
      if (error) return null;

      if (typeof data === "string" && data.includes("@")) return data;

      if (data && typeof data === "object") {
        const maybe = data.email || data.correo || data.mail;
        if (typeof maybe === "string" && maybe.includes("@")) return maybe;
      }
    } catch (_) {
      // ignore
    }
    return null;
  }

  function navegar(url) {
    window.location.replace(url);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!form) return;

    const sb = getSb();
    if (!sb) {
      alert("Supabase no inicializado. Verifica carga de config.js.");
      return;
    }

    // Si ya hay sesión, saltar al panel
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user?.id) {
        navegar("./views/supervisor.mobile.html");
        return;
      }
    } catch (_) {}

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const sb2 = getSb();
      if (!sb2) {
        alert("Supabase no inicializado.");
        return;
      }

      const usuario = (inputUsuario?.value || "").trim();
      const password = (inputPassword?.value || "").trim();

      if (!usuario || !password) {
        alert("Completa usuario y contraseña.");
        return;
      }

      const email = await resolverEmail(sb2, usuario);
      if (!email) {
        alert("Usuario no encontrado o no resolvió a email.");
        return;
      }

      const { error } = await sb2.auth.signInWithPassword({ email, password });

      if (error) {
        alert("Credenciales inválidas.");
        return;
      }

      navegar("./views/supervisor.mobile.html");
    });
  });
})();
