
function avSyncCierreVentasHeadWidths() {
  const root = document.querySelector("#modulo-cierre-ventas");
  if (!root) return;

  const scroller = root.querySelector(".contenedor-tabla");
  const headWrap = root.querySelector(".contenedor-tabla-head");
  const headTable = root.querySelector("#tablaCierreHead");
  const bodyTable = root.querySelector("#tablaCierre");

  if (!scroller || !headWrap || !headTable || !bodyTable) return;

  // 1) Asegura que el header use el mismo ancho visible que el body (sin scrollbar)
  const visibleW = scroller.clientWidth; // excluye scrollbar
  headWrap.style.width = visibleW + "px";

  // 2) Sincroniza colgroup si existe (recomendado)
  const bodyCols = bodyTable.querySelectorAll("colgroup col");
  const headCols = headTable.querySelectorAll("colgroup col");

  if (bodyCols.length && headCols.length && bodyCols.length === headCols.length) {
    // Medimos ancho real de cada columna usando los TH/TD del body en la primera fila visible
    // Preferimos medir por col->getBoundingClientRect no funciona bien; medimos celdas.
    const firstRow = bodyTable.querySelector("tbody tr");
    if (firstRow) {
      const bodyCells = Array.from(firstRow.children);
      const widths = bodyCells.map(td => Math.round(td.getBoundingClientRect().width));

      // Fallback si por alguna razón no hay celdas (tabla vacía)
      if (widths.length === headCols.length) {
        widths.forEach((w, i) => {
          headCols[i].style.width = w + "px";
          bodyCols[i].style.width = w + "px";
        });
      }
    }
  }

  // 3) Forzar reflow del head table al nuevo ancho
  headTable.style.width = visibleW + "px";
}


// ===========================================================
// AV Scroll Trap (módulo): evita scroll chaining al contenedor padre
// - Captura wheel/touchmove en CAPTURE + passive:false dentro del módulo
// - Redirige el delta a .contenedor-tabla
// ===========================================================
function avCierreVentasInstallScrollTrap() {
  const root = document.querySelector("#modulo-cierre-ventas");
  const scroller = root?.querySelector(".contenedor-tabla");
  if (!root || !scroller) return () => {};

  const onWheel = (e) => {
    if (!root.contains(e.target)) return;
    const dy = e.deltaY || 0;
    if (Math.abs(dy) < 0.01) return;
    e.preventDefault();
    e.stopPropagation();
    scroller.scrollTop += dy;
  };

  let touchY = 0;
  const onTouchStart = (e) => {
    if (!root.contains(e.target)) return;
    touchY = e.touches?.[0]?.clientY ?? 0;
  };
  const onTouchMove = (e) => {
    if (!root.contains(e.target)) return;
    const y = e.touches?.[0]?.clientY ?? 0;
    const dy = touchY - y;
    if (Math.abs(dy) < 0.5) return;
    e.preventDefault();
    e.stopPropagation();
    scroller.scrollTop += dy;
    touchY = y;
  };

  document.addEventListener("wheel", onWheel, { capture: true, passive: false });
  document.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
  document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });

  return () => {
    document.removeEventListener("wheel", onWheel, { capture: true });
    document.removeEventListener("touchstart", onTouchStart, { capture: true });
    document.removeEventListener("touchmove", onTouchMove, { capture: true });
  };
}


function avSetScrollbarWidthVar() {
  const root = document.querySelector("#modulo-cierre-ventas");
  const scroller = root?.querySelector(".contenedor-tabla");
  if (!root || !scroller) return;

  // create measurement using scroller itself
  const sbw = scroller.offsetWidth - scroller.clientWidth; // includes scrollbar
  root.style.setProperty("--av-sbw", (sbw > 0 ? sbw : 0) + "px");
}


import { supabase } from "../config.js";

const ROOT_ID = "modulo-cierre-ventas";

