// ================================
// COMPROMISOS.JS - PANEL DE COMPROMISOS
// Semanal (existente) + Mensual (nuevo) con un solo modal (2 tabs)
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

  return { inicioISO: formatoFechaLocal(inicio), finISO: formatoFechaLocal(fin) };
}

function nombreDiaSemanaDesdeDate(dateObj) {
  const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
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

// ✅ Ancla mensual (centralizado):
// Por defecto: primer día del mes de la semana seleccionada (YYYY-MM-01)
function anclaMesDesdeFechaISO(fechaISO) {
  const d = new Date((fechaISO || "") + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(1);
  return formatoFechaLocal(d);
}

function etiquetaMesDesdeISO(fechaISO) {
  const [y, m] = String(fechaISO || "").split("-");
  if (!y || !m) return "";
  return `${m}-${y}`;
}

// =========================
// FERIADOS (UI ONLY)
// =========================
let feriadosSemanaMap = new Map();

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
  return `<span class="lbl-dia">${escapeHtml(dia)} ${escapeHtml(ddmm)}</span>${construirBadgeFeriadoHTML(fechaISO)}`;
}

// =========================
// CSS INJECT (nav diaria)
// =========================
function inyectarEstilosNavDia() {
  if (document.getElementById("compromisos-nav-dia-style")) return;

  const style = document.createElement("style");
  style.id = "compromisos-nav-dia-style";
  style.textContent = `
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
const inputFechaBaseSemana = document.getElementById("inputFechaBaseSemana");
const labelRangoSemana = document.getElementById("labelRangoSemana");

const modal = document.getElementById("modalCompromisos");
const form = document.getElementById("formCompromisos");

const btnVolver = document.getElementById("btnVolver");
const btnCancelar = document.getElementById("cancelarCompromiso");

const spanNombreVendedor = document.getElementById("tituloModalCompromisoNombre");
const tituloModal = document.getElementById("tituloModalCompromisos");
const subtituloModal = document.getElementById("tituloModalSubtitulo");

const hiddenIdVendedor = document.getElementById("idVendedorCompromiso");
const hiddenInicio = document.getElementById("fechaInicioSemana");
const hiddenFin = document.getElementById("fechaFinSemana");
const hiddenAnclaMes = document.getElementById("fechaAnclaMes");

const tabSemanalBtn = document.getElementById("tabSemanal");
const tabMensualBtn = document.getElementById("tabMensual");
const sheetSemanal = document.getElementById("sheetSemanal");
const sheetMensual = document.getElementById("sheetMensual");
const tablaModalSemanal = document.getElementById("tablaModalTiposSemanal");
const tablaModalMensual = document.getElementById("tablaModalTiposMensual");

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

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function esTipoMensual(tipoNombre) {
  const n = norm(tipoNombre);
  return n.includes("mes");
}

// Label limpio para mensual: "TF", "Sobre", "Tope", "Plan"
function labelMensual(nombreTipo) {
  const n = norm(nombreTipo);
  if (n.includes("tf")) return "TF";
  if (n.includes("sobre")) return "Sobre";
  if (n.includes("tope")) return "Tope";
  if (n.includes("plan")) return "Plan";
  // fallback: quita "mes"
  return String(nombreTipo || "").replace(/\bmes\b/gi, "").trim();
}
// Label limpio para semanal: "Tope", "Sobre", "Bajo", "Plan"
function labelSemanal(nombreTipo) {
  const n = norm(nombreTipo);
  if (n.includes("tope")) return "Tope";
  if (n.includes("sobre")) return "Sobre";
  if (n.includes("bajo")) return "Bajo";
  if (n.includes("plan")) return "Plan";
  // fallback: Title Case simple
  const s = String(nombreTipo || "").trim().toLowerCase();
  return s ? (s.charAt(0).toUpperCase() + s.slice(1)) : "";
}


// =========================
// ESTADO TABLA
// =========================
let tiposCompromisos = [];
let columnasSemanales = [];
let columnasMensuales = [];

let tiposSupervisorCache = [];

let semanaInicioActual = null;
let semanaFinActual = null;

let datosTabla = [];
let compromisosSemana = [];
let compromisosMes = [];

// ✅ Orden por defecto: ascendente por vendedor
let ordenColumna = "nombre";
let ordenAsc = true;

let fechaHoyDetalleISO = null;
let fechaAyerDetalleISO = null;

// Índices
let idxMontoPorVendedorTipoFecha = new Map();
let idxMontoPorVendedorTipo = new Map();
let idxMontoMesPorVendedorTipo = new Map();

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
    .select("id, nombre, descripcion, supervisor_id, activo, es_obligatorio, orden, visible_para_todos");

  if (error) {
    console.error("Error cargando tipos_compromisos:", error);
    tiposCompromisos = [];
    columnasSemanales = [];
    columnasMensuales = [];
    tiposSupervisorCache = [];
    return;
  }

  tiposCompromisos = (data || []).filter((t) => t && t.activo === true);

  columnasMensuales = tiposCompromisos
    .filter((t) => t?.es_obligatorio === true && esTipoMensual(t?.nombre))
    .sort(ordenarTipos);

  columnasSemanales = tiposCompromisos
    .filter((t) => t?.es_obligatorio === true && !esTipoMensual(t?.nombre))
    .sort(ordenarTipos);

  // Detalle diario: se mantiene como estaba (no mensual)
  tiposSupervisorCache = tiposCompromisos
    .filter((t) => {
      if (!t) return false;
      if (t.es_obligatorio !== false) return false;

      const esMio = String(t.supervisor_id || "") === String(usuarioActual?.id || "");
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
    await cargarTablaCompromisos();
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

function getAnclaMesISO() {
  const base = inputFechaBaseSemana?.value || semanaInicioActual;
  return anclaMesDesdeFechaISO(base);
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

function reconstruirIndicesCompromisosSemana() {
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

function reconstruirIndiceMes() {
  idxMontoMesPorVendedorTipo = new Map();
  for (const c of compromisosMes) {
    const idV = c.id_vendedor;
    const idT = c.id_tipo;
    const m = Number(c.monto_comprometido || 0);
    const k = keyVT(idV, idT);
    idxMontoMesPorVendedorTipo.set(k, (idxMontoMesPorVendedorTipo.get(k) || 0) + m);
  }
}

function setMontoEnIndiceSemana(idV, idT, fechaISO, nuevoMonto) {
  const monto = Number(nuevoMonto || 0);

  compromisosSemana = (compromisosSemana || []).filter(
    (c) => !(c.id_vendedor === idV && c.id_tipo === idT && c.fecha_compromiso === fechaISO)
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

  reconstruirIndicesCompromisosSemana();
}

// =========================
// ORDENAMIENTO (aplica sin toggle)
// =========================
function sortDatosTabla() {
  if (!ordenColumna) return;

  datosTabla.sort((a, b) => {
    let v1 = a[ordenColumna];
    let v2 = b[ordenColumna];

    if (ordenColumna === "nombre") {
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
}

// =========================
// CARGA PRINCIPAL TABLA
// =========================
async function cargarTablaCompromisos() {
  const tabla = document.getElementById("tablaCompromisos");
  const tbody = tabla?.querySelector("tbody");
  if (!tbody) return;

  const totalCols = 3 + (columnasMensuales?.length || 0) + (columnasSemanales?.length || 0);

  const idEquipo = localStorage.getItem("idEquipoActivo");
  if (!idEquipo) {
    tbody.innerHTML = '<tr><td colspan="${totalCols}" style="text-align:center;">No hay equipo activo.</td></tr>';
    return;
  }

  const { data: rels, error: errV } = await supabase
    .from("equipo_vendedor")
    .select("id_vendedor, vendedores ( id_vendedor, nombre )")
    .eq("id_equipo", idEquipo)
    .eq("estado", true);

  if (errV) {
    console.error("Error cargando equipo_vendedor:", errV);
    tbody.innerHTML = '<tr><td colspan="${totalCols}" style="text-align:center;">Error cargando vendedores.</td></tr>';
    return;
  }

  const vendedores = (rels || []).map((r) => r.vendedores).filter(Boolean);

  if (vendedores.length === 0) {
    tbody.innerHTML = '<tr><td colspan="${totalCols}" style="text-align:center;">Sin vendedores.</td></tr>';
    return;
  }

  const idsVendedores = vendedores.map((v) => v.id_vendedor);
  const idsTiposSem = columnasSemanales.map((t) => t.id);
  const idsTiposMes = columnasMensuales.map((t) => t.id);

  // Semanal
  let compsSem = [];
  if (idsTiposSem.length > 0) {
    const { data, error } = await supabase
      .from("compromisos")
      .select("id_vendedor, id_tipo, monto_comprometido, fecha_compromiso, comentario, id_supervisor, id_equipo")
      .in("id_vendedor", idsVendedores)
      .in("id_tipo", idsTiposSem)
      .gte("fecha_compromiso", semanaInicioActual)
      .lte("fecha_compromiso", semanaFinActual);

    if (error) {
      console.error("Error cargando compromisos semanales:", error);
      compsSem = [];
    } else {
      compsSem = data || [];
    }
  }

  // Mensual (ancla del mes)
  const anclaMes = getAnclaMesISO();
  let compsMes = [];
  if (idsTiposMes.length > 0 && anclaMes) {
    const { data, error } = await supabase
      .from("compromisos")
      .select("id_vendedor, id_tipo, monto_comprometido, fecha_compromiso, comentario, id_supervisor, id_equipo")
      .in("id_vendedor", idsVendedores)
      .in("id_tipo", idsTiposMes)
      .eq("fecha_compromiso", anclaMes);

    if (error) {
      console.error("Error cargando compromisos mensuales:", error);
      compsMes = [];
    } else {
      compsMes = data || [];
    }
  }

  compromisosSemana = compsSem;
  compromisosMes = compsMes;

  reconstruirIndicesCompromisosSemana();
  reconstruirIndiceMes();

  reconstruirThead();

  // Reales TF40 del mes (Sobre + Tope)
  const realesMes = await cargarRealesMes(idsVendedores, anclaMes);

  const metricas = {};
  vendedores.forEach((v) => {
    const row = { id_vendedor: v.id_vendedor, nombre: v.nombre, real_tf40: 0, real_sobre: 0, real_tope: 0 };
    for (const t of columnasMensuales) row["m_" + t.id] = 0;
    for (const t of columnasSemanales) row["s_" + t.id] = 0;
    metricas[v.id_vendedor] = row;
  });

  for (const c of compromisosMes) {
    const entry = metricas[c.id_vendedor];
    if (!entry) continue;
    const k = "m_" + c.id_tipo;
    entry[k] = (Number(entry[k]) || 0) + Number(c.monto_comprometido || 0);
  }

  for (const c of compromisosSemana) {
    const entry = metricas[c.id_vendedor];
    if (!entry) continue;
    const k = "s_" + c.id_tipo;
    entry[k] = (Number(entry[k]) || 0) + Number(c.monto_comprometido || 0);
  }

    // aplica reales
  for (const id of Object.keys(metricas)) {
    metricas[id].real_tf40 = Number(realesMes?.[id]?.tf40 || 0);
    metricas[id].real_sobre = Number(realesMes?.[id]?.sobre || 0);
    metricas[id].real_tope  = Number(realesMes?.[id]?.tope  || 0);
  }

  datosTabla = Object.values(metricas);

  // ✅ aplica orden por defecto (nombre asc) antes del render
  sortDatosTabla();

  renderTabla();
}


// =========================
// REALES TF40 DEL MES (Sobre + Tope)
// =========================
async function cargarRealesMes(idsVendedores, anclaMesISO) {
  const out = {};
  (idsVendedores || []).forEach((id) => (out[id] = { tf40: 0, sobre: 0, tope: 0 }));
  if (!idsVendedores?.length || !anclaMesISO) return out;

  // mes: [ancla, siguiente_mes)
  const dt = new Date(anclaMesISO + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return out;

  const inicio = anclaMesISO;
  const fin = new Date(dt.getFullYear(), dt.getMonth() + 1, 1);
  const finISO = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-01`;

  // Leemos ventas (detalle) y calculamos TF40 real = Sobre + Tope
  // Nota: usamos select('*') para no fallar por columnas no existentes (cantidad/monto/etc).
  const { data, error } = await supabase
    .from("ventas")
    .select("*")
    .in("id_vendedor", idsVendedores)
    .gte("fecha_venta", inicio)
    .lt("fecha_venta", finISO);

  if (error) {
    console.error("No se pudo leer ventas para Reales TF40:", error);
    return out; // dejamos 0 para no romper UI
  }

  const pickQty = (row) => {
    // prioridad de posibles campos numéricos (si existen)
    const cands = [
      "cantidad",
      "unidades",
      "qty",
      "cantidad_venta",
      "n_ventas",
      "num_ventas",
      "monto", // a veces lo usan como cantidad (no plata) en modelos simples
    ];
    for (const k of cands) {
      const v = row?.[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    }
    return 1;
  };

  (data || []).forEach((row) => {
    const id = row?.id_vendedor;
    if (!id) return;

    const tv = String(row?.tipo_venta || "").toLowerCase();
    const esSobre = tv.includes("sobre");
    const esTope = tv.includes("tope");

    if (!esSobre && !esTope) return;

    const q = pickQty(row);
    if (esSobre) out[id].sobre = (Number(out[id].sobre) || 0) + q;
    if (esTope)  out[id].tope  = (Number(out[id].tope)  || 0) + q;
    out[id].tf40 = (Number(out[id].sobre) || 0) + (Number(out[id].tope) || 0);
  });

  return out;
}

// =========================
// DETALLE EXPANDIBLE (DIARIO) - SIN CAMBIOS
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
      idxMontoPorVendedorTipoFecha.get(keyVTF(idVendedor, tipo.id, fechaAyer)) || 0;

    const totalHoy =
      idxMontoPorVendedorTipoFecha.get(keyVTF(idVendedor, tipo.id, fechaHoy)) || 0;

    const inputId = "input-hoy-" + idVendedor + "-" + tipo.id;

    const estiloFeriado = esFeriadoHoy
      ? 'style="background:#e9ecef; border-color:#b8bfc6; color:#495057;"'
      : "";

    html +=
      "<tr>" +
      "<td>" + escapeHtml(desc) + "</td>" +
      '<td style="text-align:right;">' +
      (totalAyer ? Number(totalAyer).toLocaleString("de-DE") : "0") +
      "</td>" +
      '<td style="text-align:center;">' +
      '<div class="compromiso-dia-hoy">' +
      '<input type="number" id="' + inputId + '" class="input-compromiso-dia" ' +
      estiloFeriado +
      'data-id-vendedor="' + idVendedor + '" data-id-tipo="' + tipo.id + '" min="0" step="1" value="' +
      (Number(totalHoy) > 0 ? Number(totalHoy) : "") +
      '" />' +
      '<button type="button" class="btn-guardar-compromiso-dia" ' +
      'data-id-vendedor="' + idVendedor + '" data-id-tipo="' + tipo.id + '">💾</button>' +
      "</div>" +
      "</td>" +
      "</tr>";
  }

  html += "</tbody></table>";
  return html;
}



