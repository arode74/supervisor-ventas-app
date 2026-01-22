// scripts/compromiso-ventas.js
// - Filtro: DÍA (por defecto HOY).
// - Label: SOLO rango semanal "dd-mm-aaaa a dd-mm-aaaa" (sin "Semana X").
// - El DÍA define:
//    (1) Semana del reporte (Lu..Do donde cae el día; puede cruzar mes)
//    (2) Acumulado de ventas del MES COMPLETO del día seleccionado (1..último del mes)
// - Resumen por vendedor alineado en columnas: Tope/Sobre/Bajo/Plan/PV
// - PV en formato $ con separador de miles ".", y tope visual $999.999.999
// - Si el perfil es "zonal": se agrupa por ZONA (mostrando zona + nombre del zonal y si es principal/suplencia),
//   dentro se listan EQUIPOS, y al expandir un equipo se ven los VENDEDORES como ahora.

if (!window.supabase) throw new Error("Supabase no inicializado en window");
const supabase = window.supabase;

// ======================= DOM =======================
const $ = (id) => document.getElementById(id);

const elDia =
  $("selectDia") ||
  $("inputDia") ||
  $("dia") ||
  $("fecha") ||
  // fallback si alguien dejó week input
  $("selectSemana") ||
  document.querySelector('input[type="date"]') ||
  document.querySelector('input[type="week"]');

const elRango = $("labelRango") || $("rangoSemana") || $("rango");
const elReporte = $("contenedorReporte") || $("contenedorReporteCV") || $("reporte") || $("contenedor");
const elCarga = $("estadoCarga") || $("statusCarga") || $("lblEstado");

const btnVolver = $("btnVolverReporteCV") || document.querySelector("[data-volver-reportes]");
const btnExcel = $("btnExcel") || $("btnExcelReporte") || document.querySelector("[data-export-excel]");

let DATASET = null; // modo supervisor
const DATASET_BY_TEAM = new Map(); // modo zonal: equipoId -> dataset

// ======================= UI helpers =======================
function estado(msg, esError = false) {
  if (!elCarga) return;
  elCarga.textContent = msg || "";
  elCarga.style.color = esError ? "#b00020" : "";
}

