/**
 * dashboard.js (RBAC - Opción B)
 * - Obtiene embed_url vía RPC segura: get_dashboard_embed(p_dashboard_key)
 * - El RPC DEBE resolver perfil por auth.uid() y consultar public.app_dashboards_embed
 * - Renderiza iframe responsive y centrado
 */

import { supabase } from "../config.js";

(async () => {
  const container = document.getElementById("dashboard-container");
  const loading = document.getElementById("dashboard-loading");

  const DASHBOARD_KEY = "principal";

  const removeLoading = () => {
    if (loading && loading.parentNode) loading.remove();
  };

  const renderError = (msg) => {
    removeLoading();
    if (!container) return;

    container.innerHTML = `
      <div style="padding:16px;background:#fff;border-radius:10px;border:1px solid #eee;max-width:900px;margin:0 auto;">
        <div style="font-weight:700;color:#b00020;margin-bottom:6px;">No se pudo cargar el dashboard</div>
        <div style="color:#444;white-space:pre-wrap;">${msg}</div>
      </div>
    `;
  };

  try {
    if (!container) throw new Error("No se encontró #dashboard-container (dashboard.html).");

    // Mantener layout dentro del ancho “APP”
    container.style.maxWidth = "900px";
    container.style.margin = "0 auto";
    container.style.width = "100%";

    // 1) Sesión
    const { data: sessionWrap, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const session = sessionWrap?.session || null;
    const uid = session?.user?.id || null;

    console.log("[dashboard.js] uid:", uid);

    if (!uid) throw new Error("Sesión inválida. Vuelve a iniciar sesión.");

    // 2) (Diagnóstico) perfil actual
    //    Esto NO decide el embed_url (eso lo decide el RPC), pero deja trazabilidad.
    try {
      const { data: perfilActual, error: pErr } = await supabase.rpc("get_perfil_actual", { p_user_id: uid });
      if (!pErr) console.log("[dashboard.js] perfilActual:", perfilActual);
      else console.warn("[dashboard.js] No se pudo leer perfilActual (no bloquea):", pErr);
    } catch (e) {
      console.warn("[dashboard.js] get_perfil_actual falló (no bloquea):", e);
    }

    // 3) RPC: embed_url por (perfil derivado de uid) + dashboard_key
    const { data, error } = await supabase.rpc("get_dashboard_embed", {
      p_dashboard_key: DASHBOARD_KEY,
    });

    if (error) throw error;

    console.log("[dashboard.js] RPC get_dashboard_embed data:", data);

    // Soporta retorno objeto o array
    const embedUrl =
      (data && typeof data === "object" && !Array.isArray(data) && data.embed_url) ? data.embed_url :
      (Array.isArray(data) && data.length > 0 && data[0]?.embed_url) ? data[0].embed_url :
      null;

    if (!embedUrl) {
      throw new Error(
        `No hay embed_url activo para este perfil/dashboard_key.\n` +
        `dashboard_key=${DASHBOARD_KEY}\n` +
        `RPC data=${JSON.stringify(data)}`
      );
    }

    // 4) Render iframe
    removeLoading();

    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;

    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.minHeight = "70vh";
    iframe.style.height = "calc(100vh - 280px)";

    iframe.allowFullscreen = true;

    iframe.setAttribute(
      "sandbox",
      [
        "allow-storage-access-by-user-activation",
        "allow-scripts",
        "allow-same-origin",
        "allow-forms",
        "allow-popups",
        "allow-popups-to-escape-sandbox",
        "allow-top-navigation-by-user-activation",
      ].join(" ")
    );

    container.innerHTML = "";
    container.appendChild(iframe);

  } catch (e) {
    console.error("[dashboard.js] Error:", e);
    renderError((e && e.message) ? e.message : String(e));
  }
})();