let tabla = null;
let tbody = null;
let btnGuardarCierre = null;
let selectMes = null;
let selectAnio = null;

let totTFEl = null;
let totG40El = null;
let totG70El = null;
let totPLANEl = null;
let totPVEl = null;
let scrollCierreEl = null;


let idEquipo = null;

// Perfil actual (RBAC)
let rolActual =
  localStorage.getItem("perfil_actual") ||
  sessionStorage.getItem("perfil_actual") ||
  "supervisor";

let existentesPorVendedor = new Map();
let contratosPorVendedor = new Map();
let fuenteActual = 'BASE';

// ======================================================
// Utilidades base


// ======================================================
// Helpers UI (totales, sticky, PV, scroll aislado)
// ======================================================
const fmtCL = new Intl.NumberFormat("es-CL");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMiles(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return fmtCL.format(Math.max(0, Math.trunc(x)));
}

function ajustarStickyTop() {
  try {
    const thead = tabla?.querySelector("thead");
    if (!thead || !thead.rows?.length) return;
    const h = Math.ceil(thead.rows[0].getBoundingClientRect().height || 44);
    tabla.style.setProperty("--thead-h", `${h}px`);
  } catch (_) {}
}

function setPVValue(inp, rawValue) {
  if (!inp) return;
  const raw = String(rawValue ?? "").replace(/\D/g, "").slice(0, 9); // 999.999.999
  inp.dataset.raw = raw;
  inp.value = raw ? formatMiles(Number(raw)) : "";
}

function formatearPVEnVivo(inp) {
  if (!inp) return;

  const start = inp.selectionStart ?? inp.value.length;
  const before = inp.value.slice(0, start);
  const digitsBefore = before.replace(/\D/g, "").length;

  const raw = inp.value.replace(/\D/g, "").slice(0, 9);
  inp.dataset.raw = raw;

  const formatted = raw ? formatMiles(Number(raw)) : "";
  inp.value = formatted;

  let pos = 0;
  let seen = 0;
  while (pos < inp.value.length && seen < digitsBefore) {
    if (/[0-9]/.test(inp.value[pos])) seen++;
    pos++;
  }
  try { inp.setSelectionRange(pos, pos); } catch (_) {}
}

function limitarInputCierreA199(inp) {
  if (!inp || inp.dataset.tipo === "PV") return;

  const raw = String(inp.value ?? "").replace(/\D/g, "");
  if (!raw) {
    inp.value = "";
    return;
  }

  const n = Math.min(Number(raw), 199);
  inp.value = Number.isFinite(n) ? String(n) : "";
}

function recalcularTotales() {
  if (!tbody) return;

  let sumTF = 0, sumG40 = 0, sumG70 = 0, sumPLAN = 0, sumPV = 0;

  const filas = [...tbody.querySelectorAll("tr[data-id-vendedor]")];
  for (const tr of filas) {
    sumTF   += numOrZero(tr.querySelector('input[data-tipo="BAJO"]')?.value);
    sumG40  += numOrZero(tr.querySelector('input[data-tipo="SOBRE"]')?.value);
    sumG70  += numOrZero(tr.querySelector('input[data-tipo="TOPE"]')?.value);
    sumPLAN += numOrZero(tr.querySelector('input[data-tipo="PLAN"]')?.value);

    const pvInp = tr.querySelector('input[data-tipo="PV"]');
    sumPV += numOrZero(pvInp?.dataset?.raw ?? pvInp?.value);
  }

  if (totTFEl) totTFEl.textContent = formatMiles(sumTF);
  if (totG40El) totG40El.textContent = formatMiles(sumG40);
  if (totG70El) totG70El.textContent = formatMiles(sumG70);
  if (totPLANEl) totPLANEl.textContent = formatMiles(sumPLAN);
  if (totPVEl) totPVEl.textContent = formatMiles(sumPV);
}

