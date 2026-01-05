// ================================
// COMPROMISOS.JS - PANEL DE COMPROMISOS
// Consolidado semanal por vendedor + detalle expandible tipo Excel
// ================================

function ordenarTipos(a, b) {
  const oa = (a?.orden ?? 999);
  const ob = (b?.orden ?? 999);
  if (oa !== ob) return oa - ob;
  return String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es");
}

import { supabase } from "../config.js";



let ultimoEquipoActivo = localStorage.getItem("idEquipoActivo");
// =========================
// UTILIDADES DE FECHA
// =========================
function formatoFechaLocal(date) {
  return date.toISOString().split("T")[0];
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

/**
 * Devuelve el día hábil anterior a la fecha dada (ISO),
 * considerando como hábil Lunes-Viernes.
 */
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

/**
 * Mueve una fecha hábil en +/-N días hábiles (lunes a viernes).
 */
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

// =========================
// SELECTORES
// =========================
const tablaCompromisos = document.getElementById("tablaCompromisos");
const tbodyCompromisos = tablaCompromisos
  ? tablaCompromisos.querySelector("tbody")
  : null;


function getTablaCompromisos() {
  return document.getElementById("tablaCompromisos");
}

function getTbodyCompromisos() {
  return getTablaCompromisos()?.querySelector("tbody") || null;
}


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
// HELPERS (seguro, sin dependencias fantasma)
// =========================
function safeAlert(msg) {
  try {
    if (typeof window.mostrarAlerta === "function") window.mostrarAlerta(msg);
    else alert(msg);
  } catch {
    alert(msg);
  }
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
let tiposCompromisos = [];
let tiposObligatoriosCache = [];
let columnasObligatorias = []; // [{id, nombre, orden}]
let tiposSupervisorCache = [];
 // [{id, nombre, descripcion, supervisor_id, activo, es_obligatorio}]
let mapaNombrePorId = {}; // { id: NOMBRE_MAYUS }

let semanaInicioActual = null;
let semanaFinActual = null;

let datosTabla = []; // [{id_vendedor, nombre, tope, sobre, bajo, plan}]
let compromisosSemana = []; // registros compromisos de la semana (todos los tipos activos)

let ordenColumna = null;
let ordenAsc = true;

// fechas para la tabla detalle
let fechaHoyDetalleISO = null; // base = inputFechaBaseSemana
let fechaAyerDetalleISO = null; // día hábil anterior a fechaHoyDetalleISO

// Índices para acelerar (O(1) por lookup)
let idxMontoPorVendedorTipoFecha = new Map(); // key: v|t|f => monto total
let idxMontoPorVendedorTipo = new Map(); // key: v|t => monto total semana (para resumen)

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

async function obtenerPerfil() {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", usuarioActual.id)
    .single();

  rolActual = data ? data.role : null;
}

// =========================
// TIPOS DE COMPROMISO
// =========================
async function cargarTiposCompromiso() {
  const { data, error } = await supabase
    .from("tipos_compromisos")
    .select("id, nombre, descripcion, supervisor_id, activo, es_obligatorio, orden");

  if (error) {
    console.error("Error cargando tipos_compromisos:", error);
    tiposCompromisos = [];
    tiposObligatoriosCache = [];
    tiposSupervisorCache = [];
    return;
  }

  // Solo activos
  tiposCompromisos = (data || []).filter((t) => t && t.activo === true);

  // Obligatorios (modal compromiso semanal / consolidado semanal)
  tiposObligatoriosCache = tiposCompromisos
    .filter((t) => t.es_obligatorio === true)
    .sort(ordenarTipos);

  // No obligatorios del supervisor (vista agrupada por vendedor / seguimiento)
  tiposSupervisorCache = tiposCompromisos
    .filter(
      (t) =>
        t.es_obligatorio === false &&
        String(t.supervisor_id || "") === String(usuarioActual?.id || "")
    )
    .sort(ordenarTipos);
}

// =========================
// SEMANA / FECHAS DETALLE
// =========================
function inicializarSelectorSemana() {
  if (!inputFechaBaseSemana) return;

  const hoy = formatoFechaLocal(new Date());
  inputFechaBaseSemana.value = hoy;
  actualizarSemanaYDetalle(hoy);

  inputFechaBaseSemana.addEventListener("change", () => {
    const val = inputFechaBaseSemana.value || hoy;
    actualizarSemanaYDetalle(val);
    cargarTablaCompromisos();
  });
}

function actualizarSemanaYDetalle(fechaBaseISO) {
  const rango = rangoSemanaDesdeFecha(fechaBaseISO);
  semanaInicioActual = rango.inicioISO;
  semanaFinActual = rango.finISO;

  // rango semana cabecera
  if (labelRangoSemana) {
    const [yi, mi, di] = semanaInicioActual.split("-");
    const [yf, mf, df] = semanaFinActual.split("-");
    labelRangoSemana.textContent =
      "Semana " + di + "-" + mi + "-" + yi + " / " + df + "-" + mf + "-" + yf;
  }

  // fechas para detalle (hoy / ayer)
  fechaHoyDetalleISO = fechaBaseISO;
  fechaAyerDetalleISO = obtenerDiaHabilAnterior(fechaBaseISO);
}

// =========================
// INDEXACIÓN (ACELERACIÓN)
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
    idxMontoPorVendedorTipoFecha.set(k1, (idxMontoPorVendedorTipoFecha.get(k1) || 0) + m);

    const k2 = keyVT(idV, idT);
    idxMontoPorVendedorTipo.set(k2, (idxMontoPorVendedorTipo.get(k2) || 0) + m);
  }
}

