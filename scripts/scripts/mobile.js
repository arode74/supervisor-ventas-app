/* =====================================================================
   MOBILE CONTROLLER — APP Ventas (solo Ventas + Compromisos)
   - No usa vistas anidadas (no supervisor embed)
   - Carga módulos a pantalla completa bajo barra azul
   ===================================================================== */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const state = {
    currentModule: "ventas",
    loadedScripts: new Set(),
    loadedStyles: new Set()
  };

  // Ajusta si tu core expone supabase de otra forma
  const supabase = window.supabaseClient || window.supabase?.createClient?.(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  const routes = {
    ventas: {
      html: "../views/ventas.html",
      js: "../scripts/ventas.js"
    },
    compromisos: {
      html: "../views/compromisos.html",
      js: "../scripts/compromisos.js"
    }
  };

  async function ensureSessionOrRedirect() {
    try {
      // Si tu core ya valida sesión, esto igual es seguro.
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!data?.session) {
        window.location.href = "../views/login.html";
        return false;
      }
      return true;
    } catch (e) {
      console.error("Mobile: error validando sesión", e);
      window.location.href = "../views/login.html";
      return false;
    }
  }

  function setActiveTab(moduleKey) {
    document.querySelectorAll(".mobile-tab").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.module === moduleKey);
    });
  }

  function clearModuleContainer() {
    const main = $("#mobile-main");
    if (!main) return;
    main.innerHTML = `<div class="mobile-loading" id="mobile-loading">Cargando…</div>`;
  }

  async function injectScriptOnce(src) {
    if (state.loadedScripts.has(src)) return;

    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });

    state.loadedScripts.add(src);
  }

  // Si algún módulo requiere CSS propio que no esté ya global, aquí puedes inyectarlo.
  async function injectStyleOnce(href) {
    if (!href || state.loadedStyles.has(href)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    state.loadedStyles.add(href);
  }

  async function loadModule(moduleKey) {
    const route = routes[moduleKey];
    if (!route) return;

    state.currentModule = moduleKey;
    setActiveTab(moduleKey);
    clearModuleContainer();

    const main = $("#mobile-main");

    try {
      // 1) Traer HTML del módulo
      const resp = await fetch(route.html, { cache: "no-store" });
      if (!resp.ok) throw new Error(`Fetch HTML falló: ${route.html} (${resp.status})`);
      const html = await resp.text();

      // 2) Inyectar HTML
      main.innerHTML = html;

      // 3) Cargar JS del módulo (una sola vez)
      await injectScriptOnce(route.js);

      // 4) Hook opcional: si el módulo expone init, ejecútalo.
      //    (no rompe si no existe)
      const initName = moduleKey === "ventas" ? "initVentas" : "initCompromisos";
      if (typeof window[initName] === "function") {
        await window[initName]({ mode: "mobile" });
      } else if (typeof window.initModulo === "function") {
        await window.initModulo(moduleKey, { mode: "mobile" });
      }

      // Nota: si tus módulos se auto-inicializan al cargar, igual funciona.
    } catch (e) {
      console.error(`Mobile: error cargando módulo ${moduleKey}`, e);
      main.innerHTML = `
        <div class="mobile-loading">
          Error cargando <b>${moduleKey}</b>.<br/>
          Revisa consola (F12) y rutas relativas.
        </div>
      `;
    }
  }

  async function doLogout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Mobile: signOut con error", e);
    } finally {
      window.location.href = "../views/login.html";
    }
  }

  function wireUI() {
    document.querySelectorAll(".mobile-tab").forEach((btn) => {
      btn.addEventListener("click", () => loadModule(btn.dataset.module));
    });

    const logoutBtn = $("#btn-logout-mobile");
    if (logoutBtn) logoutBtn.addEventListener("click", doLogout);
  }

  async function boot() {
    // Si supabase no está inicializado por tu core/config, esto te lo va a exponer rápido.
    if (!supabase) {
      console.error("Mobile: supabase client no disponible. Revisa config.js / app_ventas_core.js");
      window.location.href = "../views/login.html";
      return;
    }

    const ok = await ensureSessionOrRedirect();
    if (!ok) return;

    wireUI();

    // Carga inicial
    await loadModule(state.currentModule);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