function aislarScrollSoloEnTabla() {
  if (!scrollCierreEl) return;
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const canScroll = () => scrollCierreEl && (scrollCierreEl.scrollHeight > scrollCierreEl.clientHeight + 2);
  const scrollBy = (dy) => { scrollCierreEl.scrollTop += dy; };

  // Captura GLOBAL: si el gesto ocurre dentro del módulo, el scroll se redirige a la lista.
  // Esto evita que el trackpad “escape” y scrollee el contenedor padre (supervisor).
  const onWheel = (e) => {
    if (!root.contains(e.target)) return;
    if (!canScroll()) return;
    e.preventDefault();
    e.stopPropagation();
    scrollBy(e.deltaY);
  };

  if (window.__av_cierre_wheel_handler) {
    window.removeEventListener('wheel', window.__av_cierre_wheel_handler, true);
  }
  window.__av_cierre_wheel_handler = onWheel;
  window.addEventListener('wheel', onWheel, { passive: false, capture: true });

  // Touch (móvil)
  let lastY = null;
  const onTouchStart = (e) => {
    if (!root.contains(e.target)) return;
    if (!e.touches?.length) return;
    lastY = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (!root.contains(e.target)) return;
    if (!e.touches?.length || lastY === null) return;
  };

  // Implementación touch real (sin 'None')
  root.addEventListener('touchstart', (e) => {
    if (!e.touches?.length) return;
    lastY = e.touches[0].clientY;
  }, { passive: true, capture: true });

  root.addEventListener('touchmove', (e) => {
    if (!e.touches?.length || lastY === null) return;
    if (!canScroll()) return;
    e.preventDefault();
    e.stopPropagation();
    const y = e.touches[0].clientY;
    const dy = lastY - y;
    lastY = y;
    scrollBy(dy);
  }, { passive: false, capture: true });
}

// ======================================================
// ======================================================
// Layout scroll cierre ventas
// - Mantiene el scroll dentro de la tabla
// - Evita que el contenedor padre/página tenga que desplazarse
// - Corrige el caso donde el scroller calcula menor altura que la tabla real
// ======================================================
function aplicarLayoutScrollCierre() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const scroller = scrollCierreEl || root.querySelector("#scrollCierre") || root.querySelector(".contenedor-tabla");
  const tablaBody = tabla || root.querySelector("#tablaCierre");
  const headWrap = root.querySelector(".contenedor-tabla-head");

  if (!scroller || !tablaBody) return;

  root.style.overflow = "hidden";

  const rect = scroller.getBoundingClientRect();
  const margenInferior = 24;
  const altoDisponible = Math.max(260, Math.floor(window.innerHeight - rect.top - margenInferior));

  scroller.style.height = `${altoDisponible}px`;
  scroller.style.maxHeight = `${altoDisponible}px`;
  scroller.style.overflowY = "auto";
  scroller.style.overflowX = "auto";
  scroller.style.position = "relative";
  scroller.style.overscrollBehavior = "contain";

  tablaBody.style.display = "table";
  tablaBody.style.width = "100%";
  tablaBody.style.height = "auto";
  tablaBody.style.maxHeight = "none";
  tablaBody.style.position = "relative";

  if (headWrap) {
    headWrap.style.overflow = "hidden";
  }

  try { avSetScrollbarWidthVar(); } catch (_) {}
  try { avSyncCierreVentasHeadWidths(); } catch (_) {}
}


