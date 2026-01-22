// ================================
// COMPROMISOS.JS - PANEL DE COMPROMISOS
// Consolidado semanal por vendedor + detalle expandible tipo Excel
// ================================

import { supabase } from "../config.js";

function ordenarTipos(a, b) {
  const oa = a?.orden ?? 999;
  const ob = b?.orden ?? 999;
  if (oa !== ob) return oa - ob;
  return String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es");
}

let ultimoEquipoActivo = localStorage.getItem("idEquipoActivo");

// =========================
// UTILIDADES DE FECHA
// =========================
function formatoFechaLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rangoSemanaDesdeFecha(fechaISO) {
  const base = new Date(fechaISO + "T00:00:00");
  const d = base.getDay(); // 0 dom .. 6 sab
  const offset = d === 0 ? -6 : 1 - d; // lunes como inicio

  const inicio = new Date(base);
  inicio.setDate(inicio.getDate() + offset);

  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);

  return {
    inicioISO: formatoFechaLocal(inicio),
    finISO: formatoFechaLocal(fin),
  };
}

function nombreDiaSemanaDesdeDate(dateObj) {
  const dias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  return dias[dateObj.getDay()];
}

function esDiaHabilISO(fechaISO) {
  const d = new Date(fechaISO + "T00:00:00");
  const dow = d.getDay();
  return dow >= 1 && dow <= 5;
}

function normalizarFechaHabilISO(fechaISO) {
  const d = new Date(fechaISO + "T00:00:00");
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() - 1); // sab -> vie
  else if (dow === 0) d.setDate(d.getDate() - 2); // dom -> vie
  return formatoFechaLocal(d);
}

function obtenerDiaHabilAnterior(fechaISO) {
  const d = new Date(fechaISO + "T00:00:00");
  const dow = d.getDay();
  let delta;

  if (dow === 1) delta = -3; // lunes -> viernes
  else if (dow === 0) delta = -2; // domingo -> viernes
  else if (dow === 6) delta = -1; // sábado -> viernes
  else delta = -1; // mar-vie -> día anterior

  d.setDate(d.getDate() + delta);
  return formatoFechaLocal(d);
}

function moverDiaHabil(fechaISO, desplazamiento) {
  let d = new Date(fechaISO + "T00:00:00");
  let pasos = Math.abs(desplazamiento);
  const dir = desplazamiento >= 0 ? 1 : -1;

  while (pasos > 0) {
    d.setDate(d.getDate() + dir);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) pasos--;
  }
  return formatoFechaLocal(d);
}

