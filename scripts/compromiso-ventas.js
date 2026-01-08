// scripts/compromiso-ventas.js
// - Opción 2: SheetJS dinámico (sin tocar HTML)
// - Ventas diarias SIEMPRE se renderiza (aunque esté en blanco)
// - Panel 2 columnas: Compromisos (Lu..Vi) + Ventas (Lu..Do) con scroll en ventas y sync de días
// - Export Excel: UNA hoja por vendedor, con ambas tablas en la MISMA hoja, formateadas

if (!window.supabase) throw new Error("Supabase no inicializado en window");
const supabase = window.supabase;

// ============================================================
// DOM (con fallback de IDs para no “romper” si cambiaste HTML)
// ============================================================
const $ = (id) => document.getElementById(id);

const elSemana =
  $("selectSemana") ||
  $("inputSemana") ||
  $("semana") ||
  $("week") ||
  document.querySelector('input[type="week"]');

const elRango = $("labelRango") || $("rangoSemana") || $("rango");
const elReporte = $("contenedorReporte") || $("contenedorReporteCV") || $("reporte") || $("contenedor");
const elCarga = $("estadoCarga") || $("statusCarga") || $("lblEstado");

// ✅ Enterprise-grade: el botón "Volver" del reporte NO debe usar id="btnVolver"
// para no disparar el delegado global del supervisor. Solo aceptamos el botón propio
// del submódulo o un data-attr explícito.
const btnVolver =
  $("btnVolverReporteCV") ||
  document.querySelector("[data-volver-reportes]");

const btnExcel =
  $("btnExcel") ||
  $("btnExcelReporte") ||
  document.querySelector("[data-export-excel]");

let DATASET = null;

// ============================================================
// SheetJS (XLSX) loader (opción 2: dinámico)
// ============================================================
async function asegurarXLSX() {
  if (window.XLSX) return true;

  if (window.__xlsx_loading_promise) {
    await window.__xlsx_loading_promise;
    return !!window.XLSX;
  }

  window.__xlsx_loading_promise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error("No se pudo cargar XLSX (SheetJS)."));
    document.head.appendChild(s);
  });

  try {
    await window.__xlsx_loading_promise;
  } finally {
    window.__xlsx_loading_promise = null;
  }

  return !!window.XLSX;
}