// =========================
// MARCOS ROBUSTOS (no dependen del orden de columnas)
// - Si por cualquier razón las columnas quedan intercaladas o el script se carga 2 veces,
//   forzamos el start/end según la primera y última ocurrencia real en el DOM.
// =========================
function aplicarMarcosEnHeader() {
  const colsRow = document.querySelector("#tablaCompromisos thead tr.cols");
  if (!colsRow) return;

  const ths = Array.from(colsRow.querySelectorAll("th"));
  if (!ths.length) return;

  // limpia marcas previas
  ths.forEach((th) => th.classList.remove("mensual-start", "mensual-end", "semanal-start", "semanal-end"));

  const mensuales = ths.filter((th) => th.classList.contains("col-mensual"));
  if (mensuales.length) {
    mensuales[0].classList.add("mensual-start");
    mensuales[mensuales.length - 1].classList.add("mensual-end");
  }

  const semanales = ths.filter((th) => th.classList.contains("col-semanal"));
  if (semanales.length) {
    semanales[0].classList.add("semanal-start");
    semanales[semanales.length - 1].classList.add("semanal-end");
  }
}

function aplicarMarcosEnFila(tr) {
  const tds = Array.from(tr?.querySelectorAll?.("td") || []);
  if (!tds.length) return;

  // limpia marcas previas
  tds.forEach((td) => td.classList.remove("mensual-start", "mensual-end", "semanal-start", "semanal-end"));

  const mensuales = tds.filter((td) => td.classList.contains("col-mensual"));
  if (mensuales.length) {
    mensuales[0].classList.add("mensual-start");
    mensuales[mensuales.length - 1].classList.add("mensual-end");
  }

  const semanales = tds.filter((td) => td.classList.contains("col-semanal"));
  if (semanales.length) {
    semanales[0].classList.add("semanal-start");
    semanales[semanales.length - 1].classList.add("semanal-end");
  }
}
// =========================
// THEAD (2 filas: grupal + columnas) + CLASES PARA MARCOS
// =========================
function reconstruirThead() {
  const tabla = document.getElementById("tablaCompromisos");
  const thead = tabla?.querySelector("thead");
  if (!thead) return;

  const colMens = columnasMensuales?.length || 0;
  const colSem = columnasSemanales?.length || 0;

  let html = `<tr class="grp">`;
  html += `<th rowspan="2" class="th-sortable" data-col="nombre">Vendedor <span class="sort-arrow"></span></th>`;

  // Grupo mensual
  if (colMens > 0) {
    html += `<th colspan="${colMens}" class="grp-mensual mensual-start mensual-end">Mensual</th>`;
  } else {
    html += `<th class="grp-mensual mensual-start mensual-end">Mensual</th>`;
  }

  // Grupo semanal
  if (colSem > 0) {
    html += `<th colspan="${colSem}" class="grp-semanal semanal-start semanal-end">Semanal</th>`;
  } else {
    html += `<th class="grp-semanal semanal-start semanal-end">Semanal</th>`;
  }

  html += `<th colspan="3" class="grp-real real-start real-end">Real</th>`;
  html += `<th rowspan="2">Acciones</th>`;
  html += `</tr>`;

  // Fila columnas
  html += `<tr class="cols">`;

  columnasMensuales.forEach((t, idx) => {
    const key = "m_" + t.id;
    const isStart = idx === 0;
    const isEnd = idx === columnasMensuales.length - 1;
    const cls = [
      "th-sortable",
      "col-mensual",
      isStart ? "mensual-start" : "",
      isEnd ? "mensual-end" : ""
    ].filter(Boolean).join(" ");
    html += `<th class="${cls}" data-col="${key}">${escapeHtml(labelMensual(t.nombre || ""))} <span class="sort-arrow"></span></th>`;
  });

  columnasSemanales.forEach((t, idx) => {
    const key = "s_" + t.id;
    const isStart = idx === 0;
    const isEnd = idx === columnasSemanales.length - 1;
    const cls = [
      "th-sortable",
      "col-semanal",
      isStart ? "semanal-start" : "",
      isEnd ? "semanal-end" : ""
    ].filter(Boolean).join(" ");
    html += `<th class="${cls}" data-col="${key}">${escapeHtml(labelSemanal(t.nombre || ""))} <span class="sort-arrow"></span></th>`;
  });

    // Subcolumnas Real
  html += `<th class="th-sortable col-real real-start" data-col="real_tf40">TF40 <span class="sort-arrow"></span></th>`;
  html += `<th class="th-sortable col-real" data-col="real_sobre">Sobre <span class="sort-arrow"></span></th>`;
  html += `<th class="th-sortable col-real real-end" data-col="real_tope">Tope <span class="sort-arrow"></span></th>`;

  html += `</tr>`;

  thead.innerHTML = html;

  thead.querySelectorAll("th.th-sortable[data-col]").forEach((th) => (th.style.cursor = "pointer"));
  actualizarFlechas(ordenColumna, ordenAsc);
  aplicarMarcosEnHeader();
}

