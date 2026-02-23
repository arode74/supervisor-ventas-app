\
/**
 * scripts/login.js — MOBILE ONLY
 * Login por EMAIL o por USUARIO:
 * - Si es email -> signInWithPassword(email, password)
 * - Si es username -> RPC get_email_by_username (case-insensitive) -> email -> signInWithPassword
 *
 * Nota: este archivo incluye logs para diagnosticar en consola SIN adivinar.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const form = $("loginForm");
  const inputUsuario = $("usuario");
  const inputPassword = $("password");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function isEmail(v) {
    return EMAIL_RE.test((v || "").trim());
  }

  function sb() {
    return window.sb || window.supabaseClient || null;
  }

  async function resolveEmailByUsername(supabaseClient, usernameRaw) {
    const raw = (usernameRaw || "").trim();
    if (!raw) return null;

    // 1) primero normalizado lower/trim
    const uLower = raw.toLowerCase();

    // RPC: get_email_by_username(p_usuario text) -> text
    let res = await supabaseClient.rpc("get_email_by_username", { p_usuario: uLower });
    if (res?.error) {
      console.error("[login] RPC error (lower):", res.error);
    } else if (typeof res?.data === "string" && res.data.includes("@")) {
      return res.data.trim().toLowerCase();
    }

    // 2) fallback: intenta tal cual (por si la función no normaliza)
    res = await supabaseClient.rpc("get_email_by_username", { p_usuario: raw });
    if (res?.error) {
      console.error("[login] RPC error (raw):", res.error);
      return null;
    }
    if (typeof res?.data === "string" && res.data.includes("@")) {
      return res.data.trim().toLowerCase();
    }
    return null;
  }

  function go(url) {
    window.location.replace(url);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!form) return;

    const client = sb();
    if (!client) {
      alert("Supabase no inicializado. Revisa carga de config.js.");
      return;
    }

    // Si ya hay sesión
    try {
      const { data } = await client.auth.getSession();
      if (data?.session?.user?.id) {
        go("./views/supervisor.mobile.html");
        return;
      }
    } catch {}

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const client2 = sb();
      if (!client2) {
        alert("Supabase no inicializado.");
        return;
      }

      const u = (inputUsuario?.value || "").trim();
      const p = (inputPassword?.value || "").trim();

      if (!u || !p) {
        alert("Completa usuario/email y contraseña.");
        return;
      }

      let email;
      if (isEmail(u)) {
        email = u.trim().toLowerCase();
        console.info("[login] input es email:", email);
      } else {
        email = await resolveEmailByUsername(client2, u);
        console.info("[login] username:", u, "-> email:", email);
      }

      if (!email) {
        alert("Usuario no encontrado (no resolvió a email).");
        return;
      }

      const { data, error } = await client2.auth.signInWithPassword({ email, password: p });

      if (error) {
        console.error("[login] signInWithPassword error:", error);
        alert("Credenciales inválidas.");
        return;
      }

      if (!data?.user?.id) {
        alert("No se obtuvo usuario autenticado.");
        return;
      }

      go("./views/supervisor.mobile.html");
    });
  });
})();