// ============================================================
// Helpers fecha
// ============================================================
function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function startOfISOWeek(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay(); // 0..6
  const monday = new Date(simple);
  const diff = dow <= 4 ? 1 - dow : 8 - dow;
  monday.setDate(simple.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function semanaDefaultISOWeekInput() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const yyyy = d.getUTCFullYear();
  return `${yyyy}-W${String(weekNo).padStart(2, "0")}`;
}
function parseWeekInput(weekStr) {
  const raw = String(weekStr || "").trim();
  const m = raw.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) throw new Error("Semana inválida (formato esperado: YYYY-Www)");
  const year = Number(m[1]);
  const week = Number(m[2]);
  const lunes = startOfISOWeek(year, week);
  const domingo = addDays(lunes, 6);
  const viernes = addDays(lunes, 4);
  return { year, week, lunes, viernes, domingo };
}
function setRangoLabel(semana) {
  const fmt = (d) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}-${mm}-${yy}`;
  };
  if (elRango) elRango.textContent = `${fmt(semana.lunes)} a ${fmt(semana.domingo)}`;
}

// ============================================================
// UI helpers
// ============================================================
function estado(msg, esError = false) {
  if (!elCarga) return;
  elCarga.textContent = msg || "";
  elCarga.style.color = esError ? "#b00020" : "";
}
function formatCLP(n) {
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("es-CL");
}
function normTipo(txt) {
  return String(txt || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function labelTipoVenta(tipoVenta) {
  const n = normTipo(tipoVenta);
  if (n.includes("tope")) return "Tope";
  if (n.includes("sobre")) return "Sobre";
  if (n.includes("bajo")) return "Bajo";
  if (n.includes("plan")) return "Plan";
  if (n === "pv" || n.includes("pv") || n.includes("saldo")) return "Saldo PV";
  const raw = String(tipoVenta || "").trim();
  return raw ? raw.toUpperCase() : "";
}

// Días y filas
const DIAS_SHORT = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const TIPOS_VENTA = ["Tope", "Sobre", "Bajo", "Plan", "Saldo PV"];

// ============================================================
// Contexto supervisor/equipo
// ============================================================
function getSupervisorId() {
  if (window.idSupervisorActivo) return window.idSupervisorActivo;
  const keys = ["idSupervisorActivo", "supervisor_id", "id_supervisor", "appventas_supervisor_id", "SUPERVISOR_ID"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}
function getEquipoIdActual() {
  const sel = document.getElementById("selectEquipo");
  if (sel && sel.value) return sel.value;

  const keys = ["idEquipoActivo", "equipo_id", "id_equipo", "appventas_equipo_id", "EQUIPO_ID"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

// ============================================================
// Fetchs
// ============================================================
async function fetchTiposCompromisos(supervisorId) {
  const { data, error } = await supabase
    .from("tipos_compromisos")
    .select("id, descripcion, orden")
    .eq("supervisor_id", supervisorId)
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) throw new Error(`Error tipos_compromisos: ${error.message}`);
  return data || [];
}

async function fetchEquipoVendedorTramos(equipoId) {
  const { data, error } = await supabase
    .from("equipo_vendedor")
    .select("id_vendedor, id_equipo, fecha_inicio, fecha_fin, estado")
    .eq("id_equipo", equipoId);

  if (error) throw new Error(`Error equipo_vendedor: ${error.message}`);
  return data || [];
}

function tramosVigentesEnSemana(tramos, lunesISO, domingoISO) {
  const ids = new Set();
  const map = new Map();

  for (const t of tramos || []) {
    if (!t?.id_vendedor) continue;
    if (t.estado === false) continue;

    const fi = t.fecha_inicio ? String(t.fecha_inicio).slice(0, 10) : null;
    const ff = t.fecha_fin ? String(t.fecha_fin).slice(0, 10) : null;

    if (fi && fi > domingoISO) continue;
    if (ff && ff < lunesISO) continue;

    ids.add(t.id_vendedor);
    if (!map.has(t.id_vendedor)) map.set(t.id_vendedor, []);
    map.get(t.id_vendedor).push({ fi: fi || "0000-01-01", ff: ff || "9999-12-31" });
  }

  return { vendorIds: ids, tramosPorVendedor: map };
}

async function fetchVendedoresPorIds(vendorIds) {
  if (!vendorIds.length) return [];
  const { data, error } = await supabase
    .from("vendedores")
    .select("id_vendedor, nombre")
    .in("id_vendedor", vendorIds);

  if (error) throw new Error(`Error vendedores: ${error.message}`);

  return (data || [])
    .map((v) => ({ id: v.id_vendedor, nombre: v.nombre || "" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

async function fetchGestion(equipoId, supervisorId, lunesISO, viernesISO) {
  const { data, error } = await supabase
    .from("compromisos")
    .select("id_vendedor, id_tipo, fecha_compromiso, monto_comprometido")
    .eq("id_equipo", equipoId)
    .eq("id_supervisor", supervisorId)
    .gte("fecha_compromiso", lunesISO)
    .lte("fecha_compromiso", viernesISO);

  if (error) throw new Error(`Error compromisos: ${error.message}`);
  return data || [];
}

async function fetchVentas(vendorIds, lunesISO, domingoISO) {
  if (!vendorIds.length) return [];
  const { data, error } = await supabase
    .from("ventas")
    .select("id_vendedor, fecha_venta, monto, tipo_venta")
    .in("id_vendedor", vendorIds)
    .gte("fecha_venta", lunesISO)
    .lte("fecha_venta", domingoISO);

  if (error) throw new Error(`Error ventas: ${error.message}`);
  return data || [];
}

// ============================================================
// Indexado
// ============================================================
function buildGestionMap(rows) {
  const map = {};
  for (const r of rows || []) {
    const vid = r.id_vendedor;
    const tid = r.id_tipo;
    const f = String(r.fecha_compromiso).slice(0, 10);
    const m = Number(r.monto_comprometido || 0);

    map[vid] ??= {};
    map[vid][tid] ??= {};
    map[vid][tid][f] = (map[vid][tid][f] || 0) + m;
  }
  return map;
}

function buildVentasMap(rows, tramosPorVendedor) {
  const map = {};
  for (const r of rows || []) {
    const vid = r.id_vendedor;
    const f = String(r.fecha_venta).slice(0, 10);
    const m = Number(r.monto || 0);
    const tipo = labelTipoVenta(r.tipo_venta);

    const tramos = tramosPorVendedor.get(vid) || [];
    const ok = tramos.some((t) => t.fi <= f && f <= t.ff);
    if (!ok) continue;

    map[vid] ??= {};
    map[vid][f] ??= {};
    map[vid][f][tipo] = (map[vid][f][tipo] || 0) + m;
  }
  return map;
}

// ============================================================
// Render reporte (por vendedor, + / −)
// ============================================================
function renderReporte(ds) {
  if (!elReporte) return;

  elReporte.innerHTML = "";

  if (!ds.vendedores.length) {
    elReporte.innerHTML = `<div style="padding:10px 0;">Sin vendedores vigentes para el equipo/semana.</div>`;
    return;
  }

  for (const vend of ds.vendedores) {
    const bloque = document.createElement("div");
    bloque.style.padding = "8px 0";
    bloque.style.borderBottom = "1px solid rgba(0,0,0,0.06)";

    const fila = document.createElement("div");
    fila.style.display = "flex";
    fila.style.alignItems = "center";
    fila.style.gap = "10px";
    fila.style.cursor = "pointer";
    fila.style.userSelect = "none";

    const toggle = document.createElement("span");
    toggle.textContent = "+";
    toggle.style.fontWeight = "800";
    toggle.style.fontSize = "18px";
    toggle.style.width = "18px";
    toggle.style.display = "inline-block";
    toggle.style.textAlign = "center";

    const nombre = document.createElement("span");
    nombre.textContent = vend.nombre;

    fila.appendChild(toggle);
    fila.appendChild(nombre);

    const panel = document.createElement("div");
    panel.style.display = "none";
    panel.style.marginTop = "10px";
    panel.appendChild(buildPanel2Column(vend, ds));

    fila.addEventListener("click", () => {
      const abierto = panel.style.display !== "none";
      panel.style.display = abierto ? "none" : "block";
      toggle.textContent = abierto ? "+" : "−";
    });

    bloque.appendChild(fila);
    bloque.appendChild(panel);
    elReporte.appendChild(bloque);
  }
}

// ============================================================
// PANEL: 2 columnas
// - Compromisos (Lu..Vi) sin barra (pero se sincroniza por scroll de ventas)
// - Ventas (Lu..Do) con barra horizontal (la que manda)
// ============================================================
function buildPanel2Column(vend, ds) {
  const { tipos, semana, gestionMap, ventasMap } = ds;

  const fechas7 = Array.from({ length: 7 }, (_, i) => toISODate(addDays(semana.lunes, i))); // Lu..Do
  const fechas5 = fechas7.slice(0, 5); // Lu..Vi

  const S = {
    bgHeader: "#cfe3f7",
    border: "1px solid rgba(0,0,0,0.12)",
    fontSize: "12px",
    pad: "7px 10px",
    radius: "10px",
    shadow: "0 2px 8px rgba(0,0,0,0.06)",
    rowH: "36px",
    gap: "8px",
    labelCompW: 210,
    labelVentW: 120,
    dayMinW: 84,
    daysFrameW: 310,
  };

  const panel = document.createElement("div");
  panel.style.maxWidth = "100%";

  const headerRow = document.createElement("div");
  headerRow.style.display = "grid";
  headerRow.style.gridTemplateColumns = "minmax(0,1fr) minmax(0,1fr)";
  headerRow.style.gap = S.gap;
  headerRow.style.marginBottom = "6px";

  const t1 = document.createElement("div");
  t1.textContent = "Compromisos diarios";
  t1.style.fontWeight = "800";
  t1.style.textAlign = "center";

  const t2 = document.createElement("div");
  t2.textContent = "Ventas diarias";
  t2.style.fontWeight = "800";
  t2.style.textAlign = "center";

  headerRow.appendChild(t1);
  headerRow.appendChild(t2);
  panel.appendChild(headerRow);

  const blocks = document.createElement("div");
  blocks.style.display = "grid";
  blocks.style.gridTemplateColumns = "minmax(0,1fr) minmax(0,1fr)";
  blocks.style.gap = S.gap;
  blocks.style.alignItems = "start";
  blocks.style.maxWidth = "100%";

  const compBlock = document.createElement("div");
  compBlock.style.display = "flex";
  compBlock.style.alignItems = "flex-start";
  compBlock.style.gap = "0";

  const labelsComp = buildLabelTable({
    title: "Compromiso",
    rows: (tipos || []).map((tc) => tc.descripcion || ""),
    widthPx: S.labelCompW,
    S,
    wrap2Lines: true,
  });

  const compDaysFrame = document.createElement("div");
  compDaysFrame.style.width = `${S.daysFrameW}px`;
  compDaysFrame.style.maxWidth = "100%";
  compDaysFrame.style.overflowX = "hidden";
  compDaysFrame.style.overflowY = "hidden";
  compDaysFrame.style.marginLeft = "-1px";

  const compDaysInner = document.createElement("div");
  compDaysInner.style.width = "max-content";
  compDaysInner.appendChild(
    buildDaysTableCompromisos({
      tipos,
      fechas: fechas5,
      diasShort: DIAS_SHORT.slice(0, 5),
      vendId: vend.id,
      gestionMap,
      S,
    })
  );
  compDaysFrame.appendChild(compDaysInner);

  compBlock.appendChild(labelsComp);
  compBlock.appendChild(compDaysFrame);

  const ventBlock = document.createElement("div");
  ventBlock.style.display = "flex";
  ventBlock.style.alignItems = "flex-start";
  ventBlock.style.gap = "0";

  const labelsVent = buildLabelTable({
    title: "Tipo",
    rows: TIPOS_VENTA,
    widthPx: S.labelVentW,
    S,
    wrap2Lines: false,
  });

  const ventDaysFrame = document.createElement("div");
  ventDaysFrame.style.width = `${S.daysFrameW}px`;
  ventDaysFrame.style.maxWidth = "100%";
  ventDaysFrame.style.overflowX = "auto";
  ventDaysFrame.style.overflowY = "hidden";
  ventDaysFrame.style.marginLeft = "-1px";
  ventDaysFrame.style.paddingBottom = "6px";

  const ventDaysInner = document.createElement("div");
  ventDaysInner.style.width = "max-content";
  ventDaysInner.appendChild(
    buildDaysTableVentas({
      fechas: fechas7,
      diasShort: DIAS_SHORT,
      vendId: vend.id,
      ventasMap,
      S,
    })
  );
  ventDaysFrame.appendChild(ventDaysInner);

  ventBlock.appendChild(labelsVent);
  ventBlock.appendChild(ventDaysFrame);

  blocks.appendChild(compBlock);
  blocks.appendChild(ventBlock);
  panel.appendChild(blocks);

  let lock = false;
  ventDaysFrame.addEventListener("scroll", () => {
    if (lock) return;
    lock = true;
    compDaysFrame.scrollLeft = ventDaysFrame.scrollLeft;
    lock = false;
  });

  return panel;

  function buildLabelTable({ title, rows, widthPx, S, wrap2Lines }) {
    const tbl = document.createElement("table");
    tbl.style.borderCollapse = "separate";
    tbl.style.borderSpacing = "0";
    tbl.style.width = `${widthPx}px`;
    tbl.style.fontSize = S.fontSize;
    tbl.style.boxShadow = S.shadow;
    tbl.style.borderRadius = S.radius;
    tbl.style.overflow = "hidden";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = title;
    th.style.background = S.bgHeader;
    th.style.border = S.border;
    th.style.padding = S.pad;
    th.style.textAlign = "left";
    th.style.whiteSpace = "nowrap";
    th.style.height = S.rowH;
    th.style.boxSizing = "border-box";
    trh.appendChild(th);
    thead.appendChild(trh);

    const tbody = document.createElement("tbody");
    rows.forEach((txt, idx) => {
      const tr = document.createElement("tr");
      tr.style.background = idx % 2 ? "rgba(255,255,255,0.65)" : "white";
      const td = document.createElement("td");
      td.textContent = txt;
      td.style.border = S.border;
      td.style.padding = S.pad;
      td.style.textAlign = "left";
      td.style.verticalAlign = "middle";
      td.style.height = S.rowH;
      td.style.boxSizing = "border-box";

      if (wrap2Lines) {
        td.style.whiteSpace = "normal";
        td.style.wordBreak = "break-word";
        td.style.lineHeight = "1.15";
        td.style.display = "-webkit-box";
        td.style.webkitBoxOrient = "vertical";
        td.style.webkitLineClamp = "2";
        td.style.overflow = "hidden";
      } else {
        td.style.whiteSpace = "nowrap";
      }

      tr.appendChild(td);
      tbody.appendChild(tr);
    });

    tbl.appendChild(thead);
    tbl.appendChild(tbody);
    return tbl;
  }

  function buildDaysTableCompromisos({ tipos, fechas, diasShort, vendId, gestionMap, S }) {
    const tbl = document.createElement("table");
    tbl.style.borderCollapse = "separate";
    tbl.style.borderSpacing = "0";
    tbl.style.fontSize = S.fontSize;
    tbl.style.tableLayout = "auto";
    tbl.style.boxShadow = S.shadow;
    tbl.style.borderRadius = S.radius;
    tbl.style.overflow = "hidden";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    for (let d = 0; d < fechas.length; d++) {
      const th = document.createElement("th");
      th.textContent = diasShort[d];
      th.style.background = S.bgHeader;
      th.style.border = S.border;
      th.style.padding = S.pad;
      th.style.textAlign = "center";
      th.style.whiteSpace = "nowrap";
      th.style.height = S.rowH;
      th.style.boxSizing = "border-box";
      th.style.minWidth = `${S.dayMinW}px`;
      trh.appendChild(th);
    }
    thead.appendChild(trh);

    const tbody = document.createElement("tbody");
    (tipos || []).forEach((tc, idx) => {
      const tr = document.createElement("tr");
      tr.style.background = idx % 2 ? "rgba(255,255,255,0.65)" : "white";

      for (let d = 0; d < fechas.length; d++) {
        const f = fechas[d];
        const val = gestionMap[vendId]?.[tc.id]?.[f] ?? null;

        const td = document.createElement("td");
        td.textContent = val === null ? "" : formatCLP(val);
        td.style.border = S.border;
        td.style.padding = S.pad;
        td.style.textAlign = "right";
        td.style.whiteSpace = "nowrap";
        td.style.height = S.rowH;
        td.style.boxSizing = "border-box";
        td.style.minWidth = `${S.dayMinW}px`;
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    tbl.appendChild(thead);
    tbl.appendChild(tbody);
    return tbl;
  }

  function buildDaysTableVentas({ fechas, diasShort, vendId, ventasMap, S }) {
    const tbl = document.createElement("table");
    tbl.style.borderCollapse = "separate";
    tbl.style.borderSpacing = "0";
    tbl.style.fontSize = S.fontSize;
    tbl.style.tableLayout = "auto";
    tbl.style.boxShadow = S.shadow;
    tbl.style.borderRadius = S.radius;
    tbl.style.overflow = "hidden";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    for (let d = 0; d < fechas.length; d++) {
      const th = document.createElement("th");
      th.textContent = diasShort[d];
      th.style.background = S.bgHeader;
      th.style.border = S.border;
      th.style.padding = S.pad;
      th.style.textAlign = "center";
      th.style.whiteSpace = "nowrap";
      th.style.height = S.rowH;
      th.style.boxSizing = "border-box";
      th.style.minWidth = `${S.dayMinW}px`;
      trh.appendChild(th);
    }
    thead.appendChild(trh);

    const tbody = document.createElement("tbody");
    TIPOS_VENTA.forEach((tv, idx) => {
      const tr = document.createElement("tr");
      tr.style.background = idx % 2 ? "rgba(255,255,255,0.65)" : "white";

      for (let d = 0; d < fechas.length; d++) {
        const f = fechas[d];
        const monto = ventasMap[vendId]?.[f]?.[tv] ?? null;

        const td = document.createElement("td");
        td.textContent = monto === null ? "" : formatCLP(monto);
        td.style.border = S.border;
        td.style.padding = S.pad;
        td.style.textAlign = "right";
        td.style.whiteSpace = "nowrap";
        td.style.height = S.rowH;
        td.style.boxSizing = "border-box";
        td.style.minWidth = `${S.dayMinW}px`;
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    tbl.appendChild(thead);
    tbl.appendChild(tbody);
    return tbl;
  }
}

// ============================================================
// Excel export (UNA hoja por vendedor, ambas tablas en la misma hoja)
// ============================================================
function safeSheetName(name) {
  const s = String(name || "Vendedor")
    .replace(/[\\/?*\[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (s || "Vendedor").slice(0, 31);
}

function exportarExcel(ds) {
  if (!window.XLSX) {
    alert("No se cargó XLSX (SheetJS).");
    return;
  }
  const XLSX = window.XLSX;

  const { vendedores, tipos, semana, gestionMap, ventasMap } = ds;

  const fechas7 = Array.from({ length: 7 }, (_, i) => toISODate(addDays(semana.lunes, i)));
  const fechas5 = fechas7.slice(0, 5);

  const wb = XLSX.utils.book_new();

  const ST = {
    title: {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "center", vertical: "center" },
    },
    subTitle: {
      font: { bold: true, sz: 12 },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: "CFE3F7" } },
    },
    header: {
      font: { bold: true, sz: 11 },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: "CFE3F7" } },
    },
    leftHeader: {
      font: { bold: true, sz: 11 },
      alignment: { horizontal: "left", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: "CFE3F7" } },
    },
    cellText: {
      font: { sz: 11 },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
    },
    cellNum: {
      font: { sz: 11 },
      alignment: { horizontal: "right", vertical: "center" },
      numFmt: "#,##0",
    },
    borderAll: {
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    },
  };

  function setCell(ws, addr, v, s) {
    ws[addr] = ws[addr] || { t: "s", v: "" };
    ws[addr].v = v;
    if (typeof v === "number") ws[addr].t = "n";
    else ws[addr].t = "s";
    if (s) ws[addr].s = s;
  }

  function applyBorder(ws, rangeA1) {
    const r = XLSX.utils.decode_range(rangeA1);
    for (let R = r.s.r; R <= r.e.r; R++) {
      for (let C = r.s.c; C <= r.e.c; C++) {
        const a = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[a]) ws[a] = { t: "s", v: "" };
        ws[a].s = ws[a].s || {};
        ws[a].s.border = ST.borderAll.border;
      }
    }
  }

  for (const v of vendedores) {
    const aoa = [];
    aoa.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);

    const rowsData = Math.max((tipos || []).length, TIPOS_VENTA.length);
    for (let i = 0; i < rowsData; i++) aoa.push(new Array(15).fill(""));

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws["!cols"] = [
      { wch: 28 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 3 },
      { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];

    const title = (v.nombre || "Vendedor").toUpperCase();
    setCell(ws, "A1", title, ST.title);
    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } });

    setCell(ws, "A2", "Compromisos diarios", ST.subTitle);
    ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });

    setCell(ws, "H2", "Ventas diarias", ST.subTitle);
    ws["!merges"].push({ s: { r: 1, c: 7 }, e: { r: 1, c: 14 } });

    setCell(ws, "A3", "Compromiso", { ...ST.leftHeader, ...ST.borderAll });
    ["Lu", "Ma", "Mi", "Ju", "Vi"].forEach((d, i) => {
      const col = String.fromCharCode("B".charCodeAt(0) + i);
      setCell(ws, `${col}3`, d, { ...ST.header, ...ST.borderAll });
    });

    setCell(ws, "H3", "Tipo", { ...ST.leftHeader, ...ST.borderAll });
    ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].forEach((d, i) => {
      const col = String.fromCharCode("I".charCodeAt(0) + i);
      setCell(ws, `${col}3`, d, { ...ST.header, ...ST.borderAll });
    });

    const baseRow = 4;

    for (let i = 0; i < (tipos || []).length; i++) {
      const tc = tipos[i];
      const r = baseRow + i;

      setCell(ws, `A${r}`, tc.descripcion || "", { ...ST.cellText, ...ST.borderAll });

      for (let d = 0; d < 5; d++) {
        const f = fechas5[d];
        const val = gestionMap[v.id]?.[tc.id]?.[f] ?? "";
        const col = String.fromCharCode("B".charCodeAt(0) + d);
        setCell(ws, `${col}${r}`, val === "" ? "" : Number(val), { ...ST.cellNum, ...ST.borderAll });
      }
    }

    for (let i = 0; i < TIPOS_VENTA.length; i++) {
      const tv = TIPOS_VENTA[i];
      const r = baseRow + i;

      setCell(ws, `H${r}`, tv, { ...ST.cellText, ...ST.borderAll });

      for (let d = 0; d < 7; d++) {
        const f = fechas7[d];
        const monto = ventasMap[v.id]?.[f]?.[tv] ?? "";
        const col = String.fromCharCode("I".charCodeAt(0) + d);
        setCell(ws, `${col}${r}`, monto === "" ? "" : Number(monto), { ...ST.cellNum, ...ST.borderAll });
      }
    }

    const lastRow = baseRow + rowsData - 1;
    applyBorder(ws, `A3:F${lastRow}`);
    applyBorder(ws, `H3:O${lastRow}`);

    ws["!ref"] = `A1:O${lastRow}`;

    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(v.nombre));
  }

  XLSX.writeFile(wb, `compromiso-ventas_${toISODate(semana.lunes)}_${toISODate(semana.domingo)}.xlsx`);
}

// ============================================================
// Core
// ============================================================
async function cargarDataset() {
  const supervisorId = getSupervisorId();
  if (!supervisorId) throw new Error("No se encontró supervisor_id (sesión).");

  const equipoId = getEquipoIdActual();
  if (!equipoId) throw new Error("No se encontró equipo activo.");

  const weekValue = (elSemana && elSemana.value) ? elSemana.value : semanaDefaultISOWeekInput();
  const semana = parseWeekInput(weekValue);

  setRangoLabel(semana);

  const lunesISO = toISODate(semana.lunes);
  const viernesISO = toISODate(semana.viernes);
  const domingoISO = toISODate(semana.domingo);

  estado("Cargando datos…");

  const tramos = await fetchEquipoVendedorTramos(equipoId);
  const { vendorIds, tramosPorVendedor } = tramosVigentesEnSemana(tramos, lunesISO, domingoISO);
  const vendorList = Array.from(vendorIds);

  const [tipos, vendedores, compromisos, ventas] = await Promise.all([
    fetchTiposCompromisos(supervisorId),
    fetchVendedoresPorIds(vendorList),
    fetchGestion(equipoId, supervisorId, lunesISO, viernesISO),
    fetchVentas(vendorList, lunesISO, domingoISO),
  ]);

  return {
    supervisorId,
    equipoId,
    semana,
    vendedores,
    tipos,
    gestionMap: buildGestionMap(compromisos),
    ventasMap: buildVentasMap(ventas, tramosPorVendedor),
  };
}

async function refrescar() {
  try {
    DATASET = null;
    if (elReporte) elReporte.innerHTML = "";

    if (elSemana && !elSemana.value) elSemana.value = semanaDefaultISOWeekInput();

    const ds = await cargarDataset();
    DATASET = ds;
    renderReporte(ds);
    estado("");
  } catch (e) {
    console.error(e);
    estado(`Error: ${e?.message || e}`, true);
  }
}

// ============================================================
// Eventos
// ============================================================
btnVolver?.addEventListener("click", (e) => {
  e?.preventDefault?.();
  window.dispatchEvent(new Event("reportes:volver"));
});

btnExcel?.addEventListener("click", async () => {
  if (!DATASET) return;
  try {
    await asegurarXLSX();
    exportarExcel(DATASET);
  } catch (e) {
    alert(e?.message || String(e));
  }
});

elSemana?.addEventListener("change", refrescar);

(function bindEquipoSupervisor() {
  const sel = document.getElementById("selectEquipo");
  if (!sel) return;
  if (window.__cv_equipo_listener_bound) return;
  window.__cv_equipo_listener_bound = true;
  sel.addEventListener("change", refrescar);
})();

(function init() {
  if (elSemana && !elSemana.value) elSemana.value = semanaDefaultISOWeekInput();
  refrescar();
})();