// =========================
// RENDER TABLA PRINCIPAL (AGREGA CLASES PARA MARCOS)
// =========================
function renderTabla() {
  const tabla = document.getElementById("tablaCompromisos");
  const tbody = tabla?.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const totalCols = 2 + (columnasMensuales?.length || 0) + (columnasSemanales?.length || 0);
  if (!datosTabla || datosTabla.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align:center;">Sin datos</td></tr>`;
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

    // Mensual
    columnasMensuales.forEach((t, idx) => {
      const key = "m_" + t.id;
      const isStart = idx === 0;
      const isEnd = idx === columnasMensuales.length - 1;
      const cls = [
        "col-mensual",
        isStart ? "mensual-start" : "",
        isEnd ? "mensual-end" : ""
      ].filter(Boolean).join(" ");
      html += `<td class="${cls}">${fmt(d[key])}</td>`;
    });

    // Semanal
    columnasSemanales.forEach((t, idx) => {
      const key = "s_" + t.id;
      const isStart = idx === 0;
      const isEnd = idx === columnasSemanales.length - 1;
      const cls = [
        "col-semanal",
        isStart ? "semanal-start" : "",
        isEnd ? "semanal-end" : ""
      ].filter(Boolean).join(" ");
      html += `<td class="${cls}">${fmt(d[key])}</td>`;
    });

    // Real (Sobre + Tope del mes)
    html += `<td class="col-real real-start">${fmt(d.real_tf40)}</td>`;
    html += `<td class="col-real">${fmt(d.real_sobre)}</td>`;
    html += `<td class="col-real real-end">${fmt(d.real_tope)}</td>`;

    html +=
      '<td class="acciones">' +
      '<button type="button" class="btn-compromisos" data-id-vendedor="' +
      d.id_vendedor +
      '" data-nombre="' +
      escapeHtml(d.nombre || "") +
      '">📅</button>' +
      "</td>";

    tr.innerHTML = html;
    aplicarMarcosEnFila(tr);
    tbody.appendChild(tr);

    // fila detalle (diario)
    const trDetalle = document.createElement("tr");
    trDetalle.classList.add("fila-detalle");
    trDetalle.dataset.idVendedor = d.id_vendedor;
    trDetalle.style.display = "none";
    trDetalle.innerHTML = `<td colspan="${totalCols}"><div class="celda-detalle-compromisos"></div></td>`;
    tbody.appendChild(trDetalle);
  });

  actualizarFlechas(ordenColumna, ordenAsc);
  aplicarMarcosEnHeader();
}

