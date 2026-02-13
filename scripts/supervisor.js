// ===========================================================
// SUPERVISOR.JS — Panel Supervisor (SIN RPC)
// ===========================================================

import { supabase, limpiarSesion } from "../config.js";
import { enforceMustChangePassword } from "./guard-must-change-password.js";
import { initVelocimetroTF40 } from "./widgets/velocimetro_tf40.js";
import { startSessionManager } from "../scripts/session-manager.js";


// === AV: Helpers de layout para Cierre Ventas (solo agrega/quita clase, NO toca body/html) ===
function avSetCierreVentasActivo(isActivo) {
  try {
    const cont = document.querySelector("#contenedor-modulos");
    if (!cont) return;
    cont.classList.toggle("av-cierreventas-activo", !!isActivo);
  } catch (_) {}
}


// Guard global: si falla, no tumba el módulo
try {
  await enforceMustChangePassword();
} catch (e) {
  console.warn("⚠️ Guard falló (no bloquea supervisor):", e);
}

async function initSupervisor() {
  // Session Manager transversal (auth + sesión expirada)
  try {
    startSessionManager({
      supabase,
      loginPath: "../index.html",
    });
  } catch (e) {
    console.warn("⚠️ Session Manager no inició:", e);
  }

  const nombreSupervisorEl = document.getElementById("nombreSupervisor");
  const selectEquipo = document.getElementById("selectEquipo");
  const btnLogout = document.getElementById("btnLogout");

  const panelBotones = document.getElementById("panel-botones");
  const contenedorModulos = document.getElementById("contenedor-modulos");

  const btnVendedores = document.getElementById("btnVendedores");
  const btnVentas = document.getElementById("btnVentas");
  const btnCompromisos = document.getElementById("btnCompromisos");
  const btnCierreVentas = document.getElementById("btnCierreVentas"); // ✅ NUEVO
  const btnReportes = document.getElementById("btnReportes");
  const btnSuplencias = document.getElementById("btnSuplencias");
  const btnConfiguracion = document.getElementById("btnConfiguracion");

  // -------------------------
  // Logout (SIEMPRE)
  // -------------------------
  if (btnLogout) {
    btnLogout.addEventListener("click", async (ev) => {
      ev.preventDefault();

      // bypass guard durante cierre
      window.__AV_SKIP_GUARD__ = true;

      try {
        limpiarSesion();
      } catch (_) {}

      // Opción 1: Logout centralizado en el shell (session-manager)
      try {
        const w = window.top || window.parent || window;
        if (typeof w.__avLogout === "function") {
          return await w.__avLogout();
        }
      } catch (_) {}

      // Fallback legado
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn("Logout:", e);
      }

      // Volver al login (sin ensuciar URL si existe __appLogout)
      try {
        const w2 = window.top || window.parent || window;
        if (typeof w2.__appLogout === "function") return w2.__appLogout();
      } catch (_) {}
      window.location.replace("../index.html");
});
  }

  // -------------------------
  // Usuario activo
  // -------------------------
  const usuarioActivo =
    typeof window.obtenerUsuarioActivo === "function"
      ? await window.obtenerUsuarioActivo()
      : (() => {
          try {
            const w = window.top || window.parent;
            if (w && typeof w.obtenerUsuarioActivo === "function") {
              return w.obtenerUsuarioActivo();
            }
          } catch (_) {}
          return null;
        })();


  if (!usuarioActivo?.id) {
    // Volver al login vía shell si existe (URL limpia)
    try {
      const w = window.top || window.parent || window;
      if (typeof w.__appLogout === "function") {
        w.__appLogout();
        return;
      }
    } catch (_) {}
    window.location.replace("../index.html");
    return;
  }

  const idSupervisor = usuarioActivo.id;
  // Fuente de verdad: auth.uid() (usuarioActivo.id). Mantener SOLO en memoria por compatibilidad legacy.
  window.idSupervisorActivo = idSupervisor;
  // NOTA: no persistimos idSupervisor en storage (RBAC: supervisor = auth.uid())
  // Nombre supervisor
  if (nombreSupervisorEl) {
    nombreSupervisorEl.textContent =
      usuarioActivo.nombre || usuarioActivo.email || "Supervisor";
  }

  // Saludo protegido
  const elTextoBienvenida = document.getElementById("textoBienvenida");
  if (elTextoBienvenida) {
    const g = String(usuarioActivo?.genero || "").trim().toUpperCase();
    const esF = g === "F" || g.startsWith("FEM");
    const esM = g === "M" || g.startsWith("MAS");

    elTextoBienvenida.textContent = esF
      ? "Bienvenida,"
      : esM
      ? "Bienvenido,"
      : "Bienvenido/a,";

    setTimeout(() => {
      elTextoBienvenida.style.display = "none";
    }, 5000);
  }

  // -------------------------
  // Eventos
  // -------------------------
  const emitirCambioEquipo = (idEquipo) => {
    if (!idEquipo) return;
    window.dispatchEvent(
      new CustomEvent("equipo:change", { detail: { idEquipo } })
    );
  };

  // -------------------------
  // Equipos
  // -------------------------
  async function cargarEquiposSupervisor() {
    const { data: rel, error: relErr } = await supabase
      .from("equipo_supervisor")
      .select("id_equipo, es_principal")
      .eq("id_supervisor", idSupervisor);

    if (relErr) {
      console.error("❌ Error leyendo equipo_supervisor:", relErr);
      return [];
    }

    const ids = (rel || []).map((r) => r.id_equipo).filter(Boolean);
    if (!ids.length) return [];

    const { data: eqs, error: eqErr } = await supabase
      .from("equipos")
      .select("id_equipo, nombre_equipo")
      .in("id_equipo", ids);

    if (eqErr) {
      console.error("❌ Error leyendo equipos:", eqErr);
      return [];
    }

    const principalById = new Map(
      (rel || []).map((r) => [r.id_equipo, !!r.es_principal])
    );

    return (eqs || []).map((e) => ({
      id_equipo: e.id_equipo,
      nombre_equipo: e.nombre_equipo,
      es_principal: principalById.get(e.id_equipo) || false,
    }));
  }

  const equipos = await cargarEquiposSupervisor();

  if (!selectEquipo) {
    console.error("❌ No existe #selectEquipo en supervisor.html");
  } else {
    selectEquipo.innerHTML = "";

    equipos.forEach((e) => {
      const opt = document.createElement("option");
      opt.value = e.id_equipo;
      opt.textContent = e.nombre_equipo || `Equipo ${e.id_equipo}`;
      selectEquipo.appendChild(opt);
    });

    if (!equipos.length) {
      console.warn("⚠️ Supervisor sin equipos asociados (o RLS bloqueando).");
      localStorage.removeItem("idEquipoActivo");
    } else {
      const principal = equipos.find((e) => e.es_principal) || equipos[0];
      selectEquipo.value = principal.id_equipo;
      localStorage.setItem("idEquipoActivo", principal.id_equipo);
      emitirCambioEquipo(principal.id_equipo);
    }

    selectEquipo.addEventListener("change", () => {
      const idEquipo = selectEquipo.value;
      if (!idEquipo) return;
      localStorage.setItem("idEquipoActivo", idEquipo);
      emitirCambioEquipo(idEquipo);
    });
  }

  // -------------------------
  // Velocímetro TF40 (VA/VM) — embebido en franja celeste
  // -------------------------
  try {
    await initVelocimetroTF40({
      supabase,
      containerId: "velocimetro-tf40",
      getUsuarioActivo: async () => usuarioActivo,
      getEquipoActivo: () => localStorage.getItem("idEquipoActivo"),
    });
  } catch (e) {
    console.warn("⚠️ Velocímetro TF40 no inicializó:", e);
  }

  // -------------------------
  // Volver robusto por delegación
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
      avSetCierreVentasActivo(false);
      window.dispatchEvent(new CustomEvent("modulo:volver"));
    },
    true
  );

  // -------------------------
  // Módulos
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

  async function abrirModulo(viewPath, scriptPath /* opcional */) {
    try {
      const resp = await fetch(viewPath, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      contenedorModulos.innerHTML = await resp.text();

      // AV: centra Cierre Ventas dentro del margen
      avSetCierreVentasActivo(String(viewPath||"").includes("cierre_ventas"));
      contenedorModulos.style.display = "block";
      panelBotones.style.display = "none";

      // Script del módulo (si aplica)
      if (scriptPath) {
        await cargarScriptModulo(scriptPath);
      }

      // Gestor de modales (siempre)
      await cargarScriptModulo("../scripts/ui_modales.js");
    } catch (e) {
      console.error("❌ Error abriendo módulo:", e);
      alert("No se pudo abrir el módulo. Revisa consola.");
    }
  }

  btnVendedores?.addEventListener("click", () =>
    abrirModulo("./vendedores.html", "../scripts/vendedores.js")
  );
  btnVentas?.addEventListener("click", () =>
    abrirModulo("./ventas.html", "../scripts/ventas.js")
  );
  btnCompromisos?.addEventListener("click", () =>
    abrirModulo("./compromisos.html", "../scripts/compromisos.js")
  );

  // ✅ Cierre mensual ventas (anidado igual que los demás)
  btnCierreVentas?.addEventListener("click", () =>
    abrirModulo("./cierre_ventas.html", "../scripts/cierre_ventas.js")
  );

  btnReportes?.addEventListener("click", () =>
    abrirModulo("./reportes-supervisor.html", "../scripts/reportes-supervisor.js")
  );

  btnSuplencias?.addEventListener("click", () => alert("Suplencias: pendiente"));
  btnConfiguracion?.addEventListener("click", () =>
    abrirModulo(
      "./parametros-supervisor.html",
      "../scripts/parametros-supervisor.js"
    )
  );
}

// Ejecuta SIEMPRE (aunque DOMContentLoaded ya pasó)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSupervisor, { once: true });
} else {
  initSupervisor();
}
