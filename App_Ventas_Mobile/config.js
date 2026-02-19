// ============================================================
//  CONFIG.JS — MOBILE ONLY (NO MODULES) — TOLERANTE A env.js
//  Crea un único Supabase client y lo expone como window.sb
// ============================================================

(function () {
  "use strict";

  // Soporta ambos formatos de env.js:
  // 1) window.__ENV__ = { SUPABASE_URL, SUPABASE_ANON_KEY }
  // 2) window.SUPABASE_URL / window.SUPABASE_ANON_KEY (legacy)
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
    console.error("ENV NO ENCONTRADO:", {
      __ENV__: window.__ENV__,
      SUPABASE_URL: window.SUPABASE_URL,
      SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY,
    });
    throw new Error("Faltan credenciales Supabase (env.js).");
  }

  if (!window.supabase?.createClient) {
    throw new Error("Falta cargar supabase-js antes de config.js.");
  }

  // Evitar múltiples clientes
  if (!window.sb) {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  window.supabaseClient = window.sb;
})();