// ======================================================
// Layout columnas cierre ventas
// - Alinea encabezados sobre cada input editable
// - TF, >40, >70 y Plan aceptan hasta 199 con ancho justo para flechas nativas
// - Producto Voluntario acepta hasta 999.999.999 y usa ancho justo
// ======================================================
function aplicarLayoutColumnasCierre() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const styleId = "av-cierre-ventas-columnas-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #modulo-cierre-ventas #tablaCierre,
      #modulo-cierre-ventas #tablaCierreHead {
        table-layout: fixed !important;
        border-collapse: collapse;
      }

      #modulo-cierre-ventas #tablaCierreHead th,
      #modulo-cierre-ventas #tablaCierre td {
        box-sizing: border-box;
        vertical-align: middle;
      }

      #modulo-cierre-ventas #tablaCierreHead th:not(:first-child),
      #modulo-cierre-ventas #tablaCierre td:not(:first-child) {
        text-align: center !important;
        padding-left: 4px !important;
        padding-right: 4px !important;
      }

      #modulo-cierre-ventas #tablaCierreHead th {
        white-space: normal !important;
        line-height: 1.1 !important;
        text-align: center !important;
      }

      #modulo-cierre-ventas #tablaCierre .input-cierre,
      #modulo-cierre-ventas #tablaCierre .input-cierre-pv {
        box-sizing: border-box !important;
        display: block !important;
        margin-left: auto !important;
        margin-right: auto !important;
        text-align: center !important;
      }

      #modulo-cierre-ventas #tablaCierre .input-cierre {
        width: 76px !important;
        max-width: 76px !important;
        min-width: 76px !important;
        padding-left: 8px !important;
        padding-right: 20px !important; /* reserva espacio para flechas nativas */
        text-align: left !important;
      }

      #modulo-cierre-ventas #tablaCierre .input-cierre-pv {
        width: 150px !important;
        max-width: 150px !important;
        min-width: 150px !important;
      }
    `;
    document.head.appendChild(style);
  }

  const headTable = root.querySelector("#tablaCierreHead");
  const bodyTable = root.querySelector("#tablaCierre");
  if (!headTable || !bodyTable) return;

  const widths = [270, 78, 86, 86, 86, 86, 170];
  for (const table of [headTable, bodyTable]) {
    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      const firstChild = table.firstElementChild;
      table.insertBefore(colgroup, firstChild);
    }

    colgroup.innerHTML = widths.map((w) => `<col style="width:${w}px; min-width:${w}px; max-width:${w}px;">`).join("");
    table.style.minWidth = `${widths.reduce((a, b) => a + b, 0)}px`;
  }
}

function mesActualPorDefecto() {
  const d = new Date();
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
}

function obtenerPeriodoSeguro() {
  const hoy = new Date();
  const defMes = hoy.getMonth() + 1;
  const defAnio = hoy.getFullYear();

  const mesRaw = Number(selectMes?.value);
  const anioRaw = Number(selectAnio?.value);

  const mes =
    Number.isInteger(mesRaw) && mesRaw >= 1 && mesRaw <= 12 ? mesRaw : defMes;

  const anio =
    Number.isInteger(anioRaw) && anioRaw >= 1900 && anioRaw <= 2100
      ? anioRaw
      : defAnio;

  return { mes, anio };
}

function leerEquipoActivo() {
  return (
    localStorage.getItem("idEquipoActivo") ||
    sessionStorage.getItem("idEquipoActivo") ||
    null
  );
}

// input vacío => 0
function numOrZero(v) {
  if (v === null || v === undefined) return 0;
  const s0 = String(v).trim();
  if (!s0) return 0;
  // permite "1.234.567" o "$ 1.234"
  const s = s0.replace(/[^0-9-]/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(n, 0) : 0;
}

// ======================================================
// DOM
// ======================================================
function bindDOM() {
  const root = document.getElementById(ROOT_ID);
  const scope = root || document;

  tabla = scope.querySelector("#tablaCierre");
  tbody = tabla?.querySelector("tbody") || null;
  btnGuardarCierre = scope.querySelector("#btnGuardarCierre");
  selectMes = scope.querySelector("#selectMes");
  selectAnio = scope.querySelector("#selectAnio");

  totTFEl = scope.querySelector("#totTF");
  totG40El = scope.querySelector("#totG40");
  totG70El = scope.querySelector("#totG70");
  totPLANEl = scope.querySelector("#totPLAN");
  totPVEl = scope.querySelector("#totPV");
  scrollCierreEl = scope.querySelector("#scrollCierre");

  return !!(tabla && tbody && btnGuardarCierre && selectMes && selectAnio);
}

async function esperarDOM(maxMs = 8000) {
  if (bindDOM()) return true;

  return await new Promise((resolve) => {
    const obs = new MutationObserver(() => {
      if (bindDOM()) {
        obs.disconnect();
        resolve(true);
      }
    });

    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => resolve(bindDOM()), maxMs);
  });
}

// ======================================================
// Select Año (si viene vacío)
// ======================================================
function asegurarOpcionesAnio() {
  const currentYear = new Date().getFullYear();

  const opciones = Array.from(selectAnio.options || []);
  const tieneOpcionesValidas = opciones.some((o) => {
    const y = Number(o.value);
    return Number.isInteger(y) && y >= 1900 && y <= 2100;
  });

  if (tieneOpcionesValidas) return;

  selectAnio.innerHTML = "";
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    selectAnio.appendChild(opt);
  }
}

function setearDefaultsMesAnio() {
  const def = mesActualPorDefecto();
  if (selectMes) selectMes.value = String(def.mes);
  if (selectAnio) {
    asegurarOpcionesAnio();
    selectAnio.value = String(def.anio);
  }
}

// ======================================================
// Datos
// ======================================================
async function obtenerVendedoresDelMes(idEquipoLocal, anio, mes) {
  const ini = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const finDia = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, "0")}-${String(finDia).padStart(
    2,
    "0"
  )}`;

  const { data, error } = await supabase
    .from("equipo_vendedor")
    .select(
      `
      id_vendedor,
      fecha_inicio,
      fecha_fin,
      vendedores (
        id_vendedor,
        nombre
      )
    `
    )
    .eq("id_equipo", idEquipoLocal)
    .lte("fecha_inicio", fin)
    .or(`fecha_fin.is.null,fecha_fin.gte.${ini}`);

  if (error) throw error;

  const out = [];
  const seen = new Set();

  for (const r of data || []) {
    const v = r?.vendedores;
    if (!v?.id_vendedor || seen.has(v.id_vendedor)) continue;
    seen.add(v.id_vendedor);
    out.push({ id_vendedor: v.id_vendedor, nombre: v.nombre || "" });
  }

  out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return out;
}