function setMontoEnIndice(idV, idT, fechaISO, nuevoMonto) {
  // Actualiza idxMontoPorVendedorTipoFecha y compromisosSemana (solo para ese día)
  // Estrategia: eliminar registros existentes en memoria para ese (v,t,f) y dejar 1 (si monto > 0)
  const monto = Number(nuevoMonto || 0);

  compromisosSemana = (compromisosSemana || []).filter(
    (c) =>
      !(
        c.id_vendedor === idV &&
        c.id_tipo === idT &&
        c.fecha_compromiso === fechaISO
      )
  );

  // Insertar registro en memoria si monto > 0
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

  // Reindexar SOLO por simplicidad (rápido y seguro; tamaño semanal suele ser acotado)
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

  // 1) Vendedores activos del equipo
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

  const vendedores = (rels || [])
    .map((r) => r.vendedores)
    .filter(Boolean);

  if (vendedores.length === 0) {
    tbodyCompromisos.innerHTML =
      '<tr><td colspan="6" style="text-align:center;">Sin vendedores.</td></tr>';
    return;
  }

  const idsVendedores = vendedores.map((v) => v.id_vendedor);
  const idsTiposTodos = tiposCompromisos.map((t) => t.id);

  // 2) Compromisos de la semana (de todos los tipos activos)
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

  // 3) Armar consolidado semanal (tipos obligatorios) en 1 pasada
  columnasObligatorias = (tiposCompromisos || [])
    .filter((t) => t && t.es_obligatorio === true)
    .sort(ordenarTipos);

  // Reconstruir cabecera dinámica (labels + flechas)
  reconstruirTheadObligatorios();

  const metricas = {};
  vendedores.forEach((v) => {
    const row = {
      id_vendedor: v.id_vendedor,
      nombre: v.nombre,
    };
    for (const t of columnasObligatorias) {
      row["t_" + t.id] = 0;
    }
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
  // Tipos de compromisos configurados PARA ESTE SUPERVISOR (cache)
  const tiposSupervisor = tiposSupervisorCache;

  if (!tiposSupervisor || tiposSupervisor.length === 0) {
    return '<div class="detalle-compromisos-vacio">Sin compromisos configurados para este supervisor.</div>';
  }

  // Fechas y nombres de día
  const fechaAyer = fechaAyerDetalleISO;
  const fechaHoy = fechaHoyDetalleISO;

  const diaAyer = nombreDiaSemanaDesdeDate(new Date(fechaAyer + "T00:00:00"));
  const diaHoy = nombreDiaSemanaDesdeDate(new Date(fechaHoy + "T00:00:00"));

  let html = '<table class="tabla-detalle-compromisos">';
  html +=
    "<thead><tr>" +
    "<th>Compromiso</th>" +
    '<th style="text-align:center;">' +
    '<div class="dia-header">' +
    '<button type="button" class="btn-nav-dia-ayer" data-dir="-1">◀</button>' +
    '<span class="lbl-dia-ayer">' +
    diaAyer +
    "</span>" +
    '<button type="button" class="btn-nav-dia-ayer" data-dir="1">▶</button>' +
    "</div>" +
    "</th>" +
    '<th style="text-align:center;">' +
    '<span class="lbl-dia-hoy">' +
    diaHoy +
    "</span>" +
    "</th>" +
    "</tr></thead><tbody>";

  for (const tipo of tiposSupervisor) {
    const desc = tipo.descripcion || tipo.nombre || "";

    const totalAyer =
      idxMontoPorVendedorTipoFecha.get(keyVTF(idVendedor, tipo.id, fechaAyer)) ||
      0;

    const totalHoy =
      idxMontoPorVendedorTipoFecha.get(keyVTF(idVendedor, tipo.id, fechaHoy)) ||
      0;

    const inputId = "input-hoy-" + idVendedor + "-" + tipo.id;

    html +=
      "<tr>" +
      "<td>" +
      desc +
      "</td>" +
      '<td style="text-align:right;">' +
      (totalAyer ? Number(totalAyer).toLocaleString("de-DE") : "0") +
      "</td>" +
      '<td style="text-align:center;">' +
      '<div class="compromiso-dia-hoy">' +
      '<input type="number" id="' +
      inputId +
      '" class="input-compromiso-dia" ' +
      'data-id-vendedor="' +
      idVendedor +
      '" data-id-tipo="' +
      tipo.id +
      '" min="0" step="1" value="' +
      ((Number(totalHoy) > 0) ? Number(totalHoy) : "") +
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

function reconstruirTheadObligatorios() {
  const tabla = document.getElementById("tablaCompromisos");
  if (!tabla) return;
  const thead = tabla.querySelector("thead");
  if (!thead) return;

  // columnasObligatorias ya viene ordenada
  let html = '<tr>';
  html += '<th class="th-sortable" data-col="nombre">Vendedor <span class="sort-arrow"></span></th>';

  for (const t of columnasObligatorias) {
    const key = "t_" + t.id;
    html += `<th class="th-sortable" data-col="${key}">${escapeHtml(t.nombre || "")} <span class="sort-arrow"></span></th>`;
  }

  html += '<th>Acciones</th>';
  html += '</tr>';
  thead.innerHTML = html;
}

// =========================
function renderTabla() {
  const tbodyCompromisos = getTbodyCompromisos();
  if (!tbodyCompromisos) return;

  tbodyCompromisos.innerHTML = "";

  const totalCols = 2 + (columnasObligatorias?.length || 0); // vendedor + obligatorios + acciones
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
    html += "<td>" +
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

    html += '<td class="acciones">' +
      '<button type="button" class="btn-compromiso-semanal" data-id-vendedor="' +
      d.id_vendedor +
      '" data-nombre="' +
      escapeHtml(d.nombre || "") +
      '">📅</button>' +
      "</td>";

    tr.innerHTML = html;
    tbodyCompromisos.appendChild(tr);

    // Fila detalle (placeholder)
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

    // numérico para t_<id>
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
  const ths = document.querySelectorAll("#tablaCompromisos thead th");
  ths.forEach((th) => {
    const col = th.dataset.col;
    if (!col) return;
    th.style.cursor = "pointer";
    th.addEventListener("click", () => ordenarTabla(col));
  });
}

// =========================
// MODAL COMPROMISO SEMANAL
// =========================
function abrirModal(idV, nombre) {
  // Re-tomar referencias (por si el módulo fue embebido y el DOM no estaba listo al evaluar el script)
  const _hiddenIdVendedor = document.getElementById("idVendedorCompromiso");
  const _hiddenInicio = document.getElementById("fechaInicioSemana");
  const _hiddenFin = document.getElementById("fechaFinSemana");
  const _spanNombreVendedor = document.getElementById("tituloModalCompromisoNombre");
  const _spanSemana = document.getElementById("tituloModalCompromisoSemana");
  const _tabla = document.getElementById("tablaModalTipos");
  const _modal = document.getElementById("modalCompromiso");

  if (!_hiddenIdVendedor || !_hiddenInicio || !_hiddenFin || !_spanNombreVendedor || !_spanSemana || !_tabla || !_modal) {
    console.error("❌ Modal Compromiso: faltan elementos del DOM. Revisa compromisos.html (ids).");
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

  // Título semana
  const [yi, mi, di] = semanaInicioActual.split("-");
  const [yf, mf, df] = semanaFinActual.split("-");
  _spanSemana.textContent = "Semana " + di + "-" + mi + "-" + yi + " / " + df + "-" + mf + "-" + yf;

  // Tipos obligatorios (fuente de verdad)
  const tiposObl = (tiposCompromisos || []).filter((t) => t && t.es_obligatorio === true);

  // Mapa id_tipo -> monto previo para esta semana/vendedor
  const prev = (compromisosSemana || []).filter((c) => c.id_vendedor === idV);
  const prevMap = {};
  for (const r of prev) prevMap[r.id_tipo] = Number(r.monto_comprometido || 0);

  // Render tabla dinámica
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

  // A prueba de humanos: evitar que el "0" se concatene (1 => 10)
  const _inputs = _tabla.querySelectorAll('input.input-compromiso-semanal[data-id-tipo]');
  _inputs.forEach((inp) => {
    inp.addEventListener("focus", () => {
      try { inp.select(); } catch {}
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
// =========================
// EVENTOS GENERALES (click)
// =========================
async function __compromisosHandleClick(e) {

  // Abrir modal compromiso semanal (delegado, evita DOM muerto al volver)
  const btnCompSemanal = e.target.closest(".btn-compromiso-semanal");
  if (btnCompSemanal) {
    const tr = e.target.closest("tr.fila-vendedor");
    if (!tr) return;
    const idV = tr.dataset.idVendedor;
    const nombreEl = tr.querySelector(".nombre-vendedor");
    const nombre = nombreEl ? nombreEl.textContent.trim() : (btnCompSemanal.dataset.nombre || "");
    abrirModal(idV, nombre);
    return;
  }

  // Botones +/- del modal
  const btnCantidad = e.target.closest(".btn-cantidad");
  if (btnCantidad) {
    const id = btnCantidad.dataset.target;
    const delta = Number(btnCantidad.dataset.delta || "0");
    const input = document.getElementById(id);
    if (!input) return;
    let v = Number(input.value || "0") + delta;
    if (v < 0) v = 0;
    input.value = String(v);
    return;
  }

  // Toggle detalle (+ / -)
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

  // Navegación día "ayer" (flechas ◀ ▶)
  const btnNavDia = e.target.closest(".btn-nav-dia-ayer");
  if (btnNavDia) {
    const dir = Number(btnNavDia.dataset.dir || "0");
    if (dir !== 0) {
      fechaAyerDetalleISO = moverDiaHabil(fechaAyerDetalleISO, dir);
      rerenderDetallesAbiertos();
    }
    return;
  }

  // Guardar compromiso diario (columna "Compromiso hoy")
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
      // 1) Persistencia (DB): UPSERT (RPC)
      await supabase.rpc("upsert_compromiso", {
        p_id_equipo: idEquipo,
        p_id_vendedor: idV,
        p_id_tipo: idTipo,
        p_fecha: fechaHoy,
        p_monto: monto,
        p_comentario: null
      });

      // 2) Performance: NO recargar toda la tabla.
      //    Actualizamos cache local y re-render solo el detalle abierto.
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
  try { document.removeEventListener("click", window.__compromisosClickHandler); } catch {}
}
window.__compromisosClickHandler = __compromisosHandleClick;
document.addEventListener("click", window.__compromisosClickHandler);

// A prueba de humanos: evitar concatenación por value=0 (1 => 10) en inputs diarios
document.addEventListener("focusin", (e) => {
  const inp = e.target;
  if (inp && inp.matches && inp.matches("input.input-compromiso-dia")) {
    try { inp.select(); } catch {}
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
      // Inputs dinámicos desde la tabla del modal
      const tabla = document.getElementById("tablaModalTipos");
      const inputs = tabla ? Array.from(tabla.querySelectorAll('input.input-compromiso-semanal[data-id-tipo]')) : [];

      const payloads = inputs
        .map((inp) => ({
          id_tipo: inp.getAttribute("data-id-tipo"),
          monto: Number(inp.value || "0"),
        }))
        .filter((x) => x.id_tipo && x.monto >= 0);

      // Construir inserts (1 fila por tipo con monto > 0)
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
        }));// Guardado idempotente (a prueba de duplicados):
// UPSERT por clave única ux_compromisos_equipo_vendedor_tipo_fecha
if (inserts.length > 0) {
  const { error: upErr } = await supabase
    .from("compromisos")
    .upsert(inserts, {
      onConflict: "id_equipo,id_vendedor,id_tipo,fecha_compromiso"
    });

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
// EVENTOS TABLA PRINCIPAL
// =========================
// (Se usa delegación en document click para evitar DOM muerto al re-embebido)


// =========================
// BOTONES VOLVER / CANCELAR
// =========================
if (btnVolver) {
  btnVolver.addEventListener("click", (e) => {
    const panelBotones = document.getElementById("panel-botones");
    const contenedorModulos = document.getElementById("contenedor-modulos");

    // Si está embebido, supervisor.js controla el volver
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
  // 1) Limpiar cache de compromisos (por equipo)
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith("compromisos_bootstrap:")) {
      localStorage.removeItem(k);
    }
  });

  // 2) Resetear semana a HOY (igual que Ventas)
  const hoy = formatoFechaLocal(new Date());
  if (inputFechaBaseSemana) {
    inputFechaBaseSemana.value = hoy;
    actualizarSemanaYDetalle(hoy);
  }

  // 3) Recargar tabla con el nuevo equipo
  await cargarTablaCompromisos();
});


// =========================
// INIT
// =========================
(async function init() {
  await obtenerUsuarioActual();
  await obtenerPerfil();
  await cargarTiposCompromiso();
  inicializarSelectorSemana();
  inicializarOrdenamiento();
  await cargarTablaCompromisos();


  if (window.__compromisosIntervalId) { try { clearInterval(window.__compromisosIntervalId); } catch {} }
  window.__compromisosIntervalId = setInterval(verificarCambioEquipo, 500);

})();


function verificarCambioEquipo() {
  const actual = localStorage.getItem("idEquipoActivo");
  if (actual && actual !== ultimoEquipoActivo) {
    ultimoEquipoActivo = actual;
    window.dispatchEvent(new Event("equipoCambiado"));
  }
}