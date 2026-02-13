// /scripts/zonal.js
// Panel Zonal (RBAC). Abre módulos ANIDADOS en #contenedor-modulos.
// Reportes: abre el mismo módulo embebido que Supervisor (reportes-supervisor).

import { supabase, limpiarSesion } from "../config.js";
import { enforceMustChangePassword } from "./guard-must-change-password.js";

try {
  await enforceMustChangePassword();
} catch (e) {
  console.warn("⚠️ Guard falló (no bloquea):", e);
}

function irLogin() {
  window.location.replace("../index.html");
}

async function getSesion() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session ?? null;
}

async function getPerfilActual(userId) {
  const { data, error } = await supabase.rpc("get_perfil_actual", { p_user_id: userId });
  if (error) throw error;
  return (data ?? null);
}

async function initZonal() {
  const nombreZonalEl = document.getElementById("nombreZonal");
  const selectZona = document.getElementById("selectZona");
  const btnLogout = document.getElementById("btnLogout");

  const panelBotones = document.getElementById("panel-botones");
  const contenedorModulos = document.getElementById("contenedor-modulos");

  const btnDashboard = document.getElementById("btnDashboard");
  const btnReportes = document.getElementById("btnReportes");

  // -------------------------
  // Logout
  // -------------------------
  if (btnLogout) {
    btnLogout.addEventListener("click", async (ev) => {
      ev.preventDefault();
      window.__AV_SKIP_GUARD__ = true;

      try {
        limpiarSesion();
      } catch (_) {}
      try {
        await supabase.auth.signOut();
      } catch (_) {}

      irLogin();
    });
  }

  // -------------------------
  // AUTH UID = fuente de verdad (RLS)
  // -------------------------
  const session = await getSesion();
  const authUserId = session?.user?.id || null;

  console.log("DEBUG authUserId:", authUserId);

  if (!authUserId) {
    irLogin();
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  // -------------------------
  // Perfil (solo para nombre/género)
  // -------------------------
  let usuarioActivo = null;
  try {
    usuarioActivo =
      typeof window.obtenerUsuarioActivo === "function"
        ? await window.obtenerUsuarioActivo()
        : null;
  } catch (_) {}

  // Nombre
  if (nombreZonalEl) {
    nombreZonalEl.textContent = usuarioActivo?.nombre || usuarioActivo?.email || "Zonal";
  }

  // Saludo (desaparece a los 5s)
  const elTextoBienvenida = document.getElementById("textoBienvenida");
  if (elTextoBienvenida) {
    const g = String(usuarioActivo?.genero || "").trim().toUpperCase();
    const esF = g === "F" || g.startsWith("FEM");
    const esM = g === "M" || g.startsWith("MAS");

    elTextoBienvenida.textContent = esF ? "Bienvenida," : esM ? "Bienvenido," : "Bienvenido/a,";

    setTimeout(() => {
      elTextoBienvenida.style.display = "none";
    }, 5000);
  }

  // -------------------------
  // ✅ RBAC (Opción A): validar por rol "zonal" vía RPC get_perfil_actual
  // -------------------------
  try {
    const perfilActual = await getPerfilActual(authUserId);
    console.log("DEBUG perfilActual:", perfilActual);

    if (String(perfilActual || "").toLowerCase() !== "zonal") {
      console.warn("⛔ Acceso denegado: perfil_actual != zonal");
      irLogin();
      return;
    }
  } catch (e) {
    console.error("⛔ Error validando RBAC zonal:", e);
    irLogin();
    return;
  }

  // Fuente de verdad para el resto del panel
  window.idZonalActivo = authUserId;

  // -------------------------
  // Evento cambio de zona
  // -------------------------
  const emitirCambioZona = (idZona) => {
    if (!idZona) return;
    window.dispatchEvent(new CustomEvent("zona:change", { detail: { idZona } }));
  };

  // -------------------------
  // Cargar zonas (zona_zonal + zonas.nombre)
  // -------------------------
  async function cargarZonasZonal() {
    const { data: rel, error: relErr } = await supabase
      .from("zona_zonal")
      .select("id_zona, es_principal, fecha_inicio, fecha_fin")
      .eq("id_zonal", authUserId)
      .lte("fecha_inicio", hoy)
      .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`);

    console.log("DEBUG zona_zonal rel:", rel, "relErr:", relErr);

    if (relErr) return [];
    if (!rel || !rel.length) return [];

    const ids = rel.map((r) => r.id_zona).filter(Boolean);
    const principalById = new Map(rel.map((r) => [r.id_zona, r.es_principal === true]));

    const { data: zonas, error: zErr } = await supabase
      .from("zonas")
      .select("id_zona, nombre")
      .in("id_zona", ids);

    console.log("DEBUG zonas:", zonas, "zErr:", zErr);

    const nombresById = new Map((zonas || []).map((z) => [z.id_zona, z.nombre]));

    return ids.map((id) => ({
      id_zona: id,
      nombre: nombresById.get(id) || `Zona ${id}`,
      es_principal: principalById.get(id) === true,
    }));
  }

  const zonas = await cargarZonasZonal();

  if (!selectZona) {
    console.error("❌ No existe #selectZona en zonal.html");
    return;
  }

  selectZona.innerHTML = "";

  if (!zonas.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Sin zonas asignadas";
    selectZona.appendChild(opt);
    selectZona.disabled = true;
    localStorage.removeItem("idZonaActiva");
  } else {
    selectZona.disabled = false;

    zonas.forEach((z) => {
      const opt = document.createElement("option");
      opt.value = z.id_zona;
      opt.textContent = z.nombre;
      selectZona.appendChild(opt);
    });

    const principal = zonas.find((z) => z.es_principal) || zonas[0];
    selectZona.value = principal.id_zona;
    localStorage.setItem("idZonaActiva", principal.id_zona);
    emitirCambioZona(principal.id_zona);
  }

  selectZona.addEventListener("change", () => {
    const idZona = selectZona.value;
    if (!idZona) return;
    localStorage.setItem("idZonaActiva", idZona);
    emitirCambioZona(idZona);
  });

  // -------------------------
  // Volver por delegación (módulos embebidos)
  // -------------------------
  document.addEventListener(
    "click",
    (ev) => {
      const btn = ev.target?.closest?.("#btnVolver");
      if (!btn) return;

      ev.preventDefault();

      if (contenedorModulos) {
        contenedorModulos.innerHTML = "";
        contenedorModulos.style.display = "none";
      }
      if (panelBotones) panelBotones.style.display = "flex";

      window.dispatchEvent(new CustomEvent("modulo:volver"));
    },
    true
  );

  // -------------------------
  // Módulos (anidados en #contenedor-modulos)
  // -------------------------
  function cargarScriptModulo(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.type = "module";
      s.src = `${src}?v=${Date.now()}`;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.body.appendChild(s);
    });
  }

  async function abrirModulo(viewPath, scriptPath) {
    try {
      const resp = await fetch(viewPath, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      contenedorModulos.innerHTML = await resp.text();
      contenedorModulos.style.display = "block";
      panelBotones.style.display = "none";

      if (scriptPath) await cargarScriptModulo(scriptPath);

      // ui_modales se asegura (si el módulo lo usa)
      await cargarScriptModulo("../scripts/ui_modales.js");
    } catch (e) {
      console.error("❌ Error abriendo módulo:", e);
      alert("No se pudo abrir el módulo. Revisa consola.");
    }
  }

  // Dashboard (tu ruta actual)
  btnDashboard?.addEventListener("click", () =>
    abrirModulo("./dashboard.html", "../scripts/dashboard.js")
  );

  // ✅ Reportes embebido IGUAL que Supervisor
  btnReportes?.addEventListener("click", () =>
    abrirModulo("./reportes-supervisor.html", "../scripts/reportes-supervisor.js")
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initZonal, { once: true });
} else {
  initZonal();
}
