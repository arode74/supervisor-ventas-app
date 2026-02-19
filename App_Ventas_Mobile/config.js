// ============================================================
//  CONFIG.JS — MOBILE ONLY (NO MODULES) — TOLERANTE A env.js
//  Crea un único Supabase client y lo expone como window.sb
// ============================================================

(function () {
  "use strict";

  // Marca env cargado si existe
  try { if (window.__av_diag__) window.__av_diag__.envLoaded = !!window.__ENV__; } catch {}

  const SUPABASE_URL =
    window.__ENV__?.SUPABASE_URL ||
    window.SUPABASE_URL ||
    window.__SUPABASE_URL__ ||
    window.env?.SUPABASE_URL;

  const SUPABASE_ANON_KEY =
    window.__ENV__?.SUPABASE_ANON_KEY ||
    window.SUPABASE_ANON_KEY ||
    window.SUPABASE_KEY ||
    window.__SUPABASE_ANON_KEY__ ||
    window.env?.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[config.js] ENV NO ENCONTRADO:", {
      __ENV__: window.__ENV__,
      SUPABASE_URL: window.SUPABASE_URL,
      SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY,
    });
    // No reventar silencioso: dejar flag y salir
    try { if (window.__av_diag__) window.__av_diag__.configError = "missing_env"; } catch {}
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("[config.js] Falta supabase-js antes de config.js.");
    try { if (window.__av_diag__) window.__av_diag__.configError = "missing_supabase_js"; } catch {}
    return;
  }

  if (!window.sb) {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  window.supabaseClient = window.sb;
})();
