
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Sin vendedores</td></tr>`;
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

    tr.innerHTML = `
      <td class="nombre-vendedor" title="${escapeHtml(v.nombre)}"><span class="cv-vendedor">${escapeHtml(v.nombre)}</span></td>
      <td><input class="input-cierre" data-tipo="BAJO"  type="number" inputmode="numeric" min="0" step="1" value="${tfVal}"></td>
      <td><input class="input-cierre" data-tipo="SOBRE" type="number" inputmode="numeric" min="0" step="1" value="${g40Val}"></td>
      <td><input class="input-cierre" data-tipo="TOPE"  type="number" inputmode="numeric" min="0" step="1" value="${g70Val}"></td>
      <td><input class="input-cierre" data-tipo="PLAN"  type="number" inputmode="numeric" min="0" step="1" value="${planVal}"></td>
      <td><input class="input-cierre-pv" data-tipo="PV" type="text" inputmode="numeric" autocomplete="off" spellcheck="false"></td>
    `;

    const pvInp = tr.querySelector('input[data-tipo="PV"]');
    setPVValue(pvInp, pvRaw);

    tr.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", () => {
        if (inp.dataset.tipo === "PV") formatearPVEnVivo(inp);
        marcarFilaDirty(tr);
        recalcularTotales();
      });
      inp.addEventListener("change", () => {
        if (inp.dataset.tipo === "PV") formatearPVEnVivo(inp);
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

  window.addEventListener('resize', () => {
    ajustarStickyTop();
  });
  } catch (err) {
    console.error("Error guardando cierre mensual:", err);
    alert("No se pudo guardar el cierre mensual. Revisa la consola.");
  } finally {
    btnGuardarCierre.disabled = false;
    btnGuardarCierre.textContent = txt;
  }
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
    await obtenerMontosExistentes(idEquipo, anio, mes);
    if (btnGuardarCierre) btnGuardarCierre.title = `Fuente carga: ${fuenteActual}`;
    render(vendedores);
  } catch (err) {
    console.error("Error cargando cierre mensual:", err);
    tbody.innerHTML = `<tr><td colspan="6">Error cargando datos</td></tr>`;
  }
}

// ======================================================
// INIT
// ======================================================
(async function init() {
  const ok = await esperarDOM();
  if (!ok) return;

  setearDefaultsMesAnio();

  aislarScrollSoloEnTabla();
  ajustarStickyTop();
  recalcularTotales();

  btnGuardarCierre.addEventListener("click", guardarTodo);
  selectMes.addEventListener("change", cargarCierre);
  selectAnio.addEventListener("change", cargarCierre);

  await cargarCierre();

  window.addEventListener('resize', () => {
    ajustarStickyTop();
  });
})();

try { avSetScrollbarWidthVar(); } catch(_) {}
  try { avSyncCierreVentasHeadWidths(); } catch(_) {}

window.addEventListener("resize", () => { try { avSetScrollbarWidthVar(); } catch(_) {}
  try { avSyncCierreVentasHeadWidths(); } catch(_) {} });

// Re-sincroniza cuando cambia el tamaño del scroller (por layout, fonts, etc.)
try {
  const root = document.querySelector("#modulo-cierre-ventas");
  const scroller = root?.querySelector(".contenedor-tabla");
  if (scroller && window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      try { avSetScrollbarWidthVar(); } catch(_) {}
      try { avSyncCierreVentasHeadWidths(); } catch(_) {}
    });
    ro.observe(scroller);
  }
} catch(_) {}