async function obtenerContratosPorVendedor(idEquipoLocal, anio, mes, vendedores = []) {
  contratosPorVendedor = new Map();

  const ids = [...new Set((vendedores || []).map(v => v.id_vendedor).filter(Boolean))];
  if (!ids.length) return contratosPorVendedor;

  const ini = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const finDia = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, "0")}-${String(finDia).padStart(2, "0")}`;

  try {
    const { data, error } = await supabase
      .from("vendedor_contrato")
      .select(`
        id_vendedor,
        fecha_inicio,
        fecha_fin,
        contratos (
          descripcion
        )
      `)
      .in("id_vendedor", ids)
      .lte("fecha_inicio", fin)
      .or(`fecha_fin.is.null,fecha_fin.gte.${ini}`);

    if (error) throw error;

    for (const r of data || []) {
      const id = r?.id_vendedor;
      if (!id || contratosPorVendedor.has(id)) continue;
      contratosPorVendedor.set(id, r?.contratos?.descripcion || "");
    }
  } catch (err) {
    console.warn("No se pudieron cargar contratos vigentes:", err);
  }

  return contratosPorVendedor;
}

async function obtenerMontosExistentes(idEquipoLocal, anio, mes) {
  existentesPorVendedor = new Map();

  try {
    const { data, error } = await supabase.rpc("rpc_cierre_ventas_mes_equipo", {
      p_id_equipo: idEquipoLocal,
      p_anio: anio,
      p_mes: mes,
    });

    if (error) throw error;

    fuenteActual = (data && data[0] && data[0].fuente) ? String(data[0].fuente) : 'BASE';

    (data || []).forEach((r) => {
      existentesPorVendedor.set(r.id_vendedor, {
        TOPE: Number(r.tope || 0),
        SOBRE: Number(r.sobre || 0),
        BAJO: Number(r.bajo || 0),
        PLAN: Number(r.plan || 0),
        PV: Number(r.pv || 0),
      });
    });
  } catch (err) {
    console.warn("No se pudieron precargar montos:", err);
    fuenteActual = 'BASE';
  }
}

// ======================================================
// Render (mantiene formato + marca dirty)
// ======================================================
function marcarFilaDirty(tr) {
  tr.dataset.dirty = "1";
}

function render(vendedores) {
  tbody.innerHTML = "";

  if (!vendedores.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Sin vendedores</td></tr>`;
    ajustarStickyTop();
    recalcularTotales();
    return;
  }

  for (const v of vendedores) {
    const ex = existentesPorVendedor.get(v.id_vendedor) || {};
    const tr = document.createElement("tr");
    tr.dataset.idVendedor = v.id_vendedor;
    tr.dataset.dirty = "0";

    const tfVal  = (ex.TOPE + ex.SOBRE + ex.BAJO) || "";
    const g40Val = (ex.TOPE + ex.SOBRE) || "";
    const g70Val = ex.TOPE || "";
    const planVal= ex.PLAN || "";
    const pvRaw  = ex.PV || "";
    const contrato = contratosPorVendedor.get(v.id_vendedor) || "";

    tr.innerHTML = `
      <td class="cv-celda-vendedor" title="${escapeHtml(v.nombre)}"><span class="cv-vendedor">${escapeHtml(v.nombre)}</span></td>
      <td class="contrato-vendedor" title="${escapeHtml(contrato)}"><span class="cv-contrato">${escapeHtml(contrato)}</span></td>
      <td><input class="input-cierre" data-tipo="BAJO"  type="number" inputmode="numeric" min="0" max="199" step="1" value="${tfVal}"></td>
      <td><input class="input-cierre" data-tipo="SOBRE" type="number" inputmode="numeric" min="0" max="199" step="1" value="${g40Val}"></td>
      <td><input class="input-cierre" data-tipo="TOPE"  type="number" inputmode="numeric" min="0" max="199" step="1" value="${g70Val}"></td>
      <td><input class="input-cierre" data-tipo="PLAN"  type="number" inputmode="numeric" min="0" max="199" step="1" value="${planVal}"></td>
      <td><input class="input-cierre-pv" data-tipo="PV" type="text" inputmode="numeric" maxlength="11" autocomplete="off" spellcheck="false"></td>
    `;

    const pvInp = tr.querySelector('input[data-tipo="PV"]');
    setPVValue(pvInp, pvRaw);

    tr.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", () => {
        if (inp.dataset.tipo === "PV") {
          formatearPVEnVivo(inp);
        } else {
          limitarInputCierreA199(inp);
        }
        marcarFilaDirty(tr);
        recalcularTotales();
      });
      inp.addEventListener("change", () => {
        if (inp.dataset.tipo === "PV") {
          formatearPVEnVivo(inp);
        } else {
          limitarInputCierreA199(inp);
        }
        marcarFilaDirty(tr);
        recalcularTotales();
      });
    });

    tbody.appendChild(tr);
  }

  ajustarStickyTop();
  recalcularTotales();
}

