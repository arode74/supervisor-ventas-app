/* ============================================================================
   mobile_shared.js (BLINDADO)
   Helpers comunes para versión mobile (Ventas / Compromisos / Supervisor)
   - Sesión Supabase robusta (try/catch)
   - Logout seguro
   - Buscador sin tildes / case-insensitive
   - Semana Lunes–Domingo
   - Días hábiles (prev / next)
   - UI helpers (expand / collapse)
   ============================================================================ */

(() => {
  "use strict";

  /* ----------------------------- Supabase --------------------------------- */
  function getSupabase() {
    try {
      if (window.supabaseClient) return window.supabaseClient;
      if (window.supabase?.createClient) {
        return window.supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_ANON_KEY
        );
      }
      return null;
    } catch {
      return null;
    }
  }

  async function ensureSessionOrRedirect(loginUrl = "../views/login.html") {
    const supabase = getSupabase();
    if (!supabase) {
      window.location.href = loginUrl;
      return null;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        window.location.href = loginUrl;
        return null;
      }
      return data.session;
    } catch {
      window.location.href = loginUrl;
      return null;
    }
  }

  async function logoutAndRedirect(loginUrl = "../views/login.html") {
    const supabase = getSupabase();
    try {
      await supabase?.auth?.signOut();
    } catch {
      // swallow
    }
    window.location.href = loginUrl;
  }

  /* ------------------------------ Strings --------------------------------- */
  function normalizeStr(s) {
    try {
      return (s || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    } catch {
      return "";
    }
  }

  /* ------------------------------- Dates ---------------------------------- */
  function toISODate(d) {
    try {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }

  function parseISODate(iso) {
    try {
      return new Date(`${iso}T00:00:00`);
    } catch {
      return new Date();
    }
  }

  function startOfWeekMonday(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // lunes = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function endOfWeekSunday(date) {
    const d = startOfWeekMonday(date);
    d.setDate(d.getDate() + 6);
    return d;
  }

  function humanWeekRange(date) {
    try {
      const d = new Date(date);
      const mon = startOfWeekMonday(d);
      const sun = endOfWeekSunday(d);
      const fmt = (x) =>
        x.toLocaleDateString("es-CL", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
      return `${fmt(mon)} - ${fmt(sun)}`;
    } catch {
      return "";
    }
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function prevBusinessDay(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    while (isWeekend(d)) d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function nextBusinessDay(date) {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    while (isWeekend(d)) d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /* -------------------------------- UI ------------------------------------ */
  function closeAllExpands(
    containerEl,
    exceptKey,
    cardSelector = ".v-card",
    keyAttr = "data-id"
  ) {
    try {
      containerEl
        .querySelectorAll(cardSelector)
        .forEach((card) => {
          const key = card.getAttribute(keyAttr);
          if (key !== exceptKey) {
            const exp = card.querySelector(".expand");
            const btn = card.querySelector('[data-action="toggle"]');
            if (exp) exp.hidden = true;
            if (btn) btn.textContent = "+";
          }
        });
    } catch {
      // swallow
    }
  }

  /* ------------------------------ Export ---------------------------------- */
  window.Mobile = {
    // supabase / auth
    getSupabase,
    ensureSessionOrRedirect,
    logoutAndRedirect,

    // strings
    normalizeStr,

    // dates
    toISODate,
    parseISODate,
    startOfWeekMonday,
    endOfWeekSunday,
    humanWeekRange,
    prevBusinessDay,
    nextBusinessDay,

    // ui
    closeAllExpands,
  };
})();
