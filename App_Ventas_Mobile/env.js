// ============================================================
//  ENV.JS — Variables de entorno (PROD)
//  Cargado vía <script> antes de config.js
// ============================================================

window.__ENV__ = {
  SUPABASE_URL: "https://vuzayowerushcxzjumvf.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1emF5b3dlcnVzaGN4emp1bXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODYxMjcsImV4cCI6MjA4MzQ2MjEyN30.naZH3znh2cqFNy7pKT-mmstZWMHb9Fg2ZrwOyxqfDvc"
};

// ------------------------------------------------------------
// Compatibilidad MOBILE: expone las vars como globals directos
// (no rompe PC, solo agrega aliases)
// ------------------------------------------------------------
window.SUPABASE_URL = window.__ENV__.SUPABASE_URL;
window.SUPABASE_ANON_KEY = window.__ENV__.SUPABASE_ANON_KEY;