// ======================================================
// Guardado vía RPC BATCH
// - Solo vendedores dirty
// - Para cada dirty: manda los 5 tipos (incluye ceros)
// ======================================================
function construirTramosDesdeAcumulados(tfInput, g40Input, g70Input) {
  // Coherencia: TF >= >40 >= >70 (clamp basado en inputs del usuario)
  const tope = Math.max(g70Input, 0);
  const sobreAcum = Math.max(g40Input, tope);
  const tfAcum = Math.max(tfInput, sobreAcum);

  return {
    TOPE: tope,
    SOBRE: Math.max(sobreAcum - tope, 0),
    BAJO: Math.max(tfAcum - sobreAcum, 0),
  };
}

async function guardarTodo() {
  if (rolActual !== "supervisor") {
    alert("Este módulo es solo para supervisores.");
    return;
  }

  if (!idEquipo) {
    alert("No hay equipo seleccionado.");
    return;
  }

  const { mes, anio } = obtenerPeriodoSeguro();
  const filas = [...tbody.querySelectorAll("tr[data-id-vendedor]")];

  if (!filas.length) {
    alert("No hay vendedores para guardar.");
    return;
  }

  // Snapshot completo por vendedor (lo que espera el wrapper en DB)
  const ventas = [];

  for (const tr of filas) {
    const idVendedor = tr.dataset.idVendedor;

    // En la UI, estos 3 inputs están en formato ACUMULADO:
    // - BAJO  = TF acumulado (TOPE + SOBRE + BAJO)
    // - SOBRE = >40 acumulado (TOPE + SOBRE)
    // - TOPE  = >70 acumulado (TOPE)
    const tf  = numOrZero(tr.querySelector('input[data-tipo="BAJO"]')?.value);
    const g40 = numOrZero(tr.querySelector('input[data-tipo="SOBRE"]')?.value);
    const g70 = numOrZero(tr.querySelector('input[data-tipo="TOPE"]')?.value);

    const plan = numOrZero(tr.querySelector('input[data-tipo="PLAN"]')?.value);
    const pvInp = tr.querySelector('input[data-tipo="PV"]');
    const pv   = numOrZero(pvInp?.dataset?.raw ?? pvInp?.value);

    const tramos = construirTramosDesdeAcumulados(tf, g40, g70);

    ventas.push({
      id_vendedor: idVendedor,
      tope: tramos.TOPE,
      sobre: tramos.SOBRE,
      bajo: tramos.BAJO,
      plan,
      pv,
    });
  }

  btnGuardarCierre.disabled = true;
  const txt = btnGuardarCierre.textContent;
  btnGuardarCierre.textContent = "Guardando…";

  try {
    const { error } = await supabase.rpc("guardar_cierre_mensual_batch", {
      p_id_equipo: idEquipo,
      p_anio: anio,
      p_mes: mes,
      p_ventas: ventas,
    });

    if (error) throw error;

    alert("Cierre mensual guardado correctamente.");

    // recarga y limpia dirty
    await cargarCierre();
  } catch (err) {
    console.error("Error guardando cierre mensual:", err);
    alert("No se pudo guardar el cierre mensual. Revisa la consola.");
  } finally {
    btnGuardarCierre.disabled = false;
    btnGuardarCierre.textContent = txt;
  }
}



