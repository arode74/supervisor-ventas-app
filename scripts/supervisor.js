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
  // Control "Vendedor Nuevo" (Mes 5) — POPUP al entrar / cambiar equipo
  // Regla:
  // - nuevo = true
  // - vigente: fecha_egreso IS NULL o >= hoy  (además de relación vigente con equipo)
  // - hito = 1er día del mes que corresponde al "mes 5" (mes ingreso + 4 meses calendario, día 01)
  // - mostrar desde 3 días hábiles antes del hito (incluye el hito)
  // Acciones:
  // - Renovar: nuevo = false
  // - Baja: abre Módulo Vendedores y ejecuta el MISMO flujo de baja (fecha obligatoria + validaciones)
  // -------------------------
  const modalNuevos = document.getElementById("modalNuevosVendedores");
  const tbodyNuevos = document.getElementById("tbodyNuevosVendedores");

  function _fmtISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function _parseDateISO(s) {
    if (!s) return null;
    const str = String(s).slice(0, 10);
    const parts = str.split("-");
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function _addMonthsCalendar(dateObj, months) {
    const d = new Date(dateObj.getTime());
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();

    const base = new Date(y, m + months, 1);
    const maxDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(day, maxDay));
    return base;
  }

  function _firstDayOfMonth(dateObj) {
    return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
  }

  function _isWeekend(dateObj) {
    const wd = dateObj.getDay();
    return wd === 0 || wd === 6;
  }

  function _subtractBusinessDays(dateObj, n) {
    const d = new Date(dateObj.getTime());
    let left = n;
    while (left > 0) {
      d.setDate(d.getDate() - 1);
      if (!_isWeekend(d)) left--;
    }
    return d;
  }

  async function _fetchVendedoresEquipo(idEquipo) {
    const { data, error } = await supabase
      .from("equipo_vendedor")
      .select("id_vendedor,id_equipo,fecha_inicio,fecha_fin,estado,vendedores(id_vendedor,nombre,fecha_ingreso,fecha_egreso,nuevo,rut,dv)")
      .eq("id_equipo", idEquipo)
      .is("fecha_fin", null);

    if (error) {
      console.error("❌ Error leyendo equipo_vendedor/vendedores:", error);
      return [];
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return (data || [])
      .map((r) => {
        const v = r.vendedores || {};
        return {
          id_vendedor: r.id_vendedor || v.id_vendedor,
          id_equipo: r.id_equipo,
          nombre: v.nombre || "",
          fecha_ingreso: v.fecha_ingreso ? String(v.fecha_ingreso).slice(0, 10) : null,
          fecha_egreso: v.fecha_egreso ? String(v.fecha_egreso).slice(0, 10) : null,
          nuevo: v.nuevo === true,
        };
      })
      .filter((v) => {
        if (!v.nuevo) return false;
        if (!v.fecha_egreso) return true;
        const fe = _parseDateISO(v.fecha_egreso);
        if (!fe) return true;
        fe.setHours(0, 0, 0, 0);
        return fe >= hoy;
      });
  }

  function _calcHitoMes5(fechaIngresoISO) {
    const fi = _parseDateISO(fechaIngresoISO);
    if (!fi) return null;
    const plus4 = _addMonthsCalendar(fi, 4);
    return _firstDayOfMonth(plus4);
  }

  function _enVentanaAviso(hito) {
    if (!hito) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicioAviso = _subtractBusinessDays(hito, 3);
    inicioAviso.setHours(0, 0, 0, 0);

    const finAviso = new Date(hito.getTime());
    finAviso.setHours(0, 0, 0, 0);

    return hoy >= inicioAviso && hoy <= finAviso;
  }

  function _renderPopup(rows) {
    if (!tbodyNuevos) return;

    if (!rows.length) {
      tbodyNuevos.innerHTML = `<tr><td colspan="4" class="texto-centro">No hay vendedores en control.</td></tr>`;
      return;
    }

    tbodyNuevos.innerHTML = rows
      .map((r) => {
        const nombre = (r.nombre || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const fi = r.fecha_ingreso || "";
        const hito = r.hitoISO || "";
        return `
          <tr data-idv="${r.id_vendedor}" data-ide="${r.id_equipo}">
            <td>${nombre}</td>
            <td>${fi}</td>
            <td>${hito}</td>
            <td class="acciones" style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:nowrap; align-items:center;">
              <button type="button" class="btn-primario av-btn-renovar" data-idv="${r.id_vendedor}">Renovar</button>
              <button type="button" class="btn-secundario av-btn-baja" data-idv="${r.id_vendedor}" data-ide="${r.id_equipo}">Baja</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function checkNuevosVendedores(idEquipo) {
    try {
      if (!idEquipo) return;

      const list = await _fetchVendedoresEquipo(idEquipo);
      const rows = list
        .map((v) => {
          const hito = _calcHitoMes5(v.fecha_ingreso);
          const hitoISO = hito ? _fmtISO(hito) : "";
          return { ...v, hito, hitoISO };
        })
        .filter((v) => v.hito && _enVentanaAviso(v.hito));

      _renderPopup(rows);

      if (rows.length && modalNuevos) {
        if (typeof modalNuevos.showModal === "function") {
          if (!modalNuevos.open) modalNuevos.showModal();
        } else {
          modalNuevos.setAttribute("open", "open");
        }
      } else if (modalNuevos) {
        if (modalNuevos.open && typeof modalNuevos.close === "function") modalNuevos.close();
        else modalNuevos.removeAttribute("open");
      }
    } catch (e) {
      console.error("❌ Error checkNuevosVendedores:", e);
    }
  }

  async function _renovarVendedor(idVendedor, idEquipo) {
    const { error } = await supabase
      .from("vendedores")
      .update({ nuevo: false })
      .eq("id_vendedor", idVendedor);

    if (error) {
      console.error("❌ Error renovando vendedor:", error);
      alert("No fue posible renovar (marcar como no nuevo). Revisa permisos/RLS.");
      return;
    }

    await checkNuevosVendedores(idEquipo);
  }

  async function _darDeBajaViaModuloVendedores(idVendedor, idEquipo) {
    await abrirModulo("./vendedores.html", "../scripts/vendedores.js");

    const maxWaitMs = 4000;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const api = window.AppVentas?.features?.vendedores;
      if (api && typeof api.abrirBajaPorId === "function") {
        await api.abrirBajaPorId(idVendedor, idEquipo);
        return;
      }
      await new Promise((r) => setTimeout(r, 120));
    }

    alert("No se pudo abrir el flujo de baja. Reintenta abriendo Gestión de Vendedores.");
  }

  document.addEventListener(
    "click",
    async (ev) => {
      const btnRen = ev.target?.closest?.(".av-btn-renovar");
      const btnBaja = ev.target?.closest?.(".av-btn-baja");
      if (!btnRen && !btnBaja) return;

      if (btnRen) {
        ev.preventDefault();
        const idV = btnRen.getAttribute("data-idv");
        const eq = localStorage.getItem("idEquipoActivo") || btnRen.closest("tr")?.dataset?.ide || null;
        await _renovarVendedor(idV, eq);
        return;
      }

      if (btnBaja) {
        ev.preventDefault();
        const idV = btnBaja.getAttribute("data-idv");
        const idE = btnBaja.getAttribute("data-ide") || localStorage.getItem("idEquipoActivo");
        await _darDeBajaViaModuloVendedores(idV, idE);
      }
    },
    true
  );

  // Ejecutar al entrar (equipo principal) y cada vez que cambie equipo
  try {
    const eq0 = localStorage.getItem("idEquipoActivo");
    if (eq0) checkNuevosVendedores(eq0);
  } catch (_) {}

  window.addEventListener("equipo:change", (e) => {
    const idE = e?.detail?.idEquipo || localStorage.getItem("idEquipoActivo");
    if (idE) checkNuevosVendedores(idE);
  });


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