// =========================
// ORDENAMIENTO TABLA (click)
// =========================
function ordenarTabla(col) {
  if (!datosTabla || datosTabla.length === 0) return;

  if (ordenColumna === col) ordenAsc = !ordenAsc;
  else {
    ordenColumna = col;
    ordenAsc = true;
  }

  sortDatosTabla();
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
// MODAL (UNICO) - SEMANAL + MENSUAL
// =========================
let tabActiva = "semanal";

function setTab(tab) {
  tabActiva = tab;

  if (tabSemanalBtn) tabSemanalBtn.classList.toggle("active", tab === "semanal");
  if (tabMensualBtn) tabMensualBtn.classList.toggle("active", tab === "mensual");
  if (sheetSemanal) sheetSemanal.classList.toggle("active", tab === "semanal");
  if (sheetMensual) sheetMensual.classList.toggle("active", tab === "mensual");

  const nombre = spanNombreVendedor?.textContent || "Vendedor";
  if (tituloModal) {
    tituloModal.textContent = (tab === "semanal" ? "Compromiso semanal – " : "Compromiso mensual – ") + nombre;
  }

  if (subtituloModal) {
    if (tab === "semanal") {
      const [yi, mi, di] = (hiddenInicio?.value || "").split("-");
      const [yf, mf, df] = (hiddenFin?.value || "").split("-");
      subtituloModal.textContent = yi ? `Semana ${di}-${mi}-${yi} / ${df}-${mf}-${yf}` : "";
    } else {
      const ancla = hiddenAnclaMes?.value;
      subtituloModal.textContent = ancla ? `Mes ${etiquetaMesDesdeISO(ancla)}` : "";
    }
  }
}

function construirTablaInputs(tab, tipos, prevMap, inputClass, labelFn) {
  let html = "";
  for (const t of tipos) {
    const val = prevMap[t.id] ?? 0;
    const show = Number(val) > 0 ? Number(val) : "";
    const lbl = labelFn ? labelFn(t.nombre || "") : (t.nombre || "");
    html += `
      <tr>
        <td class="col-tipo">${escapeHtml(lbl)}</td>
        <td class="col-monto">
          <input type="number" class="${inputClass}"
                 data-id-tipo="${t.id}" min="0" step="1" value="${show}" />
        </td>
      </tr>`;
  }
  if (!html) {
    html = `<tr><td colspan="2" style="text-align:center; color:#666;">Sin tipos ${tab} obligatorios activos.</td></tr>`;
  }
  return `<tbody>${html}</tbody>`;
}

function abrirModalCompromisos(idV, nombre) {
  if (!modal || !form || !tablaModalSemanal || !tablaModalMensual) {
    console.error("❌ Modal: faltan elementos del DOM.");
    safeAlert("No se pudo abrir el compromiso: faltan elementos del modal.");
    return;
  }

  if (!semanaInicioActual || !semanaFinActual) {
    safeAlert("No se pudo abrir el compromiso: semana no inicializada.");
    return;
  }

  const anclaMes = getAnclaMesISO();

  hiddenIdVendedor.value = idV;
  hiddenInicio.value = semanaInicioActual;
  hiddenFin.value = semanaFinActual;
  hiddenAnclaMes.value = anclaMes || "";

  if (spanNombreVendedor) spanNombreVendedor.textContent = nombre || "Vendedor";

  const prevSemana = (compromisosSemana || []).filter((c) => c.id_vendedor === idV);
  const prevSemanaMap = {};
  for (const r of prevSemana) prevSemanaMap[r.id_tipo] = Number(r.monto_comprometido || 0);

  const prevMes = (compromisosMes || []).filter((c) => c.id_vendedor === idV);
  const prevMesMap = {};
  for (const r of prevMes) prevMesMap[r.id_tipo] = Number(r.monto_comprometido || 0);

  // Orden semanal (como estabas usando)
  const prioridadObl = (nombreTipo) => {
    const n = norm(nombreTipo);
    if (n.includes("tope")) return 1;
    if (n.includes("sobre")) return 2;
    if (n.includes("bajo")) return 3;
    if (n.includes("plan")) return 4;
    return 99;
  };

  const tiposSem = (columnasSemanales || [])
    .slice()
    .sort((a, b) => {
      const pa = prioridadObl(a?.nombre);
      const pb = prioridadObl(b?.nombre);
      if (pa !== pb) return pa - pb;
      return ordenarTipos(a, b);
    });

  const tiposMes = (columnasMensuales || []).slice().sort(ordenarTipos);

  tablaModalSemanal.innerHTML = construirTablaInputs("semanales", tiposSem, prevSemanaMap, "input-compromiso-semanal", labelSemanal);
  tablaModalMensual.innerHTML = construirTablaInputs("mensuales", tiposMes, prevMesMap, "input-compromiso-mensual", labelMensual);

  tablaModalSemanal.querySelectorAll("input.input-compromiso-semanal").forEach((inp) => {
    inp.addEventListener("focus", () => { try { inp.select(); } catch {} });
  });
  tablaModalMensual.querySelectorAll("input.input-compromiso-mensual").forEach((inp) => {
    inp.addEventListener("focus", () => { try { inp.select(); } catch {} });
  });

  setTab("semanal");
  if (typeof modal.showModal === "function") modal.showModal();
}

if (tabSemanalBtn) tabSemanalBtn.addEventListener("click", () => setTab("semanal"));
if (tabMensualBtn) tabMensualBtn.addEventListener("click", () => setTab("mensual"));

// =========================
// UI helpers detalle diario
// =========================
function rerenderDetalleAbierto(idV) {
  const tabla = document.getElementById("tablaCompromisos");
  const tbody = tabla?.querySelector("tbody");
  const filaDetalle = tbody?.querySelector('tr.fila-detalle[data-id-vendedor="' + idV + '"]');
  if (!filaDetalle) return;

  filaDetalle.querySelector(".celda-detalle-compromisos").innerHTML = construirHtmlDetalleCompromisos(idV);
  filaDetalle.style.display = "";
}

function rerenderDetallesAbiertos() {
  document.querySelectorAll("tr.fila-detalle").forEach((filaDetalle) => {
    if (filaDetalle.style.display !== "none") {
      const idV = filaDetalle.dataset.idVendedor;
      filaDetalle.querySelector(".celda-detalle-compromisos").innerHTML = construirHtmlDetalleCompromisos(idV);
    }
  });
}

// =========================
// EVENTOS GENERALES (click)
// =========================
async function __compromisosHandleClick(e) {
  const btnComp = e.target.closest(".btn-compromisos");
  if (btnComp) {
    const tr = e.target.closest("tr.fila-vendedor");
    if (!tr) return;
    const idV = tr.dataset.idVendedor;
    const nombreEl = tr.querySelector(".nombre-vendedor");
    const nombre = nombreEl ? nombreEl.textContent.trim() : btnComp.dataset.nombre || "";
    abrirModalCompromisos(idV, nombre);
    return;
  }

  const btnToggle = e.target.closest(".btn-toggle-detalle");
  if (btnToggle) {
    const tabla = document.getElementById("tablaCompromisos");
    const tbody = tabla?.querySelector("tbody");
    if (!tbody) return;
    const idV = btnToggle.dataset.idVendedor;
    const filaDetalle = tbody.querySelector('tr.fila-detalle[data-id-vendedor="' + idV + '"]');
    if (!filaDetalle) return;

    const expandido = btnToggle.getAttribute("aria-expanded") === "true";
    if (expandido) {
      filaDetalle.style.display = "none";
      btnToggle.textContent = "+";
      btnToggle.setAttribute("aria-expanded", "false");
    } else {
      filaDetalle.querySelector(".celda-detalle-compromisos").innerHTML = construirHtmlDetalleCompromisos(idV);
      filaDetalle.style.display = "";
      btnToggle.textContent = "−";
      btnToggle.setAttribute("aria-expanded", "true");
    }
    return;
  }

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
      'input.input-compromiso-dia[data-id-vendedor="' + idV + '"][data-id-tipo="' + idTipo + '"]';
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

      setMontoEnIndiceSemana(idV, idTipo, fechaHoy, monto);
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

document.addEventListener("focusin", (e) => {
  const inp = e.target;
  if (inp && inp.matches && inp.matches("input.input-compromiso-dia")) {
    try { inp.select(); } catch {}
  }
});

// =========================
// FORM MODAL (GUARDAR SEGÚN TAB)
// =========================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const idV = hiddenIdVendedor?.value;
    const inicio = hiddenInicio?.value;
    const fin = hiddenFin?.value;
    const anclaMes = hiddenAnclaMes?.value;
    const idEquipo = localStorage.getItem("idEquipoActivo");

    if (!idV || !idEquipo || !inicio || !fin || !usuarioActual?.id) {
      safeAlert("Faltan datos para guardar el compromiso.");
      return;
    }

    try {
      if (tabActiva === "semanal") {
        const inputs = tablaModalSemanal
          ? Array.from(tablaModalSemanal.querySelectorAll('input.input-compromiso-semanal[data-id-tipo]'))
          : [];

        const inserts = inputs
          .map((inp) => ({
            id_tipo: inp.getAttribute("data-id-tipo"),
            monto: Number(inp.value || "0"),
          }))
          .filter((x) => x.id_tipo && x.monto > 0)
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
          const { error: upErr } = await supabase.from("compromisos").upsert(inserts, {
            onConflict: "id_equipo,id_vendedor,id_tipo,fecha_compromiso",
          });

          if (upErr) {
            console.error("Error guardando (upsert) compromisos semanales:", upErr);
            safeAlert("Error al guardar compromisos semanales.");
            return;
          }
        }
      } else {
        if (!anclaMes) {
          safeAlert("No se pudo determinar el mes del compromiso.");
          return;
        }

        const inputs = tablaModalMensual
          ? Array.from(tablaModalMensual.querySelectorAll('input.input-compromiso-mensual[data-id-tipo]'))
          : [];

        const inserts = inputs
          .map((inp) => ({
            id_tipo: inp.getAttribute("data-id-tipo"),
            monto: Number(inp.value || "0"),
          }))
          .filter((x) => x.id_tipo && x.monto > 0)
          .map((p) => ({
            id_tipo: p.id_tipo,
            id_equipo: idEquipo,
            id_vendedor: idV,
            id_supervisor: usuarioActual.id,
            fecha_compromiso: anclaMes,
            monto_comprometido: p.monto,
            cumplido: false,
            comentario: null,
          }));

        if (inserts.length > 0) {
          const { error: upErr } = await supabase.from("compromisos").upsert(inserts, {
            onConflict: "id_equipo,id_vendedor,id_tipo,fecha_compromiso",
          });

          if (upErr) {
            console.error("Error guardando (upsert) compromisos mensuales:", upErr);
            safeAlert("Error al guardar compromisos mensuales.");
            return;
          }
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

// =========================
// CAMBIO EQUIPO
// =========================
window.addEventListener("equipoCambiado", async () => {
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith("compromisos_bootstrap:")) localStorage.removeItem(k);
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
  const reentry = !!window.__compromisosInitDone;
  window.__compromisosInitDone = true;
  if (reentry) console.warn('⚠️ compromisos.js ya inicializado; rehidratando vista');

  inyectarEstilosNavDia();

  await obtenerUsuarioActual();
  await obtenerPerfilActual();
  await cargarTiposCompromiso();

  inicializarSelectorSemana();
  await cargarFeriadosSemana(semanaInicioActual, semanaFinActual);

  inicializarOrdenamiento();
  await cargarTablaCompromisos();

  if (window.__compromisosIntervalId) {
    try { clearInterval(window.__compromisosIntervalId); } catch {}
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