function ddmmDesdeISO(fechaISO) {
  const [y, m, d] = String(fechaISO || "").split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}`;
}

// =========================
// FERIADOS (UI ONLY, sin bloquear edición ni guardado)
// =========================
let feriadosSemanaMap = new Map(); // key fechaISO => {nombre, irrenunciable}

async function cargarFeriadosSemana(inicioISO, finISO) {
  feriadosSemanaMap = new Map();
  if (!inicioISO || !finISO) return;

  try {
    const { data, error } = await supabase
      .from("feriados")
      .select("fecha, nombre, irrenunciable")
      .gte("fecha", inicioISO)
      .lte("fecha", finISO);

    if (error) {
      console.warn("⚠️ No se pudieron cargar feriados (tabla feriados):", error);
      return;
    }

    (data || []).forEach((f) => {
      const fecha = String(f.fecha || "");
      if (!fecha) return;
      feriadosSemanaMap.set(fecha, {
        nombre: String(f.nombre || "Feriado"),
        irrenunciable: f.irrenunciable === true,
      });
    });
  } catch (e) {
    console.warn("⚠️ Error inesperado cargando feriados:", e);
  }
}

function getFeriado(fechaISO) {
  return feriadosSemanaMap.get(String(fechaISO || "")) || null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function construirBadgeFeriadoHTML(fechaISO) {
  const f = getFeriado(fechaISO);
  if (!f) return "";
  const extra = f.irrenunciable ? " — Irrenunciable" : "";
  const title = `Feriado: ${f.nombre}${extra}`;
  return `<span class="badge-feriado" title="${escapeHtml(title)}">Feriado</span>`;
}

function headerDiaHTML(fechaISO) {
  const dia = nombreDiaSemanaDesdeDate(new Date(fechaISO + "T00:00:00"));
  const ddmm = ddmmDesdeISO(fechaISO);
  return `<span class="lbl-dia">${escapeHtml(dia)} ${escapeHtml(ddmm)}</span>${construirBadgeFeriadoHTML(
    fechaISO
  )}`;
}

// =========================
// CSS INJECT (ajuste botones navegación diaria)
// =========================
function inyectarEstilosNavDia() {
  if (document.getElementById("compromisos-nav-dia-style")) return;

  const style = document.createElement("style");
  style.id = "compromisos-nav-dia-style";
  style.textContent = `
    /* NAV DIARIA: botones más chicos y sin fondo azul */
    .dia-header{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      background: transparent !important;
      padding: 0 !important;
    }
    .dia-header .btn-nav-dia{
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      padding: 2px 6px !important;
      margin: 0 !important;
      min-width: 0 !important;
      width: auto !important;
      height: auto !important;
      line-height: 1 !important;
      border-radius: 6px !important;
      font-size: 14px !important;
    }
    .dia-header .btn-nav-dia:focus{
      outline: 2px solid rgba(0,0,0,0.15);
      outline-offset: 2px;
    }
    .dia-header .lbl-dia-hoy{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
    }
  `;
  document.head.appendChild(style);
}

// =========================
// SELECTORES
// =========================
const tablaCompromisos = document.getElementById("tablaCompromisos");
const inputFechaBaseSemana = document.getElementById("inputFechaBaseSemana");
const labelRangoSemana = document.getElementById("labelRangoSemana");

const modal = document.getElementById("modalCompromiso");
const form = document.getElementById("formCompromiso");

const btnVolver = document.getElementById("btnVolver");
const btnCancelar = document.getElementById("cancelarCompromiso");

const spanNombreVendedor = document.getElementById(
  "tituloModalCompromisoNombre"
);
const spanSemana = document.getElementById("tituloModalCompromisoSemana");

const hiddenIdVendedor = document.getElementById("idVendedorCompromiso");
const hiddenInicio = document.getElementById("fechaInicioSemana");
const hiddenFin = document.getElementById("fechaFinSemana");

// =========================
// ESTADO GLOBAL
// =========================
let usuarioActual = null;
let rolActual = null;

// =========================
// HELPERS
// =========================
function safeAlert(msg) {
  try {
    if (typeof window.mostrarAlerta === "function") window.mostrarAlerta(msg);
    else alert(msg);
  } catch {
    alert(msg);
  }
}

function getTablaCompromisos() {
  return document.getElementById("tablaCompromisos");
}

function getTbodyCompromisos() {
  return getTablaCompromisos()?.querySelector("tbody") || null;
}

// =========================
// ESTADO TABLA
// =========================
let tiposCompromisos = [];
let tiposObligatoriosCache = [];
let columnasObligatorias = [];
let tiposSupervisorCache = [];

let semanaInicioActual = null;
let semanaFinActual = null;

let datosTabla = [];
let compromisosSemana = [];

let ordenColumna = null;
let ordenAsc = true;

let fechaHoyDetalleISO = null;
let fechaAyerDetalleISO = null;

// Índices
let idxMontoPorVendedorTipoFecha = new Map();
let idxMontoPorVendedorTipo = new Map();

// =========================
// AUTENTICACION
// =========================
async function obtenerUsuarioActual() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    alert("Debe iniciar sesión nuevamente.");
    window.location.href = "../index.html";
    return;
  }
  usuarioActual = data.user;
}

async function obtenerPerfilActual() {
  const { data, error } = await supabase.rpc("get_perfil_actual", {
    p_user_id: usuarioActual.id,
  });

  if (error) {
    console.error("❌ get_perfil_actual error:", error);
    safeAlert("No se pudo obtener tu perfil (RBAC). Inicia sesión nuevamente.");
    window.location.href = "../index.html";
    return;
  }

  rolActual = data ? String(data).toLowerCase() : null;

  try {
    if (rolActual) {
      localStorage.setItem("perfil_actual", rolActual);
      sessionStorage.setItem("perfil_actual", rolActual);
    }
  } catch {}
}

// =========================
// TIPOS DE COMPROMISO
// =========================
async function cargarTiposCompromiso() {
  const { data, error } = await supabase
    .from("tipos_compromisos")
    .select(
      "id, nombre, descripcion, supervisor_id, activo, es_obligatorio, orden, visible_para_todos"
    );

  if (error) {
    console.error("Error cargando tipos_compromisos:", error);
    tiposCompromisos = [];
    tiposObligatoriosCache = [];
    tiposSupervisorCache = [];
    return;
  }

  tiposCompromisos = (data || []).filter((t) => t && t.activo === true);

  tiposObligatoriosCache = tiposCompromisos
    .filter((t) => t.es_obligatorio === true)
    .sort(ordenarTipos);

  tiposSupervisorCache = tiposCompromisos
    .filter((t) => {
      if (!t) return false;
      if (t.es_obligatorio !== false) return false;

      const esMio =
        String(t.supervisor_id || "") === String(usuarioActual?.id || "");
      const esVisibleParaTodos = t.visible_para_todos === true;

      return esMio || esVisibleParaTodos;
    })
    .sort(ordenarTipos);
}

// =========================
// SEMANA / FECHAS DETALLE
// =========================
function inicializarSelectorSemana() {
  if (!inputFechaBaseSemana) return;

  const hoyISO = formatoFechaLocal(new Date());
  const hoyHabilISO = normalizarFechaHabilISO(hoyISO);

  inputFechaBaseSemana.value = hoyHabilISO;
  actualizarSemanaYDetalle(hoyHabilISO);

  inputFechaBaseSemana.addEventListener("change", async () => {
    const valRaw = inputFechaBaseSemana.value || hoyHabilISO;
    const val = normalizarFechaHabilISO(valRaw);

    if (inputFechaBaseSemana.value !== val) inputFechaBaseSemana.value = val;

    actualizarSemanaYDetalle(val);

    await cargarFeriadosSemana(semanaInicioActual, semanaFinActual);
    cargarTablaCompromisos();
  });
}

function actualizarSemanaYDetalle(fechaBaseISO) {
  const fechaUI = normalizarFechaHabilISO(fechaBaseISO);

  const rango = rangoSemanaDesdeFecha(fechaUI);
  semanaInicioActual = rango.inicioISO;
  semanaFinActual = rango.finISO;

  if (labelRangoSemana) {
    const [yi, mi, di] = semanaInicioActual.split("-");
    const [yf, mf, df] = semanaFinActual.split("-");
    labelRangoSemana.textContent =
      "Semana " + di + "-" + mi + "-" + yi + " / " + df + "-" + mf + "-" + yf;
  }

  fechaHoyDetalleISO = fechaUI;
  fechaAyerDetalleISO = obtenerDiaHabilAnterior(fechaHoyDetalleISO);
}

function getLunesSemanaISO() {
  return semanaInicioActual;
}

function getViernesSemanaISO() {
  if (!semanaInicioActual) return null;
  return moverDiaHabil(semanaInicioActual, 4);
}

// =========================
// INDEXACIÓN
// =========================
function keyVTF(idV, idT, fechaISO) {
  return `${idV}|${idT}|${fechaISO}`;
}
function keyVT(idV, idT) {
  return `${idV}|${idT}`;
}

function reconstruirIndicesCompromisos() {
  idxMontoPorVendedorTipoFecha = new Map();
  idxMontoPorVendedorTipo = new Map();

  for (const c of compromisosSemana) {
    const idV = c.id_vendedor;
    const idT = c.id_tipo;
    const f = c.fecha_compromiso;
    const m = Number(c.monto_comprometido || 0);

    const k1 = keyVTF(idV, idT, f);
    idxMontoPorVendedorTipoFecha.set(
      k1,
      (idxMontoPorVendedorTipoFecha.get(k1) || 0) + m
    );

    const k2 = keyVT(idV, idT);
    idxMontoPorVendedorTipo.set(k2, (idxMontoPorVendedorTipo.get(k2) || 0) + m);
  }
}

function setMontoEnIndice(idV, idT, fechaISO, nuevoMonto) {
  const monto = Number(nuevoMonto || 0);

  compromisosSemana = (compromisosSemana || []).filter(
    (c) =>
      !(
        c.id_vendedor === idV &&
        c.id_tipo === idT &&
        c.fecha_compromiso === fechaISO
      )
  );

  if (monto > 0) {
    compromisosSemana.push({
      id_vendedor: idV,
      id_tipo: idT,
      monto_comprometido: monto,
      fecha_compromiso: fechaISO,
      comentario: null,
      id_supervisor: usuarioActual.id,
      id_equipo: localStorage.getItem("idEquipoActivo"),
    });
  }

  reconstruirIndicesCompromisos();
}

// =========================
// CARGA PRINCIPAL TABLA
// =========================
async function cargarTablaCompromisos() {
  const tbodyCompromisos = getTbodyCompromisos();
  if (!tbodyCompromisos) return;

  const idEquipo = localStorage.getItem("idEquipoActivo");
  if (!idEquipo) {
    tbodyCompromisos.innerHTML =
      '<tr><td colspan="6" style="text-align:center;">No hay equipo activo.</td></tr>';
    return;
  }

  const { data: rels, error: errV } = await supabase
    .from("equipo_vendedor")
    .select("id_vendedor, vendedores ( id_vendedor, nombre )")
    .eq("id_equipo", idEquipo)
    .eq("estado", true);

  if (errV) {
    console.error("Error cargando equipo_vendedor:", errV);
    tbodyCompromisos.innerHTML =
      '<tr><td colspan="6" style="text-align:center;">Error cargando vendedores.</td></tr>';
    return;
  }

  const vendedores = (rels || []).map((r) => r.vendedores).filter(Boolean);

  if (vendedores.length === 0) {
    tbodyCompromisos.innerHTML =
      '<tr><td colspan="6" style="text-align:center;">Sin vendedores.</td></tr>';
    return;
  }

  const idsVendedores = vendedores.map((v) => v.id_vendedor);
  const idsTiposTodos = tiposCompromisos.map((t) => t.id);

  let comps = [];
  if (idsTiposTodos.length > 0) {
    const { data: compsData, error: errC } = await supabase
      .from("compromisos")
      .select(
        "id_vendedor, id_tipo, monto_comprometido, fecha_compromiso, comentario, id_supervisor, id_equipo"
      )
      .in("id_vendedor", idsVendedores)
      .in("id_tipo", idsTiposTodos)
      .gte("fecha_compromiso", semanaInicioActual)
      .lte("fecha_compromiso", semanaFinActual);

    if (errC) {
      console.error("Error cargando compromisos:", errC);
      comps = [];
    } else {
      comps = compsData || [];
    }
  }

  compromisosSemana = comps;
  reconstruirIndicesCompromisos();

  columnasObligatorias = (tiposCompromisos || [])
    .filter((t) => t && t.es_obligatorio === true)
    .sort(ordenarTipos);

  reconstruirTheadObligatorios();

  const metricas = {};
  vendedores.forEach((v) => {
    const row = {
      id_vendedor: v.id_vendedor,
      nombre: v.nombre,
    };
    for (const t of columnasObligatorias) row["t_" + t.id] = 0;
    metricas[v.id_vendedor] = row;
  });

  const setObl = new Set(columnasObligatorias.map((t) => String(t.id)));

  for (const c of compromisosSemana) {
    const entry = metricas[c.id_vendedor];
    if (!entry) continue;
    if (!setObl.has(String(c.id_tipo))) continue;

    const monto = Number(c.monto_comprometido || 0);
    entry["t_" + c.id_tipo] = (Number(entry["t_" + c.id_tipo]) || 0) + monto;
  }

  datosTabla = Object.values(metricas);
  renderTabla();
}

// =========================
// DETALLE EXPANDIBLE
// =========================
function construirHtmlDetalleCompromisos(idVendedor) {
  const tiposSupervisor = tiposSupervisorCache;

  if (!tiposSupervisor || tiposSupervisor.length === 0) {
    return '<div class="detalle-compromisos-vacio">Sin compromisos configurados para este supervisor.</div>';
  }

  const lunesISO = getLunesSemanaISO();
  const viernesISO = getViernesSemanaISO();

  const fechaHoy = esDiaHabilISO(fechaHoyDetalleISO)
    ? fechaHoyDetalleISO
    : normalizarFechaHabilISO(fechaHoyDetalleISO);

  const fechaAyer = obtenerDiaHabilAnterior(fechaHoy);

  const hoyHeader = headerDiaHTML(fechaHoy);
  const ayerHeader = headerDiaHTML(fechaAyer);

  const esFeriadoHoy = !!getFeriado(fechaHoy);

  let html = '<table class="tabla-detalle-compromisos">';
  html +=
    "<thead><tr>" +
    "<th>Compromiso</th>" +
    '<th style="text-align:center;">' +
    `<div class="dia-header">${ayerHeader}</div>` +
    "</th>" +
    '<th style="text-align:center;">' +
    '<div class="dia-header">' +
    '<button type="button" class="btn-nav-dia" data-dir="-1" title="Día anterior">◀</button>' +
    `<span class="lbl-dia-hoy">${hoyHeader}</span>` +
    '<button type="button" class="btn-nav-dia" data-dir="1" title="Día siguiente">▶</button>' +
    "</div>" +
    "</th>" +
    "</tr></thead><tbody>";

  for (const tipo of tiposSupervisor) {
    const desc = tipo.descripcion || tipo.nombre || "";

    const totalAyer =
      idxMontoPorVendedorTipoFecha.get(
        keyVTF(idVendedor, tipo.id, fechaAyer)
      ) || 0;

    const totalHoy =
      idxMontoPorVendedorTipoFecha.get(keyVTF(idVendedor, tipo.id, fechaHoy)) ||
      0;

    const inputId = "input-hoy-" + idVendedor + "-" + tipo.id;

    const estiloFeriado = esFeriadoHoy
      ? 'style="background:#e9ecef; border-color:#b8bfc6; color:#495057;"'
      : "";

    html +=
      "<tr>" +
      "<td>" +
      escapeHtml(desc) +
      "</td>" +
      '<td style="text-align:right;">' +
      (totalAyer ? Number(totalAyer).toLocaleString("de-DE") : "0") +
      "</td>" +
      '<td style="text-align:center;">' +
      '<div class="compromiso-dia-hoy">' +
      '<input type="number" id="' +
      inputId +
      '" class="input-compromiso-dia" ' +
      estiloFeriado +
      'data-id-vendedor="' +
      idVendedor +
      '" data-id-tipo="' +
      tipo.id +
      '" min="0" step="1" value="' +
      (Number(totalHoy) > 0 ? Number(totalHoy) : "") +
      '" />' +
      '<button type="button" class="btn-guardar-compromiso-dia" ' +
      'data-id-vendedor="' +
      idVendedor +
      '" data-id-tipo="' +
      tipo.id +
      '">💾</button>' +
      "</div>" +
      "</td>" +
      "</tr>";
  }

  html += "</tbody></table>";
  return html;
}

// =========================
// RENDER TABLA PRINCIPAL
// =========================
function reconstruirTheadObligatorios() {
  const tabla = document.getElementById("tablaCompromisos");
  if (!tabla) return;
  const thead = tabla.querySelector("thead");
  if (!thead) return;

  let html = "<tr>";
  html +=
    '<th class="th-sortable" data-col="nombre">Vendedor <span class="sort-arrow"></span></th>';

  for (const t of columnasObligatorias) {
    const key = "t_" + t.id;
    html += `<th class="th-sortable" data-col="${key}">${escapeHtml(
      t.nombre || ""
    )} <span class="sort-arrow"></span></th>`;
  }

  html += "<th>Acciones</th>";
  html += "</tr>";
  thead.innerHTML = html;

  thead
    .querySelectorAll("th.th-sortable[data-col]")
    .forEach((th) => (th.style.cursor = "pointer"));
  if (ordenColumna) actualizarFlechas(ordenColumna, ordenAsc);
}

function renderTabla() {
  const tbodyCompromisos = getTbodyCompromisos();
  if (!tbodyCompromisos) return;

  tbodyCompromisos.innerHTML = "";

  const totalCols = 2 + (columnasObligatorias?.length || 0);
  if (!datosTabla || datosTabla.length === 0) {
    tbodyCompromisos.innerHTML =
      `<tr><td colspan="${totalCols}" style="text-align:center;">Sin datos</td></tr>`;
    return;
  }

  const fmt = (v) => Number(v || 0).toLocaleString("de-DE");

  datosTabla.forEach((d) => {
    const tr = document.createElement("tr");
    tr.classList.add("fila-vendedor");
    tr.dataset.idVendedor = d.id_vendedor;

    let html = "";
    html +=
      "<td>" +
      '<button type="button" class="btn-toggle-detalle" data-id-vendedor="' +
      d.id_vendedor +
      '" aria-expanded="false">+</button> ' +
      '<span class="nombre-vendedor">' +
      escapeHtml(d.nombre || "") +
      "</span>" +
      "</td>";

    for (const t of columnasObligatorias) {
      const key = "t_" + t.id;
      html += "<td>" + fmt(d[key]) + "</td>";
    }

    html +=
      '<td class="acciones">' +
      '<button type="button" class="btn-compromiso-semanal" data-id-vendedor="' +
      d.id_vendedor +
      '" data-nombre="' +
      escapeHtml(d.nombre || "") +
      '">📅</button>' +
      "</td>";

    tr.innerHTML = html;
    tbodyCompromisos.appendChild(tr);

    const trDetalle = document.createElement("tr");
    trDetalle.classList.add("fila-detalle");
    trDetalle.dataset.idVendedor = d.id_vendedor;
    trDetalle.style.display = "none";
    trDetalle.innerHTML =
      `<td colspan="${totalCols}"><div class="celda-detalle-compromisos"></div></td>`;
    tbodyCompromisos.appendChild(trDetalle);
  });

  if (ordenColumna) actualizarFlechas(ordenColumna, ordenAsc);
}

// =========================
// ORDENAMIENTO TABLA
// =========================
function ordenarTabla(col) {
  if (!datosTabla || datosTabla.length === 0) return;

  if (ordenColumna === col) ordenAsc = !ordenAsc;
  else {
    ordenColumna = col;
    ordenAsc = true;
  }

  datosTabla.sort((a, b) => {
    let v1 = a[col];
    let v2 = b[col];

    if (col === "nombre") {
      v1 = (v1 || "").toLowerCase();
      v2 = (v2 || "").toLowerCase();
      if (v1 < v2) return ordenAsc ? -1 : 1;
      if (v1 > v2) return ordenAsc ? 1 : -1;
      return 0;
    }

    v1 = Number(v1 || 0);
    v2 = Number(v2 || 0);
    return ordenAsc ? v1 - v2 : v2 - v1;
  });

  renderTabla();
}

function actualizarFlechas(columnaOrdenada, asc) {
  const ths = document.querySelectorAll("#tablaCompromisos thead th");

  ths.forEach((th) => {
    const col = th.dataset.col;
    const arrow = th.querySelector(".sort-arrow");
    if (!arrow) return;

    if (col === columnaOrdenada) arrow.textContent = asc ? "▲" : "▼";
    else arrow.textContent = "";
  });
}

function inicializarOrdenamiento() {
  const tabla = document.getElementById("tablaCompromisos");
  const thead = tabla?.querySelector("thead");
  if (!tabla || !thead) return;

  if (window.__compromisosSortInit) return;
  window.__compromisosSortInit = true;

  const aplicarCursor = () => {
    thead.querySelectorAll("th.th-sortable[data-col]").forEach((th) => {
      th.style.cursor = "pointer";
    });
  };
  aplicarCursor();

  thead.addEventListener("click", (ev) => {
    const th = ev.target?.closest?.("th.th-sortable[data-col]");
    if (!th) return;
    const col = th.dataset.col;
    if (!col) return;

    ordenarTabla(col);
    aplicarCursor();
  });
}

// =========================
// MODAL COMPROMISO SEMANAL
// =========================
function abrirModal(idV, nombre) {
  const _hiddenIdVendedor = document.getElementById("idVendedorCompromiso");
  const _hiddenInicio = document.getElementById("fechaInicioSemana");
  const _hiddenFin = document.getElementById("fechaFinSemana");
  const _spanNombreVendedor = document.getElementById(
    "tituloModalCompromisoNombre"
  );
  const _spanSemana = document.getElementById("tituloModalCompromisoSemana");
  const _tabla = document.getElementById("tablaModalTipos");
  const _modal = document.getElementById("modalCompromiso");

  if (
    !_hiddenIdVendedor ||
    !_hiddenInicio ||
    !_hiddenFin ||
    !_spanNombreVendedor ||
    !_spanSemana ||
    !_tabla ||
    !_modal
  ) {
    console.error(
      "❌ Modal Compromiso: faltan elementos del DOM. Revisa compromisos.html (ids)."
    );
    safeAlert("No se pudo abrir el compromiso: faltan elementos del modal.");
    return;
  }

  if (!semanaInicioActual || !semanaFinActual) {
    console.warn("⚠️ Semana no inicializada.");
    safeAlert("No se pudo abrir el compromiso: semana no inicializada.");
    return;
  }

  _hiddenIdVendedor.value = idV;
  _hiddenInicio.value = semanaInicioActual;
  _hiddenFin.value = semanaFinActual;
  _spanNombreVendedor.textContent = nombre || "Vendedor";

  const [yi, mi, di] = semanaInicioActual.split("-");
  const [yf, mf, df] = semanaFinActual.split("-");
  _spanSemana.textContent =
    "Semana " +
    di +
    "-" +
    mi +
    "-" +
    yi +
    " / " +
    df +
    "-" +
    mf +
    "-" +
    yf;

	const norm = (s) =>
	  String(s || "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();

	const prioridadObl = (nombre) => {
	  const n = norm(nombre);
	  if (n.includes("tope")) return 1;
	  if (n.includes("sobre")) return 2;
	  if (n.includes("bajo")) return 3;
	  if (n.includes("plan")) return 4;
	  return 99;
	};

	const tiposObl = (tiposCompromisos || [])
	  .filter((t) => t && t.es_obligatorio === true)
	  .sort((a, b) => {
		const pa = prioridadObl(a?.nombre);
		const pb = prioridadObl(b?.nombre);
		if (pa !== pb) return pa - pb;
		return ordenarTipos(a, b); // fallback por orden / nombre
	  });


  const prev = (compromisosSemana || []).filter((c) => c.id_vendedor === idV);
  const prevMap = {};
  for (const r of prev) prevMap[r.id_tipo] = Number(r.monto_comprometido || 0);

  let html = "";
  for (const t of tiposObl) {
    const val = prevMap[t.id] ?? 0;
    const show = Number(val) > 0 ? Number(val) : "";
    html += `
      <tr>
        <td class="col-tipo">${escapeHtml(t.nombre || "")}</td>
        <td class="col-monto">
          <input type="number" class="input-compromiso-semanal"
                 data-id-tipo="${t.id}" min="0" step="1" value="${show}" />
        </td>
      </tr>`;
  }
  if (!html) {
    html = `<tr><td colspan="2" style="text-align:center; color:#666;">No hay tipos obligatorios activos.</td></tr>`;
  }
  _tabla.innerHTML = `<tbody>${html}</tbody>`;

  const _inputs = _tabla.querySelectorAll(
    'input.input-compromiso-semanal[data-id-tipo]'
  );
  _inputs.forEach((inp) => {
    inp.addEventListener("focus", () => {
      try {
        inp.select();
      } catch {}
    });
  });

  if (typeof _modal.showModal === "function") _modal.showModal();
}

// =========================
// HELPERS UI
// =========================
function rerenderDetalleAbierto(idV) {
  const tbodyCompromisos = getTbodyCompromisos();
  const filaDetalle = tbodyCompromisos?.querySelector(
    'tr.fila-detalle[data-id-vendedor="' + idV + '"]'
  );
  if (!filaDetalle) return;

  filaDetalle.querySelector(".celda-detalle-compromisos").innerHTML =
    construirHtmlDetalleCompromisos(idV);
  filaDetalle.style.display = "";
}

function rerenderDetallesAbiertos() {
  document.querySelectorAll("tr.fila-detalle").forEach((filaDetalle) => {
    if (filaDetalle.style.display !== "none") {
      const idV = filaDetalle.dataset.idVendedor;
      filaDetalle.querySelector(".celda-detalle-compromisos").innerHTML =
        construirHtmlDetalleCompromisos(idV);
    }
  });
}

// =========================
// EVENTOS GENERALES (click)
// =========================
async function __compromisosHandleClick(e) {
  const btnCompSemanal = e.target.closest(".btn-compromiso-semanal");
  if (btnCompSemanal) {
    const tr = e.target.closest("tr.fila-vendedor");
    if (!tr) return;
    const idV = tr.dataset.idVendedor;
    const nombreEl = tr.querySelector(".nombre-vendedor");
    const nombre = nombreEl
      ? nombreEl.textContent.trim()
      : btnCompSemanal.dataset.nombre || "";
    abrirModal(idV, nombre);
    return;
  }

  const btnToggle = e.target.closest(".btn-toggle-detalle");
  if (btnToggle) {
    const tbodyCompromisos = getTbodyCompromisos();
    if (!tbodyCompromisos) return;
    const idV = btnToggle.dataset.idVendedor;
    const filaDetalle = tbodyCompromisos.querySelector(
      'tr.fila-detalle[data-id-vendedor="' + idV + '"]'
    );
    if (!filaDetalle) return;

    const expandido = btnToggle.getAttribute("aria-expanded") === "true";
    if (expandido) {
      filaDetalle.style.display = "none";
      btnToggle.textContent = "+";
      btnToggle.setAttribute("aria-expanded", "false");
    } else {
      filaDetalle.querySelector(".celda-detalle-compromisos").innerHTML =
        construirHtmlDetalleCompromisos(idV);
      filaDetalle.style.display = "";
      btnToggle.textContent = "−";
      btnToggle.setAttribute("aria-expanded", "true");
    }
    return;
  }

  // Navegación diaria (Lu–Vi) ◀ ▶
  const btnNavDia = e.target.closest(".btn-nav-dia");
  if (btnNavDia) {
    const dir = Number(btnNavDia.dataset.dir || "0");
    if (dir === 0) return;

    const lunesISO = getLunesSemanaISO();
    const viernesISO = getViernesSemanaISO();
    if (!lunesISO || !viernesISO || !fechaHoyDetalleISO) return;

    const candidato = moverDiaHabil(fechaHoyDetalleISO, dir);

    if (candidato < lunesISO || candidato > viernesISO) return;

    fechaHoyDetalleISO = candidato;
    fechaAyerDetalleISO = obtenerDiaHabilAnterior(fechaHoyDetalleISO);

    rerenderDetallesAbiertos();
    return;
  }

  const btnGuardarDia = e.target.closest(".btn-guardar-compromiso-dia");
  if (btnGuardarDia) {
    const idV = btnGuardarDia.dataset.idVendedor;
    const idTipo = btnGuardarDia.getAttribute("data-id-tipo");
    const idEquipo = localStorage.getItem("idEquipoActivo");
    if (!idV || !idTipo || !idEquipo) {
      alert("Faltan datos para guardar el compromiso diario.");
      return;
    }

    const selectorInput =
      'input.input-compromiso-dia[data-id-vendedor="' +
      idV +
      '"][data-id-tipo="' +
      idTipo +
      '"]';
    const inputDia = document.querySelector(selectorInput);
    if (!inputDia) return;

    const monto = Number(inputDia.value || "0");
    const fechaHoy = fechaHoyDetalleISO;

    try {
      await supabase.rpc("upsert_compromiso", {
        p_id_equipo: idEquipo,
        p_id_vendedor: idV,
        p_id_tipo: idTipo,
        p_fecha: fechaHoy,
        p_monto: monto,
        p_comentario: null,
      });

      setMontoEnIndice(idV, idTipo, fechaHoy, monto);
      rerenderDetalleAbierto(idV);
    } catch (err) {
      console.error("Error inesperado al guardar compromiso diario:", err);
      alert("Error inesperado al guardar compromiso diario.");
    }
    return;
  }
}

if (window.__compromisosClickHandler) {
  try {
    document.removeEventListener("click", window.__compromisosClickHandler);
  } catch {}
}
window.__compromisosClickHandler = __compromisosHandleClick;
document.addEventListener("click", window.__compromisosClickHandler);

document.addEventListener("focusin", (e) => {
  const inp = e.target;
  if (inp && inp.matches && inp.matches("input.input-compromiso-dia")) {
    try {
      inp.select();
    } catch {}
  }
});

// =========================
// FORM MODAL SEMANAL
// =========================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const idV = hiddenIdVendedor?.value;
    const inicio = hiddenInicio?.value;
    const fin = hiddenFin?.value;
    const idEquipo = localStorage.getItem("idEquipoActivo");

    if (!idV || !idEquipo || !inicio || !fin || !usuarioActual?.id) {
      safeAlert("Faltan datos para guardar el compromiso.");
      return;
    }

    try {
      const tabla = document.getElementById("tablaModalTipos");
      const inputs = tabla
        ? Array.from(
            tabla.querySelectorAll(
              'input.input-compromiso-semanal[data-id-tipo]'
            )
          )
        : [];

      const payloads = inputs
        .map((inp) => ({
          id_tipo: inp.getAttribute("data-id-tipo"),
          monto: Number(inp.value || "0"),
        }))
        .filter((x) => x.id_tipo && x.monto >= 0);

      const inserts = payloads
        .filter((p) => p.monto > 0)
        .map((p) => ({
          id_tipo: p.id_tipo,
          id_equipo: idEquipo,
          id_vendedor: idV,
          id_supervisor: usuarioActual.id,
          fecha_compromiso: inicio,
          monto_comprometido: p.monto,
          cumplido: false,
          comentario: null,
        }));

      if (inserts.length > 0) {
        const { error: upErr } = await supabase.from("compromisos").upsert(
          inserts,
          {
            onConflict: "id_equipo,id_vendedor,id_tipo,fecha_compromiso",
          }
        );

        if (upErr) {
          console.error("Error guardando (upsert) compromisos:", upErr);
          safeAlert("Error al guardar compromisos.");
          return;
        }
      }

      if (modal && typeof modal.close === "function") modal.close();
      await cargarTablaCompromisos();
    } catch (err) {
      console.error("Error inesperado al guardar compromisos:", err);
      safeAlert("Error inesperado al guardar.");
    }
  });
}

// =========================
// BOTONES VOLVER / CANCELAR
// =========================
if (btnVolver) {
  btnVolver.addEventListener("click", (e) => {
    const panelBotones = document.getElementById("panel-botones");
    const contenedorModulos = document.getElementById("contenedor-modulos");
    if (panelBotones && contenedorModulos) return;

    e.preventDefault();
    window.location.href = "../views/supervisor.html";
  });
}

if (btnCancelar) {
  btnCancelar.addEventListener("click", () => {
    if (modal && typeof modal.close === "function") modal.close();
  });
}

window.addEventListener("equipoCambiado", async () => {
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith("compromisos_bootstrap:")) {
      localStorage.removeItem(k);
    }
  });

  const hoyISO = formatoFechaLocal(new Date());
  const hoyHabilISO = normalizarFechaHabilISO(hoyISO);

  if (inputFechaBaseSemana) {
    inputFechaBaseSemana.value = hoyHabilISO;
    actualizarSemanaYDetalle(hoyHabilISO);
  }

  await cargarFeriadosSemana(semanaInicioActual, semanaFinActual);
  await cargarTablaCompromisos();
});

// =========================
// INIT
// =========================
(async function init() {
  // ✅ Asegura estilo botones nav (sin tocar CSS base)
  inyectarEstilosNavDia();

  await obtenerUsuarioActual();
  await obtenerPerfilActual();
  await cargarTiposCompromiso();

  inicializarSelectorSemana();

  await cargarFeriadosSemana(semanaInicioActual, semanaFinActual);

  inicializarOrdenamiento();
  await cargarTablaCompromisos();

  if (window.__compromisosIntervalId) {
    try {
      clearInterval(window.__compromisosIntervalId);
    } catch {}
  }
  window.__compromisosIntervalId = setInterval(verificarCambioEquipo, 500);
})();

function verificarCambioEquipo() {
  const actual = localStorage.getItem("idEquipoActivo");
  if (actual && actual !== ultimoEquipoActivo) {
    ultimoEquipoActivo = actual;
    window.dispatchEvent(new Event("equipoCambiado"));
  }
}
