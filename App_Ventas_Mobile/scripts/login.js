/**
 * scripts/login.js — MOBILE ONLY (sin módulos)
 * - Si config.js no alcanzó a crear window.sb, crea fallback con env.js (una sola vez)
 * - Error visible con causa (env/config/supabase-js)
 */
(function () {
  "use strict";

  const form = document.getElementById("loginForm");
  const usuarioInput = document.getElementById("usuario");
  const passwordInput = document.getElementById("password");

  function msgErrorBase(extra) {
    const d = window.__av_diag__ || {};
    const parts = [
      "Supabase no inicializado.",
      `envLoaded=${!!d.envLoaded}`,
      `supabaseLoaded=${!!d.supabaseLoaded}`,
      `configLoaded=${!!d.configLoaded}`,
      d.configError ? `configError=${d.configError}` : null,
      extra || null,
    ].filter(Boolean);
    return parts.join(" ");
  }

  function getEnv() {
    const url =
      window.__ENV__?.SUPABASE_URL ||
      window.SUPABASE_URL ||
      window.__SUPABASE_URL__ ||
      window.env?.SUPABASE_URL;

    const key =
      window.__ENV__?.SUPABASE_ANON_KEY ||
      window.SUPABASE_ANON_KEY ||
      window.SUPABASE_KEY ||
      window.__SUPABASE_ANON_KEY__ ||
      window.env?.SUPABASE_ANON_KEY;

    return { url, key };
  }

  function getSupabase() {
    if (window.sb) return window.sb;
    if (window.supabaseClient) return window.supabaseClient;

    // Fallback: crear client si lib + env existen
    if (window.supabase?.createClient) {
      const { url, key } = getEnv();
      if (url && key) {
        if (!window.__sb_fallback__) {
          window.__sb_fallback__ = window.supabase.createClient(url, key);
        }
        window.sb = window.__sb_fallback__;
        window.supabaseClient = window.__sb_fallback__;
        return window.__sb_fallback__;
      }
    }
    return null;
  }

  function irSupervisor() {
    window.location.replace("./views/supervisor.mobile.html");
  }

  async function ensureSessionRedirect(sb) {
    try {
      const { data } = await sb.auth.getSession();
      const sess = data?.session;
      if (sess?.user?.id) irSupervisor();
    } catch {}
  }

  document.addEventListener("DOMContentLoaded", async function () {
    if (!form) return;

    const sb = getSupabase();
    if (!sb) {
      alert(msgErrorBase("Revisa que /env.js y /config.js carguen 200 en Network."));
      return;
    }

    await ensureSessionRedirect(sb);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const sb2 = getSupabase();
      if (!sb2) {
        alert(msgErrorBase());
        return;
      }

      const usuario = (usuarioInput?.value || "").trim();
      const password = (passwordInput?.value || "").trim();

      if (!usuario || !password) {
        alert("Completa usuario y contraseña.");
        return;
      }

      // Login directo por email (si usas username, lo resolvemos después)
      const { error } = await sb2.auth.signInWithPassword({ email: usuario, password });

      if (error) {
        alert("Credenciales inválidas.");
        return;
      }

      irSupervisor();
    });
  });
})();