function aplicarLayoutContratoCierre() {
  const styleId = "av-cierre-contrato-layout";
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }

  style.textContent = `
    #modulo-cierre-ventas #tablaCierreHead col.col-vendedor,
    #modulo-cierre-ventas #tablaCierre col.col-vendedor{ width: 270px !important; }
    #modulo-cierre-ventas #tablaCierreHead col.col-contrato,
    #modulo-cierre-ventas #tablaCierre col.col-contrato{ width: 78px !important; }
    #modulo-cierre-ventas #tablaCierreHead col.col-tf,
    #modulo-cierre-ventas #tablaCierre col.col-tf{ width: 86px !important; }
    #modulo-cierre-ventas #tablaCierreHead col.col-g40,
    #modulo-cierre-ventas #tablaCierre col.col-g40{ width: 86px !important; }
    #modulo-cierre-ventas #tablaCierreHead col.col-g70,
    #modulo-cierre-ventas #tablaCierre col.col-g70{ width: 86px !important; }
    #modulo-cierre-ventas #tablaCierreHead col.col-plan,
    #modulo-cierre-ventas #tablaCierre col.col-plan{ width: 86px !important; }
    #modulo-cierre-ventas #tablaCierreHead col.col-pv,
    #modulo-cierre-ventas #tablaCierre col.col-pv{ width: 170px !important; }
    #modulo-cierre-ventas .cv-celda-vendedor,
    #modulo-cierre-ventas .cv-vendedor,
    #modulo-cierre-ventas .contrato-vendedor,
    #modulo-cierre-ventas .cv-contrato{
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #modulo-cierre-ventas .cv-contrato{
      display:block;
      max-width:100%;
    }

    #modulo-cierre-ventas #tablaCierre tbody td.cv-celda-vendedor{
      display: table-cell !important;
      text-align: left !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      background-color: inherit !important;
      background-image: none !important;
      box-shadow: none !important;
    }

    #modulo-cierre-ventas #tablaCierre tbody td.cv-celda-vendedor .cv-vendedor{
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    #modulo-cierre-ventas #tablaCierre tbody tr:nth-child(odd) td{
      background-color: #ffffff !important;
    }

    #modulo-cierre-ventas #tablaCierre tbody tr:nth-child(even) td{
      background-color: #f3f7fb !important;
    }

    #modulo-cierre-ventas #tablaCierre tbody tr:hover td{
      background-color: #eef6ff !important;
    }
  `;
}

