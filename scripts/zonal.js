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
  // Alertas in-app
  // -------------------------
  function avEnsureAlertasStyle() {
    if (document.getElementById("av-alertas-style")) return;
    const style = document.createElement("style");
    style.id = "av-alertas-style";
    style.textContent = `
      .av-alertas-wrap{ position:relative; display:inline-flex; align-items:center; margin-right:10px; }
      .av-alertas-btn{ position:relative; width:44px; height:44px; border-radius:12px; border:1px solid rgba(255,255,255,.65); background:rgba(255,255,255,.08); color:#fff; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
      .av-alertas-btn:hover{ background:rgba(255,255,255,.16); }
      .av-alertas-icono{ font-size:18px; line-height:1; }
      .av-alertas-badge{ position:absolute; top:-6px; right:-6px; min-width:20px; height:20px; padding:0 6px; border-radius:999px; background:#d32f2f; color:#fff; font-size:12px; font-weight:700; display:none; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.25); }
      .av-alertas-panel{ display:none; position:absolute; top:calc(100% + 10px); right:0; width:360px; max-height:430px; overflow:hidden; background:rgba(10,26,47,.78); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,.15); border-radius:14px; box-shadow:0 10px 28px rgba(0,0,0,.18); z-index:3000; }
      .av-alertas-panel.visible{ display:block; }
      .av-alertas-head{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.08); color:#fff; }
      .av-alertas-head strong{ font-size:14px; }
      .av-alertas-marcar{ border:0; background:transparent; color:#9ecbff; cursor:pointer; font-size:13px; font-weight:600; }
      .av-alertas-lista{ max-height:360px; overflow-y:auto; }
      .av-alerta-item{ padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.08); cursor:pointer; background:transparent; color:#fff; }
      .av-alerta-item:hover{ background:rgba(255,255,255,.08); }
      .av-alerta-item.no-leida{ background:rgba(0,120,255,.10); }
      .av-alerta-titulo{ font-size:14px; font-weight:700; margin-bottom:4px; }
      .av-alerta-mensaje{ font-size:13px; color:rgba(255,255,255,.90); margin-bottom:6px; }
      .av-alerta-meta{ font-size:12px; color:rgba(255,255,255,.72); }
      .av-alertas-vacio{ padding:18px 14px; font-size:13px; color:rgba(255,255,255,.72); }
      @media (max-width: 640px){ .av-alertas-panel{ width:min(360px, calc(100vw - 24px)); right:-6px; } }
    `;
    document.head.appendChild(style);
  }

  function avEnsureAlertasDOM() {
    let wrap = document.getElementById("alertasWrapper");
    if (wrap && document.getElementById("btnAlertas") && document.getElementById("alertasPanel") && document.getElementById("alertasLista")) {
      return {
        wrap,
        btn: document.getElementById("btnAlertas"),
        badge: document.getElementById("alertasBadge"),
        panel: document.getElementById("alertasPanel"),
        lista: document.getElementById("alertasLista"),
        marcarTodas: document.getElementById("btnMarcarTodasAlertas")
      };
    }

    const right = document.querySelector(".supbar__right");
    if (!right) return {};

    wrap = document.createElement("div");
    wrap.className = "av-alertas-wrap";
    wrap.id = "alertasWrapper";
    wrap.innerHTML = `
      <button type="button" class="av-alertas-btn" id="btnAlertas" aria-label="Ver alertas" title="Alertas">
        <span class="av-alertas-icono">🔔</span>
        <span class="av-alertas-badge" id="alertasBadge" style="display:none;">0</span>
      </button>
      <div class="av-alertas-panel" id="alertasPanel">
        <div class="av-alertas-head">
          <strong>Alertas</strong>
          <button type="button" class="av-alertas-marcar" id="btnMarcarTodasAlertas">Marcar todas</button>
        </div>
        <div class="av-alertas-lista" id="alertasLista">
          <div class="av-alertas-vacio">No hay alertas.</div>
        </div>
      </div>`;
    right.insertBefore(wrap, document.getElementById("btnLogout") || right.firstChild);
    return {
      wrap,
      btn: document.getElementById("btnAlertas"),
      badge: document.getElementById("alertasBadge"),
      panel: document.getElementById("alertasPanel"),
      lista: document.getElementById("alertasLista"),
      marcarTodas: document.getElementById("btnMarcarTodasAlertas")
    };
  }

  function avEscapeHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function avFmtFechaAlerta(fechaIso) {
    if (!fechaIso) return "";
    try {
      return new Date(fechaIso).toLocaleString("es-CL", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
      });
    } catch (_) { return fechaIso; }
  }

  avEnsureAlertasStyle();
  const avAlertas = avEnsureAlertasDOM();
  let avAlertasInit = false;

  async function avContarAlertasNoLeidas() {
    if (!avAlertas.badge) return 0;
    const { data, error } = await supabase.rpc("contar_mis_alertas_no_leidas");
    if (error) {
      console.error("❌ Error contando alertas:", error);
      return 0;
    }
    const total = Number(data || 0);
    avAlertas.badge.textContent = String(total);
    avAlertas.badge.style.display = total > 0 ? "inline-flex" : "none";
    return total;
  }

  async function avCargarAlertas() {
    if (!avAlertas.lista) return [];
    avAlertas.lista.innerHTML = `<div class="av-alertas-vacio">Cargando alertas...</div>`;
    const { data, error } = await supabase.rpc("listar_mis_alertas", { p_solo_no_leidas: false, p_limite: 20 });
    if (error) {
      console.error("❌ Error cargando alertas:", error);
      avAlertas.lista.innerHTML = `<div class="av-alertas-vacio">No fue posible cargar las alertas.</div>`;
      return [];
    }
    const alertas = Array.isArray(data) ? data : [];
    if (!alertas.length) {
      avAlertas.lista.innerHTML = `<div class="av-alertas-vacio">No hay alertas.</div>`;
      return [];
    }
    avAlertas.lista.innerHTML = alertas.map((a) => `
      <div class="av-alerta-item ${a.leida ? '' : 'no-leida'}" data-id-alerta="${a.id_alerta}">
        <div class="av-alerta-titulo">${avEscapeHtml(a.titulo || 'Alerta')}</div>
        <div class="av-alerta-mensaje">${avEscapeHtml(a.mensaje || '')}</div>
        <div class="av-alerta-meta">${avFmtFechaAlerta(a.fecha_creacion)}</div>
      </div>`).join('');

    avAlertas.lista.querySelectorAll('.av-alerta-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const idAlerta = item.dataset.idAlerta;
        const { error: markErr } = await supabase.rpc('marcar_alerta_leida', { p_id_alerta: idAlerta });
        if (markErr) {
          console.error('❌ Error marcando alerta leída:', markErr);
          return;
        }
        item.classList.remove('no-leida');
        await avContarAlertasNoLeidas();
      });
    });
    return alertas;
  }

  async function avRefrescarAlertasUI() {
    await avContarAlertasNoLeidas();
    if (avAlertas.panel?.classList.contains('visible')) await avCargarAlertas();
  }

  if (!avAlertasInit && avAlertas.btn && avAlertas.panel) {
    avAlertasInit = true;
    avAlertas.btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const abrir = !avAlertas.panel.classList.contains('visible');
      avAlertas.panel.classList.toggle('visible', abrir);
      if (abrir) {
        await avContarAlertasNoLeidas();
        await avCargarAlertas();
      }
    });

    avAlertas.marcarTodas?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const { error } = await supabase.rpc('marcar_todas_mis_alertas_leidas');
      if (error) {
        console.error('❌ Error marcando todas las alertas:', error);
        return;
      }
      await avContarAlertasNoLeidas();
      await avCargarAlertas();
    });

    document.addEventListener('click', (ev) => {
      if (!avAlertas.wrap?.contains(ev.target)) avAlertas.panel.classList.remove('visible');
    });

    window.addEventListener('alertas:refresh', avRefrescarAlertasUI);
    window.addEventListener('suplencia-aceptada', avRefrescarAlertasUI);
    window.addEventListener('suplencia-rechazada', avRefrescarAlertasUI);
    window.addEventListener('suplencia-cancelada', avRefrescarAlertasUI);
    window.addEventListener('suplencia-terminada', avRefrescarAlertasUI);
    window.addEventListener('solicitud-suplencia-creada', avRefrescarAlertasUI);

    avContarAlertasNoLeidas();
    setInterval(avContarAlertasNoLeidas, 60000);
  }


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