const MAX_MONTO = 999_999_999;
function clampMonto(n) {
  const num = Number(n);
  if (Number.isNaN(num) || num === null || num === undefined) return 0;
  if (num < 0) return 0;
  return Math.min(num, MAX_MONTO);
}
function formatCLP(n) {
  const num = clampMonto(n);
  return num.toLocaleString("es-CL");
}
function formatCLPWithSymbol(n) {
  return `$${formatCLP(n)}`;
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

const DIAS_SHORT = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const TIPOS_VENTA = ["Tope", "Sobre", "Bajo", "Plan", "Saldo PV"];

// ======================= Orden equipos (UI opcional) =======================
// Si existe un control en el DOM, lo respetamos y lo dejamos habilitado.
// IDs soportados: selectOrdenEquipos, equiposSort, ordenEquipos
const EQUIPOS_SORT_DEFAULT = { enabled: true, dir: "asc" }; // asc | desc

function getEquiposSortConfig() {
  const el =
    document.getElementById("selectOrdenEquipos") ||
    document.getElementById("equiposSort") ||
    document.getElementById("ordenEquipos");

  // Si existe y estaba deshabilitado, lo habilitamos (requisito: "dejar habilitada la opción")
  if (el && el.disabled) el.disabled = false;

  // Si existe un <select> sin opciones, lo poblamos.
  if (el && el.tagName === "SELECT" && el.options.length === 0) {
    const opt1 = document.createElement("option");
    opt1.value = "asc";
    opt1.textContent = "Equipos (A→Z)";
    const opt2 = document.createElement("option");
    opt2.value = "desc";
    opt2.textContent = "Equipos (Z→A)";
    el.appendChild(opt1);
    el.appendChild(opt2);
    el.value = "asc";
  }

  // Si no existe control, usamos default (orden ascendente por nombre).
  if (!el) return { ...EQUIPOS_SORT_DEFAULT };

  // Caso checkbox: enabled on/off
  if (el.type === "checkbox") {
    return { enabled: el.checked !== false, dir: "asc" };
  }

  // Caso select: asc/desc u OFF
  const val = String(el.value || "asc").toLowerCase();
  if (val === "off" || val === "none" || val === "0" || val === "false") {
    return { enabled: false, dir: "asc" };
  }
  return { enabled: true, dir: val === "desc" ? "desc" : "asc" };
}


// ======================= Feriados (solo UI: plomo, sin bloquear) =======================
async function fetchFeriados(desdeISO, hastaISO) {
  // Si la tabla no existe o RLS bloquea, simplemente no marcamos feriados.
  try {
    const { data, error } = await supabase
      .from("feriados")
      .select("fecha, nombre, irrenunciable")
      .gte("fecha", desdeISO)
      .lte("fecha", hastaISO);

    if (error || !Array.isArray(data)) return new Map();

    const map = new Map();
    for (const f of data) {
      const iso = String(f?.fecha || "").slice(0, 10);
      if (!iso) continue;
      map.set(iso, {
        nombre: String(f?.nombre || "Feriado"),
        irrenunciable: f?.irrenunciable === true,
      });
    }
    return map;
  } catch (_) {
    return new Map();
  }
}

function feriadoTitle(f) {
  if (!f) return "";
  const extra = f.irrenunciable ? " (Irrenunciable)" : "";
  return `Feriado: ${f.nombre}${extra}`;
}

function aplicarPlomoSiFeriado(el, feriadoInfo) {
  if (!el || !feriadoInfo) return;
  el.style.background = "#e9ecef";
  el.style.color = "#495057";
  el.style.borderColor = "rgba(0,0,0,0.18)";
}

// ======================= Fechas =======================
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
function startOfWeekMonday(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0..6 (0=Dom)
  const diff = day === 0 ? -6 : 1 - day; // lunes
  x.setDate(x.getDate() + diff);
  return x;
}
function monthBounds(dateObj) {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth();
  const first = new Date(y, m, 1);
  first.setHours(0, 0, 0, 0);
  const last = new Date(y, m + 1, 0);
  last.setHours(0, 0, 0, 0);
  return { first, last };
}
function defaultDateInputValue() {
  return toISODate(new Date());
}
function fmtDMY(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

// Acepta "YYYY-MM-DD" o "YYYY-Www"
function parseInputToContext(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Fecha inválida");

  let selectedDay;

  const mWeek = raw.match(/^(\d{4})-W(\d{2})$/);
  if (mWeek) {
    const year = Number(mWeek[1]);
    const week = Number(mWeek[2]);

    // lunes de la semana ISO
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
    const monday = new Date(mondayWeek1);
    monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

    selectedDay = new Date(`${toISODate(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate())))}T00:00:00`);
  } else {
    const d = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida (formato esperado: YYYY-MM-DD)");
    selectedDay = d;
  }

  const weekMonday = startOfWeekMonday(selectedDay);
  const weekSunday = addDays(weekMonday, 6);
  const weekFriday = addDays(weekMonday, 4);
  const { first: monthStart, last: monthEnd } = monthBounds(selectedDay);

  return { selectedDay, weekMonday, weekFriday, weekSunday, monthStart, monthEnd };
}

function setRangoLabel(ctx) {
  if (!elRango) return;
  elRango.textContent = `${fmtDMY(ctx.weekMonday)} a ${fmtDMY(ctx.weekSunday)}`;
}

// ======================= Auth / Perfil =======================
async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

async function getPerfilActual(userId) {
  // Preferido: RPC RBAC
  try {
    const { data, error } = await supabase.rpc("get_perfil_actual", { p_user_id: userId });
    if (!error && data) return String(data).trim().toLowerCase();
  } catch (_) {}

  // Fallback localStorage
  const keys = ["perfil_actual", "perfilActual", "appventas_perfil", "role"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return String(v).trim().toLowerCase();
  }

  return "supervisor";
}

// ======================= Equipo actual (modo no-zonal) =======================
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

// ======================= Fetch base (supervisor / ventas) =======================
async function fetchTiposCompromisos({ perfil, userId, equipoId }) {
  // Reglas mínimas pedidas:
  // - activo = true
    // - Supervisor: propios + visibles_para_todos
  // - Zonal: ideal vía RPC (get_tipos_compromisos_para_equipo). Si no existe, cae a visibles_para_todos.

  // 1) Zonal: intentar RPC (si existe en la BBDD)
  if (String(perfil || "").toLowerCase() === "zonal" && equipoId) {
    try {
      const { data, error } = await supabase.rpc("get_tipos_compromisos_para_equipo", {
        p_id_equipo: equipoId,
      });
      if (!error && Array.isArray(data)) {
        return data
          .filter((x) => x && x.activo === true)
          .map((x) => ({
            id: x.id,
            descripcion: x.descripcion ?? x.nombre ?? x.tipo ?? x.nombre_tipo ?? "",
            orden: x.orden ?? 9999,
          }))
          .sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
      }
    } catch (_) {
      // si no existe la función o falla, continuamos con fallback
    }
  }

  // 2) Fallback simple por tabla (respetando RLS)
  let q = supabase
    .from("tipos_compromisos")
    .select("id, nombre, descripcion, orden, activo, supervisor_id, visible_para_todos")
    .eq("activo", true)
    .order("orden", { ascending: true });

  const rol = String(perfil || "").toLowerCase();
  if (rol === "zonal") {
    // Zonales: solo los visibles para todos (a menos que exista RPC anterior)
    q = q.eq("visible_para_todos", true);
  } else {
    // Supervisor (y derivados): propios + visibles
    q = q.or(`supervisor_id.eq.${userId},visible_para_todos.eq.true`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Error tipos_compromisos: ${error.message}`);

  return (data || []).map((x) => ({
    id: x.id,
    descripcion: x.descripcion ?? x.nombre ?? x.tipo ?? x.nombre_tipo ?? "",
    orden: x.orden ?? 9999,
  }));
}

async function fetchEquipoVendedorTramos(equipoId) {
  const { data, error } = await supabase
    .from("equipo_vendedor")
    .select("id_vendedor, id_equipo, fecha_inicio, fecha_fin, estado")
    .eq("id_equipo", equipoId);

  if (error) throw new Error(`Error equipo_vendedor: ${error.message}`);
  return data || [];
}

function tramosVigentesEnRango(tramos, desdeISO, hastaISO) {
  const ids = new Set();
  const map = new Map();

  for (const t of tramos || []) {
    if (!t?.id_vendedor) continue;
    if (t.estado === false) continue;

    const fi = t.fecha_inicio ? String(t.fecha_inicio).slice(0, 10) : null;
    const ff = t.fecha_fin ? String(t.fecha_fin).slice(0, 10) : null;

    if (fi && fi > hastaISO) continue;
    if (ff && ff < desdeISO) continue;

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
    .map((v) => ({ id: v.id_vendedor, nombre: v.nombre || "" }));
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

// Variante para zonal: compromisos por equipo (sin filtrar por supervisor)
async function fetchGestionPorEquipo(equipoId, lunesISO, viernesISO) {
  const { data, error } = await supabase
    .from("compromisos")
    .select("id_vendedor, id_tipo, fecha_compromiso, monto_comprometido")
    .eq("id_equipo", equipoId)
    .gte("fecha_compromiso", lunesISO)
    .lte("fecha_compromiso", viernesISO);

  if (error) throw new Error(`Error compromisos: ${error.message}`);
  return data || [];
}


// ======================= Tipos: respaldo si no vienen por RLS/RPC =======================
// Si por políticas/RLS el usuario (ej. zonal) no ve tipos_compromisos, igual mostramos los compromisos
// usando los id_tipo existentes en compromisos como "Tipo <n>" (fallback seguro).
async function asegurarTiposDesdeCompromisos(tipos, compromisosSemana) {
  const base = Array.isArray(tipos) ? tipos.filter(Boolean) : [];
  if (base.length) return base;

  const ids = Array.from(new Set((compromisosSemana || []).map((r) => r?.id_tipo).filter(Boolean)));
  if (!ids.length) return [];

  // Intento 1: resolver nombres desde tipos_compromisos (si RLS lo permite)
  try {
    const { data, error } = await supabase
      .from("tipos_compromisos")
      .select("id, nombre, descripcion, orden, activo")
      .in("id", ids);

    if (!error && Array.isArray(data) && data.length) {
      return data
        .filter((x) => x && x.activo !== false)
        .map((x) => ({
          id: x.id,
          descripcion: x.descripcion ?? x.nombre ?? "Tipo",
          orden: x.orden ?? 9999,
        }))
        .sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
    }
  } catch (_) {
    // seguimos con fallback
  }

  // Fallback 2: mostrar ids como "Tipo 1..n" (orden estable)
  return ids.map((id, i) => ({ id, descripcion: `Tipo ${i + 1}`, orden: i + 1 }));
}

function rankMetricsFromAcc(acc) {
  const tope = clampMonto(acc?.["Tope"] || 0);
  const sobre = clampMonto(acc?.["Sobre"] || 0);
  const bajo = clampMonto(acc?.["Bajo"] || 0);
  const g70 = tope;
  const g40 = clampMonto(tope + sobre);
  const tf = clampMonto(tope + sobre + bajo);
  return { g40, g70, tf };
}


function sortEquipos(equipos, mode) {
  const m = String(mode || "nombre_asc").toLowerCase();
  const base = [...(equipos || [])];
  const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
  base.sort((a, b) => collator.compare(String(a?.nombre || ""), String(b?.nombre || "")));
  if (m === "nombre_desc") base.reverse();
  return base;
}

function sortVendedores(ds, mode) {
  const m = String(mode || "nombre_asc").toLowerCase();
  const base = [...(ds.vendedores || [])];

  if (m === "nombre_desc") {
    base.sort((a, b) => b.nombre.localeCompare(a.nombre, "es"));
    return base;
  }

  if (m === "rank_desc" || m === "rank_asc") {
    const dir = m === "rank_desc" ? -1 : 1;
    base.sort((a, b) => {
      const ra = rankMetricsFromAcc(ds.ventasAcumuladasMes?.[a.id] || {});
      const rb = rankMetricsFromAcc(ds.ventasAcumuladasMes?.[b.id] || {});

      if (ra.g40 !== rb.g40) return (ra.g40 - rb.g40) * dir;
      if (ra.g70 !== rb.g70) return (ra.g70 - rb.g70) * dir;
      if (ra.tf !== rb.tf) return (ra.tf - rb.tf) * dir;
      return a.nombre.localeCompare(b.nombre, "es") * dir;
    });
    return base;
  }

  base.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return base;
}

function sumAccumuladoEquipo(ventasAcumuladasMes) {
  const tot = { "Tope": 0, "Sobre": 0, "Bajo": 0, "Plan": 0, "Saldo PV": 0 };
  for (const acc of Object.values(ventasAcumuladasMes || {})) {
    tot["Tope"] = clampMonto(tot["Tope"] + (acc?.["Tope"] || 0));
    tot["Sobre"] = clampMonto(tot["Sobre"] + (acc?.["Sobre"] || 0));
    tot["Bajo"] = clampMonto(tot["Bajo"] + (acc?.["Bajo"] || 0));
    tot["Plan"] = clampMonto(tot["Plan"] + (acc?.["Plan"] || 0));
    tot["Saldo PV"] = clampMonto(tot["Saldo PV"] + (acc?.["Saldo PV"] || 0));
  }
  return tot;
}

async function fetchVentas(vendorIds, desdeISO, hastaISO) {
  if (!vendorIds.length) return [];
  const { data, error } = await supabase
    .from("ventas")
    .select("id_vendedor, fecha_venta, monto, tipo_venta")
    .in("id_vendedor", vendorIds)
    .gte("fecha_venta", desdeISO)
    .lte("fecha_venta", hastaISO);

  if (error) throw new Error(`Error ventas: ${error.message}`);
  return data || [];
}

// ======================= Indexado =======================
function buildGestionMap(rows) {
  const map = {};
  for (const r of rows || []) {
    const vid = r.id_vendedor;
    const tid = r.id_tipo;
    const f = String(r.fecha_compromiso).slice(0, 10);
    const m = clampMonto(r.monto_comprometido || 0);

    map[vid] ??= {};
    map[vid][tid] ??= {};
    map[vid][tid][f] = clampMonto((map[vid][tid][f] || 0) + m);
  }
  return map;
}

function buildVentasMap(rows, tramosPorVendedor) {
  const map = {};
  for (const r of rows || []) {
    const vid = r.id_vendedor;
    const f = String(r.fecha_venta).slice(0, 10);
    const m = clampMonto(r.monto || 0);
    const tipo = labelTipoVenta(r.tipo_venta);

    const tramos = tramosPorVendedor.get(vid) || [];
    const ok = tramos.some((t) => t.fi <= f && f <= t.ff);
    if (!ok) continue;

    map[vid] ??= {};
    map[vid][f] ??= {};
    map[vid][f][tipo] = clampMonto((map[vid][f][tipo] || 0) + m);
  }
  return map;
}

function buildVentasAcumuladoMap(rows, tramosPorVendedor) {
  const acc = {};
  for (const r of rows || []) {
    const vid = r.id_vendedor;
    const f = String(r.fecha_venta).slice(0, 10);
    const m = clampMonto(r.monto || 0);
    const tipo = labelTipoVenta(r.tipo_venta);

    const tramos = tramosPorVendedor.get(vid) || [];
    const ok = tramos.some((t) => t.fi <= f && f <= t.ff);
    if (!ok) continue;

    acc[vid] ??= {};
    acc[vid][tipo] = clampMonto((acc[vid][tipo] || 0) + m);
  }
  return acc;
}

// ======================= ZONAL: Zonas / Equipos =======================
// Tablas reales (según tus imágenes):
// - public.zonas: id_zona, nombre, activo
// - public.zona_zonal: id_zona, id_zonal, es_principal, fecha_inicio, fecha_fin, motivo_suplencia, id_motivo
// - public.zona_equipo: id_zona, id_equipo, fecha_inicio, fecha_fin
// - public.equipos: id_equipo, nombre (o nombre_equipo)
// - public.profiles: id (uuid), nombre
function isoRefFromCtx(ctx) {
  return toISODate(ctx.selectedDay);
}
function vigente(fi, ff, refISO) {
  const a = fi ? String(fi).slice(0, 10) : "0000-01-01";
  const b = ff ? String(ff).slice(0, 10) : "9999-12-31";
  return a <= refISO && refISO <= b;
}

async function fetchZonasAsignadasAZonal(zonalUserId, refISO) {
  const { data: zz, error } = await supabase
    .from("zona_zonal")
    // Columnas reales en DEV: es_principal, es_suplencia, id_motivo_suplencia (nullable)
    .select(
      "id_relacion, id_zona, id_zonal, es_principal, es_suplencia, id_motivo_suplencia, fecha_inicio, fecha_fin, estado"
    )
    .eq("id_zonal", zonalUserId);

  if (error) throw new Error(`Error zona_zonal: ${error.message}`);

  const rows = (zz || [])
    .filter((r) => r?.estado !== false)
    .filter((r) => vigente(r.fecha_inicio, r.fecha_fin, refISO));

  if (!rows.length) return [];

  const zonaIds = Array.from(new Set(rows.map((r) => r.id_zona).filter(Boolean)));

  const [{ data: zonas, error: eZ }, { data: profs, error: eP }] = await Promise.all([
    supabase.from("zonas").select("id_zona, nombre, activo").in("id_zona", zonaIds),
    supabase.from("profiles").select("id, nombre").in("id", [zonalUserId]),
  ]);
  if (eZ) throw new Error(`Error zonas: ${eZ.message}`);
  if (eP) throw new Error(`Error profiles: ${eP.message}`);

  const zonaById = new Map((zonas || []).map((z) => [z.id_zona, z]));
  const nombreZonal = profs?.[0]?.nombre ? profs[0].nombre : "(sin nombre)";

  return rows
    .map((r) => {
      const z = zonaById.get(r.id_zona);
      return {
        id_zona: r.id_zona,
        zona_nombre: z?.nombre || "(sin zona)",
        zona_activo: z?.activo !== false,
        id_zonal: r.id_zonal,
        zonal_nombre: nombreZonal,
        es_principal: r.es_principal === true,
        es_suplencia: r.es_suplencia === true,
        id_motivo_suplencia: r.id_motivo_suplencia || null,
        // Solo aplica a suplencia; se resuelve aparte si alguna vez se requiere mostrar nombre.
        motivo_suplencia: null,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
      };
    })
    .filter((x) => x.zona_activo)
    .sort((a, b) => a.zona_nombre.localeCompare(b.zona_nombre, "es"));
}

async function fetchEquiposDeZona(idZona, refISO) {
  const { data: ze, error } = await supabase
    .from("zona_equipo")
    .select("id_relacion, id_zona, id_equipo, fecha_inicio, fecha_fin")
    .eq("id_zona", idZona);

  if (error) throw new Error(`Error zona_equipo: ${error.message}`);

  const equipoIds = Array.from(
    new Set((ze || []).filter((r) => vigente(r.fecha_inicio, r.fecha_fin, refISO)).map((r) => r.id_equipo).filter(Boolean))
  );
  if (!equipoIds.length) return [];

  // Orden ascendente por nombre (y opción de invertir si existe control en UI)
  const sortCfg = getEquiposSortConfig();
  let queryEq = supabase.from("equipos").select("id_equipo, nombre_equipo").in("id_equipo", equipoIds);
  if (sortCfg.enabled) {
    queryEq = queryEq.order("nombre_equipo", { ascending: sortCfg.dir !== "desc" });
  } else {
    // Igual dejamos ascendente por defecto para evitar "random order"
    queryEq = queryEq.order("nombre_equipo", { ascending: true });
  }
  const { data: eq, error: e2 } = await queryEq;

  if (e2) throw new Error(`Error equipos: ${e2.message}`);

  return (eq || [])
    .map((r) => ({ id_equipo: r.id_equipo, nombre: r.nombre_equipo || "(sin nombre)" }));
}

function buildAcumuladoGrid(acc) {
  const acumulado = document.createElement("div");
  acumulado.style.display = "grid";
  acumulado.style.gridTemplateColumns = "80px 80px 80px 80px 120px";
  acumulado.style.columnGap = "6px";
  acumulado.style.justifyContent = "end";
  acumulado.style.alignItems = "center";
  acumulado.style.fontSize = "12px";
  acumulado.style.opacity = "0.92";

  const mk = (label, value, isPV = false) => {
    const cell = document.createElement("div");
    cell.style.display = "flex";
    cell.style.justifyContent = "space-between";
    cell.style.gap = "4px";
    cell.style.whiteSpace = "nowrap";

    const lab = document.createElement("span");
    lab.textContent = label;

    const v = clampMonto(value || 0);
    const shown = isPV ? formatCLPWithSymbol(v) : formatCLP(v);

    const val = document.createElement("span");
    val.textContent = `[${shown || (isPV ? "$0" : "0")}]`;
    val.style.fontWeight = "700";
    val.style.textAlign = "right";
    val.style.marginLeft = "auto";

    cell.appendChild(lab);
    cell.appendChild(val);
    return cell;
  };

  acumulado.appendChild(mk("Tope", acc?.["Tope"] || 0));
  acumulado.appendChild(mk("Sobre", acc?.["Sobre"] || 0));
  acumulado.appendChild(mk("Bajo", acc?.["Bajo"] || 0));
  acumulado.appendChild(mk("Plan", acc?.["Plan"] || 0));
  acumulado.appendChild(mk("PV", acc?.["Saldo PV"] || 0, true));

  return acumulado;
}

// ======================= Render: Vendedores (como ahora) =======================
function renderVendedoresEnContenedor(ds, containerEl) {
  containerEl.innerHTML = "";

  if (!ds.vendedores.length) {
    containerEl.innerHTML = `<div style="padding:10px 0;">Sin vendedores vigentes para el equipo/semana.</div>`;
    return;
  }

  // Toolbar ordenamiento (aplica a supervisor y zonal)
  const bar = document.createElement("div");
  bar.style.display = "flex";
  bar.style.alignItems = "center";
  bar.style.gap = "10px";
  bar.style.margin = "6px 0 10px";

  const lbl = document.createElement("span");
  lbl.textContent = "Orden:";
  lbl.style.fontWeight = "700";
  lbl.style.fontSize = "12px";

  const sel = document.createElement("select");
  sel.style.fontSize = "12px";
  sel.style.padding = "4px 6px";
  sel.style.borderRadius = "8px";

  const options = [
    { v: "nombre_asc", t: "Nombre (A→Z)" },
    { v: "nombre_desc", t: "Nombre (Z→A)" },
    { v: "rank_desc", t: ">40, >70, TF (mejor→peor)" },
    { v: "rank_asc", t: ">40, >70, TF (peor→mejor)" },
  ];
  options.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.v;
    opt.textContent = o.t;
    sel.appendChild(opt);
  });

  ds.__sortMode = ds.__sortMode || "nombre_asc";
  sel.value = ds.__sortMode;
  sel.addEventListener("change", () => {
    ds.__sortMode = sel.value;
    renderVendedoresEnContenedor(ds, containerEl);
  });

  bar.appendChild(lbl);
  bar.appendChild(sel);
  containerEl.appendChild(bar);

  const vendedoresOrdenados = sortVendedores(ds, ds.__sortMode);

  for (const vend of vendedoresOrdenados) {
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

    const spacer = document.createElement("div");
    spacer.style.flex = "1";

    const acc = ds.ventasAcumuladasMes?.[vend.id] || {};
    const acumulado = buildAcumuladoGrid(acc);

    fila.appendChild(toggle);
    fila.appendChild(nombre);
    fila.appendChild(spacer);
    fila.appendChild(acumulado);

    const panel = document.createElement("div");
    panel.style.display = "none";
    panel.style.marginTop = "10px";
    panel.appendChild(buildPanel2Column(vend, ds)); // mantiene vista actual

    fila.addEventListener("click", () => {
      const abierto = panel.style.display !== "none";
      panel.style.display = abierto ? "none" : "block";
      toggle.textContent = abierto ? "+" : "−";
    });

    bloque.appendChild(fila);
    bloque.appendChild(panel);
    containerEl.appendChild(bloque);
  }
}

// ======================= Panel detalle (se mantiene) =======================
function buildPanel2Column(vend, ds) {
  const { tipos, ctx, gestionMap, ventasMap, feriadosMap } = ds;

  const fechas7 = Array.from({ length: 7 }, (_, i) => toISODate(addDays(ctx.weekMonday, i))); // Lu..Do
  const fechas5 = fechas7.slice(0, 5); // Lu..Vi

  const FER = {
    bg: "#e9ecef",
    border: "#b8bfc6",
    color: "#495057",
  };

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
  compDaysInner.appendChild(buildDaysTableCompromisos({
    tipos,
    fechas: fechas5,
    diasShort: DIAS_SHORT.slice(0, 5),
    vendId: vend.id,
    gestionMap,
    feriadosMap,
    FER,
    S,
  }));
  compDaysFrame.appendChild(compDaysInner);

  compBlock.appendChild(labelsComp);
  compBlock.appendChild(compDaysFrame);

  const ventBlock = document.createElement("div");
  ventBlock.style.display = "flex";
  ventBlock.style.alignItems = "flex-start";

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
  ventDaysInner.appendChild(buildDaysTableVentas({
    fechas: fechas7,
    diasShort: DIAS_SHORT,
    vendId: vend.id,
    ventasMap,
    feriadosMap,
    FER,
    S,
  }));
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

  function buildDaysTableCompromisos({ tipos, fechas, diasShort, vendId, gestionMap, feriadosMap, FER, S }) {
    const tbl = document.createElement("table");
    tbl.style.borderCollapse = "separate";
    tbl.style.borderSpacing = "0";
    tbl.style.fontSize = S.fontSize;
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
      th.style.minWidth = `${S.dayMinW}px`;

      const fIso = fechas[d];
      const fer = feriadosMap?.get?.(fIso) || null;
      if (fer) {
        th.style.background = FER.bg;
        th.style.color = FER.color;
        th.title = feriadoTitle(fer);
      }

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
        td.style.minWidth = `${S.dayMinW}px`;

        const fer = feriadosMap?.get?.(f) || null;
        if (fer) {
          td.style.background = FER.bg;
          td.style.color = FER.color;
          td.style.borderColor = FER.border;
          td.title = feriadoTitle(fer);
        }

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    tbl.appendChild(thead);
    tbl.appendChild(tbody);
    return tbl;
  }

  function buildDaysTableVentas({ fechas, diasShort, vendId, ventasMap, feriadosMap, FER, S }) {
    const tbl = document.createElement("table");
    tbl.style.borderCollapse = "separate";
    tbl.style.borderSpacing = "0";
    tbl.style.fontSize = S.fontSize;
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
      th.style.minWidth = `${S.dayMinW}px`;

      const fIso = fechas[d];
      const fer = feriadosMap?.get?.(fIso) || null;
      if (fer) {
        th.style.background = FER.bg;
        th.style.color = FER.color;
        th.title = feriadoTitle(fer);
      }

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
        td.style.minWidth = `${S.dayMinW}px`;

        const fer = feriadosMap?.get?.(f) || null;
        if (fer) {
          td.style.background = FER.bg;
          td.style.color = FER.color;
          td.style.borderColor = FER.border;
          td.title = feriadoTitle(fer);
        }

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    tbl.appendChild(thead);
    tbl.appendChild(tbody);
    return tbl;
  }
}

// ======================= Dataset loader (por equipo) =======================
async function cargarDatasetEquipo({ equipoId, perfil, userId, ctx }) {
  const weekMondayISO = toISODate(ctx.weekMonday);
  const weekFridayISO = toISODate(ctx.weekFriday);
  const weekSundayISO = toISODate(ctx.weekSunday);

  const mesInicioISO = toISODate(ctx.monthStart);
  const mesFinISO = toISODate(ctx.monthEnd);

  const tramos = await fetchEquipoVendedorTramos(equipoId);
  const { vendorIds, tramosPorVendedor } = tramosVigentesEnRango(tramos, weekMondayISO, weekSundayISO);
  const vendorList = Array.from(vendorIds);

  const [vendedores, ventasSemana, ventasMes, feriadosMap] = await Promise.all([
    fetchVendedoresPorIds(vendorList),
    fetchVentas(vendorList, weekMondayISO, weekSundayISO),
    fetchVentas(vendorList, mesInicioISO, mesFinISO),
    fetchFeriados(weekMondayISO, weekSundayISO),
  ]);

  // Compromisos / tipos
  // - Supervisor: propios + visibles_para_todos (regla)
  // - Zonal: intentar RPC por equipo; si no existe, cae a visibles_para_todos
  let tipos = await fetchTiposCompromisos({ perfil, userId, equipoId });

  let compromisosSemana = [];
  if (String(perfil || "").toLowerCase() === "zonal") {
    // Por equipo (sin filtrar por supervisor). Requiere RLS que permita al zonal ver el equipo.
    compromisosSemana = await fetchGestionPorEquipo(equipoId, weekMondayISO, weekFridayISO);
  } else {
    compromisosSemana = await fetchGestion(equipoId, userId, weekMondayISO, weekFridayISO);
  }

  // Respaldo: si no vienen tipos (RLS/RPC), igual mostramos lo que exista en compromisos
  tipos = await asegurarTiposDesdeCompromisos(tipos, compromisosSemana);

  return {
    perfil,
    userId,
    equipoId,
    ctx,
    vendedores,
    tipos,
    feriadosMap,
    gestionMap: buildGestionMap(compromisosSemana),
    ventasMap: buildVentasMap(ventasSemana, tramosPorVendedor),
    ventasAcumuladasMes: buildVentasAcumuladoMap(ventasMes, tramosPorVendedor),
  };
}

async function cargarResumenEquipoVentasMes({ equipoId, ctx }) {
  const mesInicioISO = toISODate(ctx.monthStart);
  const mesFinISO = toISODate(ctx.monthEnd);

  const tramos = await fetchEquipoVendedorTramos(equipoId);
  const { vendorIds, tramosPorVendedor } = tramosVigentesEnRango(tramos, mesInicioISO, mesFinISO);
  const vendorList = Array.from(vendorIds);

  const ventasMes = await fetchVentas(vendorList, mesInicioISO, mesFinISO);
  const ventasAcumuladasMes = buildVentasAcumuladoMap(ventasMes, tramosPorVendedor);

  // Sumatoria por equipo
  const accEquipo = { Tope: 0, Sobre: 0, Bajo: 0, Plan: 0, "Saldo PV": 0 };
  for (const vid of Object.keys(ventasAcumuladasMes || {})) {
    const a = ventasAcumuladasMes[vid] || {};
    accEquipo.Tope += clampMonto(a["Tope"] || 0);
    accEquipo.Sobre += clampMonto(a["Sobre"] || 0);
    accEquipo.Bajo += clampMonto(a["Bajo"] || 0);
    accEquipo.Plan += clampMonto(a["Plan"] || 0);
    accEquipo["Saldo PV"] += clampMonto(a["Saldo PV"] || 0);
  }

  // clamp final
  accEquipo.Tope = clampMonto(accEquipo.Tope);
  accEquipo.Sobre = clampMonto(accEquipo.Sobre);
  accEquipo.Bajo = clampMonto(accEquipo.Bajo);
  accEquipo.Plan = clampMonto(accEquipo.Plan);
  accEquipo["Saldo PV"] = clampMonto(accEquipo["Saldo PV"]);

  return accEquipo;
}

// ======================= Render supervisor (sin agrupación) =======================
function renderReporte(ds) {
  renderVendedoresEnContenedor(ds, elReporte);
}

// ======================= Render zonal (zona -> equipos -> vendedores) =======================
function renderZonalEstructura({ zonasAsignadas, ctx, userId }) {
  elReporte.innerHTML = "";

  if (!zonasAsignadas.length) {
    elReporte.innerHTML = `<div style="padding:10px 0;">Sin zonas asignadas para la fecha seleccionada.</div>`;
    return;
  }

  zonasAsignadas.forEach((z) => {
    const zonaBox = document.createElement("div");
    zonaBox.style.border = "1px solid rgba(0,0,0,0.08)";
    zonaBox.style.borderRadius = "10px";
    zonaBox.style.padding = "10px";
    zonaBox.style.margin = "10px 0";
    zonaBox.style.background = "rgba(255,255,255,0.7)";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "baseline";
    head.style.gap = "10px";
    head.style.marginBottom = "8px";

    const titulo = document.createElement("div");
    titulo.style.fontWeight = "800";
    titulo.textContent = `Zona: ${z.zona_nombre}`;

    const sub = document.createElement("div");
    sub.style.opacity = "0.85";
    sub.style.fontSize = "12px";
    const tag = z.es_principal ? "Principal" : "Suplencia";
    const extra = (!z.es_principal && z.motivo_suplencia) ? ` — ${z.motivo_suplencia}` : "";
    sub.textContent = `Zonal: ${z.zonal_nombre} (${tag}${extra})`;

    head.appendChild(titulo);
    head.appendChild(sub);
    zonaBox.appendChild(head);

    // Ordenamiento de equipos (habilitado)
    const equiposOrderBar = document.createElement("div");
    equiposOrderBar.style.display = "flex";
    equiposOrderBar.style.alignItems = "center";
    equiposOrderBar.style.gap = "10px";
    equiposOrderBar.style.margin = "6px 0 8px";

    const equiposOrderLbl = document.createElement("span");
    equiposOrderLbl.textContent = "Orden equipos:";
    equiposOrderLbl.style.fontWeight = "700";
    equiposOrderLbl.style.fontSize = "12px";

    const equiposOrderSel = document.createElement("select");
    equiposOrderSel.style.fontSize = "12px";
    equiposOrderSel.style.padding = "4px 6px";
    equiposOrderSel.style.borderRadius = "8px";

    const optA = document.createElement("option");
    optA.value = "nombre_asc";
    optA.textContent = "Nombre (A→Z)";
    const optD = document.createElement("option");
    optD.value = "nombre_desc";
    optD.textContent = "Nombre (Z→A)";
    equiposOrderSel.appendChild(optA);
    equiposOrderSel.appendChild(optD);

    window.__cv_team_sort_mode = window.__cv_team_sort_mode || "nombre_asc";
    equiposOrderSel.value = window.__cv_team_sort_mode;

    equiposOrderBar.appendChild(equiposOrderLbl);
    equiposOrderBar.appendChild(equiposOrderSel);
    zonaBox.appendChild(equiposOrderBar);

    const equiposWrap = document.createElement("div");
    equiposWrap.textContent = "Cargando equipos…";
    zonaBox.appendChild(equiposWrap);

    elReporte.appendChild(zonaBox);

    // Carga equipos async por zona
    (async () => {
      try {
        const refISO = isoRefFromCtx(ctx);
        const equipos = await fetchEquiposDeZona(z.id_zona, refISO);

        if (!equipos.length) {
          equiposWrap.innerHTML = `<div style="padding:6px 0; opacity:0.8;">Sin equipos vigentes en esta zona.</div>`;
          return;
        }

        const renderEquipos = () => {
          const modo = window.__cv_team_sort_mode || "nombre_asc";
          const ordenados = sortEquipos(equipos, modo);

          equiposWrap.innerHTML = "";
          ordenados.forEach((eq) => {
          const bloqueEq = document.createElement("div");
          bloqueEq.style.padding = "8px 0";
          bloqueEq.style.borderTop = "1px solid rgba(0,0,0,0.06)";

          const filaEq = document.createElement("div");
          filaEq.style.display = "flex";
          filaEq.style.alignItems = "center";
          filaEq.style.gap = "10px";
          filaEq.style.cursor = "pointer";
          filaEq.style.userSelect = "none";

          const tg = document.createElement("span");
          tg.textContent = "+";
          tg.style.fontWeight = "900";
          tg.style.width = "18px";
          tg.style.textAlign = "center";

          const nm = document.createElement("span");
          nm.style.fontWeight = "700";
          nm.textContent = eq.nombre;

          const spacer = document.createElement("div");
          spacer.style.flex = "1";

          // Acumulado mensual a nivel equipo (visible incluso sin expandir)
          const accPlaceholder = { Tope: 0, Sobre: 0, Bajo: 0, Plan: 0, "Saldo PV": 0 };
          const acumuladoEquipo = buildAcumuladoGrid(accPlaceholder);

          // cargar en background el resumen por equipo
          (async () => {
            try {
              const acc = await cargarResumenEquipoVentasMes({ equipoId: eq.id_equipo, ctx });
              const nuevo = buildAcumuladoGrid(acc);
              acumuladoEquipo.replaceWith(nuevo);
            } catch (e) {
              // si falla, dejamos el placeholder en 0 sin romper la UI
              console.warn("Resumen ventas equipo no disponible", e);
            }
          })();

          filaEq.appendChild(tg);
          filaEq.appendChild(nm);
          filaEq.appendChild(spacer);
          filaEq.appendChild(acumuladoEquipo);

          const panelEq = document.createElement("div");
          panelEq.style.display = "none";
          panelEq.style.marginTop = "8px";
          panelEq.style.paddingLeft = "28px";
          panelEq.innerHTML = `<div style="opacity:0.8;">(sin cargar)</div>`;

          let loaded = false;

          filaEq.addEventListener("click", async () => {
            const abierto = panelEq.style.display !== "none";
            if (abierto) {
              panelEq.style.display = "none";
              tg.textContent = "+";
              return;
            }

            panelEq.style.display = "block";
            tg.textContent = "−";

            if (loaded) return;

            try {
              panelEq.innerHTML = `<div style="opacity:0.8;">Cargando vendedores…</div>`;
              const ds = await cargarDatasetEquipo({ equipoId: eq.id_equipo, perfil: "zonal", userId, ctx });
              DATASET_BY_TEAM.set(eq.id_equipo, ds);
              panelEq.innerHTML = "";
              renderVendedoresEnContenedor(ds, panelEq);
              loaded = true;
            } catch (e) {
              console.error(e);
              panelEq.innerHTML = `<div style="color:#b00020;">Error: ${e?.message || e}</div>`;
            }
          });

          bloqueEq.appendChild(filaEq);
          bloqueEq.appendChild(panelEq);
          equiposWrap.appendChild(bloqueEq);
          });
        };

        // bind sort selector
        equiposOrderSel.addEventListener("change", () => {
          window.__cv_team_sort_mode = equiposOrderSel.value;
          renderEquipos();
        });

        renderEquipos();
      } catch (e) {
        console.error(e);
        equiposWrap.innerHTML = `<div style="color:#b00020;">Error: ${e?.message || e}</div>`;
      }
    })();
  });
}

// ======================= Excel (mínimo) =======================
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

function exportarExcelDataset(ds, nombreArchivo) {
  if (!window.XLSX) throw new Error("No se cargó XLSX (SheetJS).");
  const XLSX = window.XLSX;

  const fechas7 = Array.from({ length: 7 }, (_, i) => toISODate(addDays(ds.ctx.weekMonday, i)));
  const fechas5 = fechas7.slice(0, 5);

  const wb = XLSX.utils.book_new();

  for (const v of ds.vendedores) {
    const aoa = [];
    aoa.push([String(v.nombre || "Vendedor")]);
    aoa.push([`${toISODate(ds.ctx.weekMonday)} a ${toISODate(ds.ctx.weekSunday)}`]);
    aoa.push([""]);

    // Compromisos (si aplica)
    if ((ds.tipos || []).length) {
      aoa.push(["Compromiso", "Lu", "Ma", "Mi", "Ju", "Vi"]);
      for (const tc of ds.tipos) {
        const r = [tc.descripcion || ""];
        for (let d = 0; d < 5; d++) {
          const f = fechas5[d];
          r.push(ds.gestionMap[v.id]?.[tc.id]?.[f] ?? "");
        }
        aoa.push(r);
      }
      aoa.push([""]);
    }

    // Ventas
    aoa.push(["Tipo", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"]);
    for (const tv of TIPOS_VENTA) {
      const r = [tv];
      for (let d = 0; d < 7; d++) {
        const f = fechas7[d];
        r.push(ds.ventasMap[v.id]?.[f]?.[tv] ?? "");
      }
      aoa.push(r);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, String(v.nombre || "Vendedor").slice(0, 31));
  }

  XLSX.writeFile(wb, nombreArchivo);
}

// ======================= Orquestación =======================
async function refrescar() {
  try {
    estado("");
    if (!elReporte) return;

    const userId = await getUserId();
    if (!userId) throw new Error("Sesión inválida.");

    const perfil = await getPerfilActual(userId);

    // default fecha
    if (elDia && !elDia.value) elDia.value = defaultDateInputValue();

    const ctx = parseInputToContext(elDia?.value || defaultDateInputValue());
    setRangoLabel(ctx);

    // Limpieza de caches
    DATASET = null;
    DATASET_BY_TEAM.clear();
    elReporte.innerHTML = "";

    if (perfil === "zonal") {
      estado("Cargando zonas…");
      const refISO = isoRefFromCtx(ctx);
      const zonasAsignadas = await fetchZonasAsignadasAZonal(userId, refISO);
      estado("");
      renderZonalEstructura({ zonasAsignadas, ctx, userId });
      return;
    }

    // Supervisor / Admin / etc: vista actual por equipo
    const equipoId = getEquipoIdActual();
    if (!equipoId) throw new Error("No se encontró equipo activo.");

    estado("Cargando datos…");
    const ds = await cargarDatasetEquipo({ equipoId, perfil, userId, ctx });
    DATASET = ds;
    estado("");
    renderReporte(ds);
  } catch (e) {
    console.error(e);
    estado(`Error: ${e?.message || e}`, true);
  }
}

// ======================= Eventos =======================
btnVolver?.addEventListener("click", (e) => {
  e?.preventDefault?.();
  window.dispatchEvent(new Event("reportes:volver"));
});

btnExcel?.addEventListener("click", async () => {
  try {
    await asegurarXLSX();

    // Supervisor: exporta dataset actual
    if (DATASET) {
      exportarExcelDataset(DATASET, `compromiso-ventas_${toISODate(DATASET.ctx.weekMonday)}_${toISODate(DATASET.ctx.weekSunday)}.xlsx`);
      return;
    }

    // Zonal: si hay equipos cargados, exporta el primero cargado (para no inventar “multi-workbook”)
    const first = DATASET_BY_TEAM.values().next().value;
    if (first) {
      exportarExcelDataset(first, `compromiso-ventas_${toISODate(first.ctx.weekMonday)}_${toISODate(first.ctx.weekSunday)}.xlsx`);
      return;
    }

    throw new Error("No hay datos cargados para exportar.");
  } catch (e) {
    alert(e?.message || String(e));
  }
});

elDia?.addEventListener("change", refrescar);

(function bindOrdenEquiposSelector() {
  const sel =
    document.getElementById("selectOrdenEquipos") ||
    document.getElementById("equiposSort") ||
    document.getElementById("ordenEquipos");
  if (!sel) return;
  if (window.__cv_orden_equipos_listener_bound) return;
  window.__cv_orden_equipos_listener_bound = true;

  // habilitar si venía bloqueado
  sel.disabled = false;

  sel.addEventListener("change", refrescar);
  sel.addEventListener("input", refrescar);
})();

(function bindEquipoSelector() {
  const sel = document.getElementById("selectEquipo");
  if (!sel) return;
  if (window.__cv_equipo_listener_bound) return;
  window.__cv_equipo_listener_bound = true;
  sel.addEventListener("change", refrescar);
})();

(function init() {
  if (elDia && !elDia.value) elDia.value = defaultDateInputValue();
  refrescar();
})();