// ======================================================
// Carga principal
// ======================================================
async function cargarCierre() {
  try {
    idEquipo = leerEquipoActivo();
    if (!idEquipo) return;

    const { mes, anio } = obtenerPeriodoSeguro();

    const vendedores = await obtenerVendedoresDelMes(idEquipo, anio, mes);
    await obtenerContratosPorVendedor(idEquipo, anio, mes, vendedores);
    await obtenerMontosExistentes(idEquipo, anio, mes);
    if (btnGuardarCierre) btnGuardarCierre.title = `Fuente carga: ${fuenteActual}`;
    render(vendedores);
    aplicarLayoutContratoCierre();
    aplicarLayoutColumnasCierre();
    aplicarLayoutScrollCierre();
  } catch (err) {
    console.error("Error cargando cierre mensual:", err);
    tbody.innerHTML = `<tr><td colspan="7">Error cargando datos</td></tr>`;
  }
}

// ======================================================
// INIT
// ======================================================
(async function init() {
  const ok = await esperarDOM();
  if (!ok) return;

  setearDefaultsMesAnio();

  aplicarLayoutContratoCierre();
  aplicarLayoutColumnasCierre();
  aplicarLayoutScrollCierre();
  ajustarStickyTop();
  recalcularTotales();

  btnGuardarCierre.addEventListener("click", guardarTodo);
  selectMes.addEventListener("change", cargarCierre);
  selectAnio.addEventListener("change", cargarCierre);

  await cargarCierre();
})();

try { aplicarLayoutColumnasCierre(); } catch(_) {}
try { aplicarLayoutScrollCierre(); } catch(_) {}
try { avSetScrollbarWidthVar(); } catch(_) {}
try { avSyncCierreVentasHeadWidths(); } catch(_) {}

window.addEventListener("resize", () => {
  try { aplicarLayoutColumnasCierre(); } catch(_) {}
  try { aplicarLayoutScrollCierre(); } catch(_) {}
  try { avSetScrollbarWidthVar(); } catch(_) {}
  try { avSyncCierreVentasHeadWidths(); } catch(_) {}
});

// Re-sincroniza cuando cambia el tamaño del scroller (por layout, fonts, etc.)
try {
  const root = document.querySelector("#modulo-cierre-ventas");
  const scroller = root?.querySelector(".contenedor-tabla");
  if (scroller && window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      try { aplicarLayoutColumnasCierre(); } catch(_) {}
      try { avSetScrollbarWidthVar(); } catch(_) {}
      try { avSyncCierreVentasHeadWidths(); } catch(_) {}
    });
    ro.observe(scroller);
  }
} catch(_) {}
