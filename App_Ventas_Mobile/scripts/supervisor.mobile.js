(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const nombreSupervisorEl = $("#nombreSupervisor");
  const equipoBtn = $("#equipoBtn");
  const equipoDropdown = $("#equipoDropdown");
  const equipoLabel = $("#equipoSeleccionado");

  const btnVentas = $("#btnVentas");
  const btnCompromisos = $("#btnCompromisos");
  const btnLogout = $("#btnLogout");

  function createSbClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase SDK no está cargado. Falta el script CDN.");
    }
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      throw new Error("Faltan SUPABASE_URL / SUPABASE_ANON_KEY (env.js).");
    }
    return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  const sb = createSbClient();

  function setEquipoActivo(idEquipo) {
    try { localStorage.setItem("av_mobile_equipo_id", String(idEquipo || "")); } catch {}
  }
  function getEquipoActivo() {
    try { return localStorage.getItem("av_mobile_equipo_id") || ""; } catch { return ""; }
  }

  function bindDropdownUI() {
    equipoBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      equipoDropdown.classList.toggle("hidden");
    });

    // Cierra al tocar fuera
    document.addEventListener("click", (e) => {
      const wrap = e.target.closest(".equipo-selector-wrapper");
      if (!wrap) equipoDropdown.classList.add("hidden");
    });
  }

  function renderEquipos(rows) {
    equipoDropdown.innerHTML = "";

    const selected = getEquipoActivo();
    const first = rows[0];

    for (const r of rows) {
      const id = r.id_equipo;
      const nombre = r.equipos?.nombre_equipo || id;

      const b = document.createElement("button");
      b.type = "button";
      b.textContent = nombre;

      b.onclick = () => {
        equipoLabel.textContent = nombre;
        setEquipoActivo(id);
        equipoDropdown.classList.add("hidden");
      };

      equipoDropdown.appendChild(b);
    }

    const found = selected ? rows.find(r => String(r.id_equipo) === String(selected)) : null;
    const pick = found || first;

    equipoLabel.textContent = pick.equipos?.nombre_equipo || pick.id_equipo;
    setEquipoActivo(pick.id_equipo);
  }

  async function bootstrap() {
    const { data, error } = await sb.auth.getSession();
    if (error) console.warn("[Supervisor] getSession error:", error);

    const session = data?.session;
    if (!session) {
      nombreSupervisorEl.textContent = "Sin sesión";
      equipoLabel.textContent = "Seleccionar equipo";
      equipoDropdown.innerHTML = "";
      return;
    }

    const userId = session.user.id;

    // Nombre supervisor desde profiles.nombre
    try {
      const { data: prof, error: eProf } = await sb
        .from("profiles")
        .select("nombre")
        .eq("id", userId)
        .single();

      if (!eProf && prof?.nombre) nombreSupervisorEl.textContent = prof.nombre;
      else nombreSupervisorEl.textContent = session.user.email || "Supervisor";
    } catch {
      nombreSupervisorEl.textContent = session.user.email || "Supervisor";
    }

    // Equipos del supervisor (SQL validado)
    const hoy = new Date().toISOString().slice(0, 10);

    const { data: equipos, error: eEq } = await sb
      .from("equipo_supervisor")
      .select(`
        id_equipo,
        es_principal,
        fecha_inicio,
        fecha_fin,
        equipos (
          id_equipo,
          nombre_equipo
        )
      `)
      .eq("id_supervisor", userId)
      .lte("fecha_inicio", hoy)
      .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
      .order("es_principal", { ascending: false })
      .order("nombre_equipo", { foreignTable: "equipos", ascending: true });

    if (eEq) {
      console.error("[Supervisor] Error cargando equipos:", eEq);
      equipoLabel.textContent = "Equipo no disponible";
      equipoDropdown.innerHTML = "";
      return;
    }

    if (!equipos || equipos.length === 0) {
      equipoLabel.textContent = "Sin equipos asignados";
      equipoDropdown.innerHTML = "";
      return;
    }

    renderEquipos(equipos);
  }

  async function doLogout() {
    try { btnLogout.disabled = true; } catch {}

    try { await sb.auth.signOut({ scope: "global" }); } catch {}

    // Limpieza mínima de tokens supabase
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      for (const k of keys) {
        const lk = String(k || "").toLowerCase();
        if (
          (lk.includes("supabase") && lk.includes("auth")) ||
          (lk.startsWith("sb-") && lk.endsWith("-auth-token")) ||
          lk.includes("auth-token") ||
          lk.includes("access_token") ||
          lk.includes("refresh_token")
        ) {
          localStorage.removeItem(k);
        }
      }
    } catch {}

    // ✅ Redirige al login real
    const loginUrl = "/index.html";
    const fallbackUrl = `/views/supervisor.mobile.html?t=${Date.now()}`;

    window.location.replace(loginUrl);

    // Fallback si no existe loginUrl / no cambió la ruta
    setTimeout(() => {
      if (window.location.pathname.endsWith("/views/supervisor.mobile.html")) {
        window.location.replace(fallbackUrl);
      }
    }, 600);
  }

  function bindNav() {
    btnVentas?.addEventListener("click", () => {
      window.location.href = "/views/ventas.mobile.html";
    });

    btnCompromisos?.addEventListener("click", () => {
      window.location.href = "/views/compromisos.mobile.html";
    });

    btnLogout?.addEventListener("click", doLogout);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindDropdownUI();
    bindNav();
    await bootstrap();
  });
})();