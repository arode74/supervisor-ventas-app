// scripts/reporte-ventas-semana.js
// Reporte Ventas (Semanal) - APP Ventas
//
// Reglas (SIN DECIMALES):
// - Fuente: public.ventas
// - Columnas semana: TOPE / SOBRE / BAJO / PLAN (suma de la semana Lu–Vi que contiene el día seleccionado)
// - Columnas mes:    MES_TOPE / MES_SOBRE / MES_BAJO / MES_PLAN (suma del mes del día seleccionado)
// - TOTAL SEMANA = TOPE + SOBRE + BAJO + PLAN
// - TOTAL MES    = MES_TOPE + MES_SOBRE + MES_BAJO + MES_PLAN
//
// Equipo–vendedor vía public.equipo_vendedor (incluye vendedores sin ventas => 0).
//
// Comportamiento por rol:
// - Supervisor (y similares): muestra SOLO el equipo actualmente seleccionado (principal o suplente) vía #selectEquipo.
//   * Si #selectEquipo tiene "ALL", muestra todos los equipos visibles.
// - Zonal: muestra TODOS los equipos de las zonas asignadas al zonal (zona_zonal -> zona_equipo),
//          ordenado por Equipo ASC y dentro por Vendedor ASC.
//
// Nota: cuando este módulo se embebe vía innerHTML, los <script> inline del HTML no ejecutan.
// Por eso garantizamos aquí que el combo de Día tenga opciones y un valor visible.

if (!window.supabase) throw new Error("Supabase no inicializado en window");
const supabase = window.supabase;

// ======================= Estado global (para depuración y consistencia) =======================
// Fuente única para p_dia (YYYY-MM-DD) usado por RPCs de Resumen/Detalle.
window.__AV_REP_SEMANA_STATE = window.__AV_REP_SEMANA_STATE || { };

// ======================= DOM =======================
const $ = (id) => document.getElementById(id);

// Preferimos IDs con sufijo "Semana"; si no existen, usamos fallback a los del reporte mensual.
const elDia =
  $("selectDiaVentasSemana") ||
  $("selectDiaVentas") ||
  null;

const elRango =
  $("labelRangoVentasSemana") ||
  $("labelRangoVentas") ||
  null;

const elReporte =
  $("contenedorReporteVentasSemana") ||
  $("contenedorReporteVentas") ||
  null;

const elCarga =
  $("estadoCargaVentasSemana") ||
  $("estadoCargaVentas") ||
  null;

const btnVolver =
  $("btnVolverReporteVentasSemana") ||
  $("btnVolverReporteVentas") ||
  null;

const btnExcel =
  $("btnExcelVentasSemana") ||
  $("btnExcelVentas") ||
  null;

const elOrden =
  $("selectOrdenVentasSemana") ||
  $("selectOrdenVentas") ||
  null;

// Dataset para export
let DATASET = null; // { mode, monthStartISO, monthEndISO, weekStartISO, weekEndISO, teams[] | equipoNombre/rows/tot }

// ======================= UI helpers =======================
function estado(msg, esError = false) {
  if (!elCarga) return;
  elCarga.textContent = msg || "";
  elCarga.style.color = esError ? "#b00020" : "";
}

// SIN DECIMALES
const MAX_MONTO = 999_999_999_999;
function clampMonto(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  return Math.min(Math.trunc(num), MAX_MONTO);
}
function formatCLP(n) {
  const num = clampMonto(n);
  return num.toLocaleString("es-CL");
}
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

// ======================= Día (combo) =======================
function ensureDiaOptions() {
  if (!elDia) return;

  const hasOptions = elDia.options && elDia.options.length > 0;
  const currentVal = String(elDia.value || "").trim();

  let base = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(currentVal)) {
    const d = new Date(`${currentVal}T00:00:00`);
    if (!Number.isNaN(d.getTime())) base = d;
  }
  if (!base) base = new Date();

  const y = base.getFullYear();
  const m = base.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let valueExists = false;
  if (hasOptions && currentVal) {
    for (const opt of elDia.options) {
      if (opt && opt.value === currentVal) { valueExists = true; break; }
    }
  }

  if (!hasOptions || (currentVal && !valueExists)) {
    const prev = currentVal;
    elDia.innerHTML = "";
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      dt.setHours(0, 0, 0, 0);
      const iso = toISO(dt);
      const opt = document.createElement("option");
      opt.value = iso;
      opt.textContent = iso;
      elDia.appendChild(opt);
    }

    const fallback = toISO(new Date());
    elDia.value = prev && /^\d{4}-\d{2}-\d{2}$/.test(prev) ? prev : fallback;

    let ok = false;
    for (const opt of elDia.options) {
      if (opt && opt.value === elDia.value) { ok = true; break; }
    }
    if (!ok) elDia.value = fallback;
  }
}

// ======================= Fechas =======================
function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function fmtDMY(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
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
function parseSelectedDay(value) {
  const raw = String(value || "").trim();
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida (formato esperado: YYYY-MM-DD)");
  return d;
}
function iso10(x) { return x ? String(x).slice(0, 10) : null; }

// Semana Lu–Vi (si el día cae en sábado/domingo, igual tomamos la semana Lu–Vi anterior)
function weekBoundsMonFri(dateObj) {
  const d = new Date(dateObj.getTime());
  d.setHours(0,0,0,0);

  // JS: 0=Dom,1=Lun,...6=Sab
  const dow = d.getDay();

  // Normalizamos: si es sábado (6) => tratamos como viernes; si domingo (0) => tratamos como lunes? mejor lunes de esa semana:
  // Lo consistente para reporte semanal: semana Lu–Vi que "contiene" el día.
  // Si es sábado: retrocede 1 día; si domingo: retrocede 2 días (a viernes).
  if (dow === 6) d.setDate(d.getDate() - 1);
  if (dow === 0) d.setDate(d.getDate() - 2);

  const dow2 = d.getDay(); // ahora 1..5 esperado
  const deltaToMon = (dow2 === 0 ? 6 : dow2 - 1); // si fuera domingo, etc.
  const mon = new Date(d.getTime());
  mon.setDate(mon.getDate() - deltaToMon);
  mon.setHours(0,0,0,0);

  const fri = new Date(mon.getTime());
  fri.setDate(fri.getDate() + 4);
  fri.setHours(0,0,0,0);

  return { mon, fri };
}

function setRangoLabel(ctx) {
  if (!elRango) return;
  elRango.textContent = `Semana: ${fmtDMY(ctx.weekStart)} a ${fmtDMY(ctx.weekEnd)}  |  Mes: ${fmtDMY(ctx.monthStart)} a ${fmtDMY(ctx.monthEnd)}`;
}

// ======================= Auth / Perfil =======================
async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}
async function getPerfilActual(userId) {
  try {
    const { data, error } = await supabase.rpc("get_perfil_actual", { p_user_id: userId });
    if (!error && data) return String(data).trim().toLowerCase();
  } catch (_) {}
  const keys = ["perfil_actual", "perfilActual", "appventas_perfil", "role"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return String(v).trim().toLowerCase();
  }
  return "supervisor";
}

// ======================= Equipo actual (supervisor) =======================
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

// ======================= Vigencia =======================
function vigente(fechaInicio, fechaFin, refISO) {
  const fi = iso10(fechaInicio) || "0000-01-01";
  const ff = iso10(fechaFin) || "9999-12-31";
  return fi <= refISO && refISO <= ff;
}

// ======================= Fetch base =======================
async function fetchEquipoNombre(equipoId) {
  const { data, error } = await supabase
    .from("equipos")
    .select("id_equipo, nombre_equipo")
    .eq("id_equipo", equipoId)
    .maybeSingle();
  if (error) throw new Error(`Error equipos: ${error.message}`);
  return data?.nombre_equipo || "";
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

    const fi = iso10(t.fecha_inicio);
    const ff = iso10(t.fecha_fin);

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

  return (data || []).map((v) => ({ id: v.id_vendedor, nombre: v.nombre || "" }));
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

// ======================= Zonal: zonas y equipos =======================
async function fetchZonaIdsAsignadasAZonal(userId, refISO) {
  const { data: zz, error } = await supabase
    .from("zona_zonal")
    .select("id_zona, fecha_inicio, fecha_fin, estado")
    .eq("id_zonal", userId);

  if (error) throw new Error(`Error zona_zonal: ${error.message}`);

  const zonaIds = Array.from(
    new Set(
      (zz || [])
        .filter((r) => r?.estado !== false)
        .filter((r) => vigente(r.fecha_inicio, r.fecha_fin, refISO))
        .map((r) => r.id_zona)
        .filter(Boolean)
    )
  );

  return zonaIds;
}

async function fetchEquiposDeZonas(zonaIds, refISO) {
  if (!zonaIds.length) return [];

  const { data: ze, error } = await supabase
    .from("zona_equipo")
    .select("id_zona, id_equipo, fecha_inicio, fecha_fin, estado")
    .in("id_zona", zonaIds);

  if (error) throw new Error(`Error zona_equipo: ${error.message}`);

  const ids = Array.from(
    new Set(
      (ze || [])
        .filter((r) => r?.estado !== false)
        .filter((r) => vigente(r.fecha_inicio, r.fecha_fin, refISO))
        .map((r) => r.id_equipo)
        .filter(Boolean)
    )
  );

  if (!ids.length) return [];

  const { data: eq, error: e2 } = await supabase
    .from("equipos")
    .select("id_equipo, nombre_equipo")
    .in("id_equipo", ids)
    .order("nombre_equipo", { ascending: true });

  if (e2) throw new Error(`Error equipos: ${e2.message}`);

  return (eq || []).map((r) => ({ id_equipo: r.id_equipo, nombre_equipo: r.nombre_equipo || "(sin nombre)" }));
}

// ======================= Agregación =======================
function normTipo(txt) {
  return String(txt || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// buildAgg en rango [startISO, endISO], validando tramo vigente por fecha
function buildAggRange(ventasRows, tramosPorVendedor, startISO, endISO) {
  const acc = {}; // acc[vendedorId] = { tope, sobre, bajo, plan }

  for (const r of ventasRows || []) {
    const vid = r.id_vendedor;
    if (!vid) continue;

    const f = iso10(r.fecha_venta);
    if (!f) continue;
    if (startISO && f < startISO) continue;
    if (endISO && f > endISO) continue;

    const tramos = tramosPorVendedor.get(vid) || [];
    const ok = tramos.some((t) => t.fi <= f && f <= t.ff);
    if (!ok) continue;

    const tipo = normTipo(r.tipo_venta);
    const monto = clampMonto(r.monto || 0);

    acc[vid] ??= { tope: 0, sobre: 0, bajo: 0, plan: 0 };

    if (tipo === "tope") acc[vid].tope = clampMonto(acc[vid].tope + monto);
    else if (tipo === "sobre") acc[vid].sobre = clampMonto(acc[vid].sobre + monto);
    else if (tipo === "bajo") acc[vid].bajo = clampMonto(acc[vid].bajo + monto);
    else if (tipo === "plan") acc[vid].plan = clampMonto(acc[vid].plan + monto);
  }

  return acc;
}

function computeRow(accRow) {
  const tope = clampMonto(accRow?.tope || 0);
  const sobre = clampMonto(accRow?.sobre || 0);
  const bajo = clampMonto(accRow?.bajo || 0);
  const plan = clampMonto(accRow?.plan || 0);
  const total = clampMonto(tope + sobre + bajo + plan);
  return { tope, sobre, bajo, plan, total };
}

// ======================= Orden (simple) =======================
// Por defecto: Vendedor ASC. Si existe selector, soportamos nombre_desc.
function getOrdenModo() {
  return elOrden?.value || "nombre_asc";
}
function ordenarVendedores(rows, modo) {
  const arr = Array.isArray(rows) ? [...rows] : [];
  const getNombre = (r) => String(r?.aapp ?? "").trim();
  if (modo === "nombre_desc") {
    arr.sort((a, b) => collator.compare(getNombre(b), getNombre(a)));
    return arr;
  }
  arr.sort((a, b) => collator.compare(getNombre(a), getNombre(b)));
  return arr;
}

// ======================= Dataset por equipo =======================
async function cargarDatasetEquipoSemana({ equipoId, monthStartISO, monthEndISO, weekStartISO, weekEndISO }) {
  const equipoNombre = await fetchEquipoNombre(equipoId);

  const tramos = await fetchEquipoVendedorTramos(equipoId);
  const { vendorIds, tramosPorVendedor } = tramosVigentesEnRango(tramos, monthStartISO, monthEndISO);
  const vendorList = Array.from(vendorIds);

  const vendedores = await fetchVendedoresPorIds(vendorList);
  vendedores.sort((a, b) => collator.compare(a.nombre || "", b.nombre || ""));

  // Traemos ventas del MES y de ahí derivamos semana
  const ventasMes = await fetchVentas(vendorList, monthStartISO, monthEndISO);

  const accMes = buildAggRange(ventasMes, tramosPorVendedor, monthStartISO, monthEndISO);
  const accSemana = buildAggRange(ventasMes, tramosPorVendedor, weekStartISO, weekEndISO);

  const rows = [];
  const tot = {
    semana_tope: 0, semana_sobre: 0, semana_bajo: 0, semana_plan: 0, semana_total: 0,
    mes_tope: 0, mes_sobre: 0, mes_bajo: 0, mes_plan: 0, mes_total: 0,
  };

  for (const v of vendedores) {
    const wk = computeRow(accSemana[v.id] || null);
    const ms = computeRow(accMes[v.id] || null);

    rows.push({
      aapp: v.nombre || "",
      equipo: equipoNombre,
      // Semana (Lu–Vi)
      tope: wk.tope,
      sobre: wk.sobre,
      bajo: wk.bajo,
      plan: wk.plan,
      total_semana: wk.total,
      // Mes
      mes_tope: ms.tope,
      mes_sobre: ms.sobre,
      mes_bajo: ms.bajo,
      mes_plan: ms.plan,
      total_mes: ms.total,
    });

    tot.semana_tope = clampMonto(tot.semana_tope + wk.tope);
    tot.semana_sobre = clampMonto(tot.semana_sobre + wk.sobre);
    tot.semana_bajo = clampMonto(tot.semana_bajo + wk.bajo);
    tot.semana_plan = clampMonto(tot.semana_plan + wk.plan);
    tot.semana_total = clampMonto(tot.semana_total + wk.total);

    tot.mes_tope = clampMonto(tot.mes_tope + ms.tope);
    tot.mes_sobre = clampMonto(tot.mes_sobre + ms.sobre);
    tot.mes_bajo = clampMonto(tot.mes_bajo + ms.bajo);
    tot.mes_plan = clampMonto(tot.mes_plan + ms.plan);
    tot.mes_total = clampMonto(tot.mes_total + ms.total);
  }

  const modoOrden = getOrdenModo();
  const rowsOrdenadas = ordenarVendedores(rows, modoOrden);

  return {
    equipoId,
    equipoNombre,
    monthStartISO, monthEndISO,
    weekStartISO, weekEndISO,
    rows: rowsOrdenadas,
    tot,
  };
}

async function cargarDatasetZonalBatchSemana(equipos, monthStartISO, monthEndISO, weekStartISO, weekEndISO) {
  const equipoIds = equipos.map(e => e.id_equipo);

  // Tramos de todos los equipos (1 llamada)
  const { data: tramosAll, error: eTr } = await supabase
    .from("equipo_vendedor")
    .select("id_vendedor, id_equipo, fecha_inicio, fecha_fin, estado")
    .in("id_equipo", equipoIds);

  if (eTr) throw new Error(`Error equipo_vendedor: ${eTr.message}`);

  // Armar por equipo
  const byEquipo = new Map();
  for (const idEq of equipoIds) byEquipo.set(idEq, { tramos: [] });
  for (const t of (tramosAll || [])) {
    if (!t?.id_equipo) continue;
    if (!byEquipo.has(t.id_equipo)) byEquipo.set(t.id_equipo, { tramos: [] });
    byEquipo.get(t.id_equipo).tramos.push(t);
  }

  const vendorsGlobal = new Set();
  const equipoMeta = new Map(equipos.map(e => [e.id_equipo, e.nombre_equipo || "(sin nombre)"]));
  const equipoCtx = new Map();

  for (const [idEq, obj] of byEquipo.entries()) {
    const { vendorIds, tramosPorVendedor } = tramosVigentesEnRango(obj.tramos, monthStartISO, monthEndISO);
    vendorIds.forEach(id => vendorsGlobal.add(id));
    equipoCtx.set(idEq, { vendorIds: Array.from(vendorIds), tramosPorVendedor });
  }

  const vendorList = Array.from(vendorsGlobal);

  // Vendedores (1 llamada)
  const vendedoresAll = await fetchVendedoresPorIds(vendorList);
  const vendedorById = new Map(vendedoresAll.map(v => [v.id, { nombre: v.nombre || "" }]));

  // Ventas del mes (1 llamada)
  const ventasAll = await fetchVentas(vendorList, monthStartISO, monthEndISO);

  // Pre-group por vendedor
  const ventasByVendor = new Map();
  for (const v of ventasAll) {
    if (!v?.id_vendedor) continue;
    if (!ventasByVendor.has(v.id_vendedor)) ventasByVendor.set(v.id_vendedor, []);
    ventasByVendor.get(v.id_vendedor).push(v);
  }

  const teams = [];
  const modoOrden = getOrdenModo();

  for (const eq of equipos) {
    const ctx = equipoCtx.get(eq.id_equipo) || { vendorIds: [], tramosPorVendedor: new Map() };
    const vendorIdsEq = ctx.vendorIds || [];
    const tramosPorVendedor = ctx.tramosPorVendedor || new Map();

    const vendedoresEq = vendorIdsEq
      .map(id => ({ id, nombre: vendedorById.get(id)?.nombre || "" }))
      .sort((a, b) => collator.compare(a.nombre || "", b.nombre || ""));

    // Ventas del equipo (sin re-scan global completo)
    const ventasEq = [];
    for (const id of vendorIdsEq) {
      const arr = ventasByVendor.get(id);
      if (arr?.length) ventasEq.push(...arr);
    }

    const accMes = buildAggRange(ventasEq, tramosPorVendedor, monthStartISO, monthEndISO);
    const accSemana = buildAggRange(ventasEq, tramosPorVendedor, weekStartISO, weekEndISO);

    const rows = [];
    const tot = {
      semana_tope: 0, semana_sobre: 0, semana_bajo: 0, semana_plan: 0, semana_total: 0,
      mes_tope: 0, mes_sobre: 0, mes_bajo: 0, mes_plan: 0, mes_total: 0,
    };

    for (const v of vendedoresEq) {
      const wk = computeRow(accSemana[v.id] || null);
      const ms = computeRow(accMes[v.id] || null);

      rows.push({
        aapp: v.nombre || "",
        equipo: equipoMeta.get(eq.id_equipo) || eq.nombre_equipo || "(sin nombre)",
        tope: wk.tope, sobre: wk.sobre, bajo: wk.bajo, plan: wk.plan, total_semana: wk.total,
        mes_tope: ms.tope, mes_sobre: ms.sobre, mes_bajo: ms.bajo, mes_plan: ms.plan, total_mes: ms.total,
      });

      tot.semana_tope = clampMonto(tot.semana_tope + wk.tope);
      tot.semana_sobre = clampMonto(tot.semana_sobre + wk.sobre);
      tot.semana_bajo = clampMonto(tot.semana_bajo + wk.bajo);
      tot.semana_plan = clampMonto(tot.semana_plan + wk.plan);
      tot.semana_total = clampMonto(tot.semana_total + wk.total);

      tot.mes_tope = clampMonto(tot.mes_tope + ms.tope);
      tot.mes_sobre = clampMonto(tot.mes_sobre + ms.sobre);
      tot.mes_bajo = clampMonto(tot.mes_bajo + ms.bajo);
      tot.mes_plan = clampMonto(tot.mes_plan + ms.plan);
      tot.mes_total = clampMonto(tot.mes_total + ms.total);
    }

    teams.push({
      equipoId: eq.id_equipo,
      equipoNombre: equipoMeta.get(eq.id_equipo) || eq.nombre_equipo || "(sin nombre)",
      rows: ordenarVendedores(rows, modoOrden),
      tot,
    });
  }

  teams.sort((a, b) => collator.compare(a.equipoNombre || "", b.equipoNombre || ""));
  return teams;
}

// ======================= Render =======================
function makeTableCardSemana({ titulo, subtitulo, rows, tot }) {
  const card = document.createElement("div");
  card.style.border = "1px solid rgba(0,0,0,0.08)";
  card.style.borderRadius = "10px";
  card.style.padding = "12px";
  card.style.background = "rgba(255,255,255,0.7)";
  card.style.marginBottom = "14px";

  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.justifyContent = "space-between";
  head.style.alignItems = "baseline";
  head.style.gap = "10px";
  head.style.flexWrap = "wrap";

  const hL = document.createElement("div");
  hL.style.fontWeight = "700";
  hL.style.whiteSpace = "nowrap";
  hL.style.fontSize = "14px";
  hL.textContent = titulo;

  const hR = document.createElement("div");
  hR.style.opacity = "0.85";
  hR.style.fontSize = "12px";
  hR.textContent = subtitulo;

  head.appendChild(hL);
  head.appendChild(hR);
  card.appendChild(head);

  const tbl = document.createElement("table");
  tbl.style.width = "100%";
  tbl.style.borderCollapse = "separate";
  tbl.style.borderSpacing = "0";
  tbl.style.marginTop = "10px";
  tbl.style.fontSize = "11px";
  tbl.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
  tbl.style.borderRadius = "10px";
  tbl.style.overflow = "hidden";

  // Detalle por vendedor: no mostrar columna EQUIPO (ya está en el título del equipo)
  const cols = [
    "AAPP",
    "TOPE",
    "SOBRE",
    "BAJO",
    "PLAN",
    "TOTAL SEMANA",
    "MES TOPE",
    "MES SOBRE",
    "MES BAJO",
    "MES PLAN",
    "TOTAL MES",
  ];

  // Header 2 líneas (Semana / Acumulado Mes)
const thead = document.createElement("thead");

const mkTh = (txt, opts = {}) => {
  const th = document.createElement("th");
  th.textContent = txt;
  th.style.background = "#cfe3f7";
  th.style.border = "1px solid rgba(0,0,0,0.12)";
  th.style.padding = "6px 8px";
  th.style.whiteSpace = "nowrap";
  th.style.textAlign = opts.align || "center";
  if (opts.rowspan) th.rowSpan = opts.rowspan;
  if (opts.colspan) th.colSpan = opts.colspan;
  return th;
};

const tr1 = document.createElement("tr");
tr1.appendChild(mkTh("AAPP", { rowspan: 2, align: "left" }));
tr1.appendChild(mkTh("Semana", { colspan: 5 }));
tr1.appendChild(mkTh("Acumulado Mes", { colspan: 5 }));
thead.appendChild(tr1);

const tr2 = document.createElement("tr");
["Tope","Sobre","Bajo","Plan","Total","Tope","Sobre","Bajo","Plan","Total"].forEach((h) => tr2.appendChild(mkTh(h)));
thead.appendChild(tr2);

tbl.appendChild(thead);

  const tbody = document.createElement("tbody");

  (rows || []).forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.style.background = idx % 2 ? "rgba(255,255,255,0.65)" : "white";

    const tdA = document.createElement("td");
    // Nombre vendedor en AAPP (compatibilidad con distintas fuentes)
    tdA.textContent = r.vendedor || r.nombre || r.aapp || "";
    tdA.style.border = "1px solid rgba(0,0,0,0.12)";
    tdA.style.padding = "6px 8px";
    tdA.style.textAlign = "left";
    tdA.style.whiteSpace = "normal";
    tdA.style.maxWidth = "180px";
    tdA.style.lineHeight = "1.2";

    tr.appendChild(tdA);

    const cells = [
      formatCLP(r.tope),
      formatCLP(r.sobre),
      formatCLP(r.bajo),
      formatCLP(r.plan),
      formatCLP(r.total_semana),
      formatCLP(r.mes_tope),
      formatCLP(r.mes_sobre),
      formatCLP(r.mes_bajo),
      formatCLP(r.mes_plan),
      formatCLP(r.total_mes),
    ];

    cells.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      td.style.border = "1px solid rgba(0,0,0,0.12)";
      td.style.padding = "6px 8px";
      td.style.textAlign = "right";
      td.style.whiteSpace = "nowrap";
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  // TOTAL
  const trT = document.createElement("tr");
  trT.style.background = "#f2f6fb";
  trT.style.fontWeight = "800";

  const tdT0 = document.createElement("td");
  tdT0.textContent = "TOTAL";
  tdT0.style.border = "1px solid rgba(0,0,0,0.12)";
  tdT0.style.padding = "6px 8px";
  tdT0.style.textAlign = "left";

  trT.appendChild(tdT0);

  const totCells = [
    formatCLP(tot.semana_tope),
    formatCLP(tot.semana_sobre),
    formatCLP(tot.semana_bajo),
    formatCLP(tot.semana_plan),
    formatCLP(tot.semana_total),
    formatCLP(tot.mes_tope),
    formatCLP(tot.mes_sobre),
    formatCLP(tot.mes_bajo),
    formatCLP(tot.mes_plan),
    formatCLP(tot.mes_total),
  ];

  totCells.forEach((val) => {
    const td = document.createElement("td");
    td.textContent = val;
    td.style.border = "1px solid rgba(0,0,0,0.12)";
    td.style.padding = "6px 8px";
    td.style.textAlign = "right";
    td.style.whiteSpace = "nowrap";
    trT.appendChild(td);
  });

  tbody.appendChild(trT);

  tbl.appendChild(tbody);
  card.appendChild(tbl);
  return card;
}

function renderSupervisor(ds) {
  if (!elReporte) return;
  elReporte.innerHTML = "";
  const card = makeTableCardSemana({
    titulo: `Equipo: ${ds.equipoNombre || "(sin nombre)"}`,
    subtitulo: `Semana: ${ds.weekStartISO} a ${ds.weekEndISO} | Mes: ${ds.monthStartISO} a ${ds.monthEndISO}`,
    rows: ds.rows,
    tot: ds.tot,
  });
  elReporte.appendChild(card);
}

function byId(id) { return document.getElementById(id); }
function scrollToEl(el) {
  try {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (_) {}
}

function renderZonal(dsZ) {
  if (!elReporte) return;
  elReporte.innerHTML = "";

  // ===== Resumen por equipo (primero) =====
  const resumenAnchorId = "rvs_resumen";
  const wrapResumen = document.createElement("div");
  wrapResumen.id = resumenAnchorId;

  const card = document.createElement("div");
  card.style.border = "1px solid rgba(0,0,0,0.08)";
  card.style.borderRadius = "10px";
  card.style.padding = "12px";
  card.style.background = "rgba(255,255,255,0.7)";
  card.style.marginBottom = "14px";

  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.justifyContent = "space-between";
  head.style.alignItems = "baseline";
  head.style.gap = "10px";
  head.style.flexWrap = "wrap";

  const hL = document.createElement("div");
  hL.style.fontWeight = "700";
  hL.style.whiteSpace = "nowrap";
  hL.style.fontSize = "14px";
  hL.textContent = "Resumen por Equipo";

  const hR = document.createElement("div");
  hR.style.opacity = "0.85";
  hR.style.fontSize = "12px";
  hR.textContent = `Semana: ${dsZ.weekStartISO} a ${dsZ.weekEndISO} | Mes: ${dsZ.monthStartISO} a ${dsZ.monthEndISO}`;

  head.appendChild(hL);
  head.appendChild(hR);
  card.appendChild(head);

  const tbl = document.createElement("table");
  tbl.style.width = "100%";
  tbl.style.borderCollapse = "separate";
  tbl.style.borderSpacing = "0";
  tbl.style.marginTop = "10px";
  tbl.style.fontSize = "11px";
  tbl.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
  tbl.style.borderRadius = "10px";
  tbl.style.overflow = "hidden";

  const cols = [
    "EQUIPO",
    "SEM TOPE","SEM SOBRE","SEM BAJO","SEM PLAN","TOTAL SEM",
    "MES TOPE","MES SOBRE","MES BAJO","MES PLAN","TOTAL MES",
  ];

  // Header 2 líneas (Semana / Acumulado Mes)
const thead = document.createElement("thead");

const mkTh = (txt, opts = {}) => {
  const th = document.createElement("th");
  th.textContent = txt;
  th.style.background = "#cfe3f7";
  th.style.border = "1px solid rgba(0,0,0,0.12)";
  th.style.padding = "6px 8px";
  th.style.whiteSpace = "nowrap";
  th.style.textAlign = opts.align || "center";
  if (opts.rowspan) th.rowSpan = opts.rowspan;
  if (opts.colspan) th.colSpan = opts.colspan;
  return th;
};

const tr1 = document.createElement("tr");
tr1.appendChild(mkTh("APP", { rowspan: 2, align: "left" }));
tr1.appendChild(mkTh("Equipo", { rowspan: 2, align: "left" }));
tr1.appendChild(mkTh("Semana", { colspan: 5 }));
tr1.appendChild(mkTh("Acumulado Mes", { colspan: 5 }));
thead.appendChild(tr1);

const tr2 = document.createElement("tr");
["Tope","Sobre","Bajo","Plan","Total","Tope","Sobre","Bajo","Plan","Total"].forEach((h) => tr2.appendChild(mkTh(h)));
thead.appendChild(tr2);

tbl.appendChild(thead);

  const tbody = document.createElement("tbody");
  dsZ.teams.forEach((t, idx) => {
    const r = t.tot;
    const tr = document.createElement("tr");
    tr.style.background = idx % 2 ? "rgba(255,255,255,0.65)" : "white";
    tr.style.cursor = "pointer";

    const tdE = document.createElement("td");
    tdE.textContent = t.equipoNombre || "(sin nombre)";
    tdE.style.border = "1px solid rgba(0,0,0,0.12)";
    tdE.style.padding = "6px 8px";
    tdE.style.textAlign = "left";
    tdE.style.whiteSpace = "nowrap";
    tr.appendChild(tdE);

    const cells = [
      formatCLP(r.semana_tope),
      formatCLP(r.semana_sobre),
      formatCLP(r.semana_bajo),
      formatCLP(r.semana_plan),
      formatCLP(r.semana_total),
      formatCLP(r.mes_tope),
      formatCLP(r.mes_sobre),
      formatCLP(r.mes_bajo),
      formatCLP(r.mes_plan),
      formatCLP(r.mes_total),
    ];
    cells.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      td.style.border = "1px solid rgba(0,0,0,0.12)";
      td.style.padding = "6px 8px";
      td.style.textAlign = "right";
      td.style.whiteSpace = "nowrap";
      tr.appendChild(td);
    });

    const targetId = `rvs_team_${t.equipoId}`;
    tr.addEventListener("click", () => scrollToEl(byId(targetId)));
    tbody.appendChild(tr);
  });

  tbl.appendChild(tbody);
  card.appendChild(tbl);
  wrapResumen.appendChild(card);
  elReporte.appendChild(wrapResumen);

  // ===== Detalle por equipo =====
  for (const t of dsZ.teams) {
    const anchorId = `rvs_team_${t.equipoId}`;
    const detailCard = makeTableCardSemana({
      titulo: `Equipo: ${t.equipoNombre || "(sin nombre)"}`,
      subtitulo: `Semana: ${dsZ.weekStartISO} a ${dsZ.weekEndISO} | Mes: ${dsZ.monthStartISO} a ${dsZ.monthEndISO}`,
      rows: t.rows,
      tot: t.tot,
    });
    detailCard.id = anchorId;

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.padding = "6px 8px";
    footer.style.gap = "6px";

    const mini = document.createElement("button");
    mini.type = "button";
    mini.textContent = "↑";
    mini.title = "Ir al resumen por equipo";
    mini.setAttribute("aria-label","Ir al inicio del reporte");
    mini.style.fontSize = "11px";
    mini.style.padding = "2px 8px";
    mini.style.minWidth = "34px";
    mini.style.borderRadius = "8px";
    mini.style.border = "1px solid rgba(0,0,0,0.18)";
    mini.style.background = "#cfe3f7";
    mini.style.color = "#000";
    mini.style.cursor = "pointer";

    mini.addEventListener("click", (e) => {
      e.preventDefault();
      scrollToEl(byId(resumenAnchorId));
    });

    footer.appendChild(mini);
    detailCard.appendChild(footer);

    elReporte.appendChild(detailCard);
  }

  const sel = document.getElementById("selectEquipo");
  if (sel && sel.value && sel.value !== "ALL") {
    const target = byId(`rvs_team_${sel.value}`);
    if (target) scrollToEl(target);
  }
}
/* ======================= Paso 1 (Flujo) - Resumen por Equipo + Drilldown ======================= */

// RPC helper: intenta variantes de nombres de parámetros (para no romper por mismatch)
async function callRpcVariantes(nombre, variantes) {
  let lastErr = null;
  for (const params of (variantes || [])) {
    try {
      const { data, error } = await supabase.rpc(nombre, params);
      if (error) { lastErr = error; continue; }
      return Array.isArray(data) ? data : (data ? [data] : []);
    } catch (e) {
      lastErr = e;
    }
  }
  const msg = lastErr?.message || String(lastErr || `RPC ${nombre} falló`);
  throw new Error(msg);
}

// Normaliza filas de resumen: garantiza campos claves (id_equipo, equipo, autorizado) sin tocar el resto
function normalizarResumenRPC(rows) {
  const arr = Array.isArray(rows) ? rows : [];
  const out = arr.map(r => {
    const id_equipo = r.id_equipo ?? r.equipo_id ?? r.id ?? null;
    const equipo = r.equipo ?? r.nombre_equipo ?? r.equipo_nombre ?? r.nombre ?? "";
    const autorizado = Boolean(r.autorizado ?? r.is_autorizado ?? r.permitido ?? r.autorizacion ?? false);
    return { ...r, id_equipo, equipo, autorizado };
  });

  // Orden natural por nombre de equipo (evita 1,10,3...)
  out.sort((a, b) => collator.compare(String(a.equipo || ""), String(b.equipo || "")));
  return out;
}

function normalizarDetalleRPC(rows) {
  const arr = Array.isArray(rows) ? rows : [];
  return arr.map(r => {
    const vendedor = r.vendedor ?? r.nombre_vendedor ?? r.nombre ?? r.ejecutivo ?? "";
    const tipo_venta = r.tipo_venta ?? r.tipo ?? r.tipoVenta ?? r.tipo_venta_nombre ?? "";
    const monto = r.monto ?? r.ventas ?? r.valor ?? r.total ?? r.cantidad ?? 0;
    return { ...r, vendedor, tipo_venta, monto };
  });
}

function esPV(tipo) {
  return String(tipo || "").trim().toUpperCase() === "PV";
}

// Modal liviano (crea si no existe)
function asegurarModalRVS() {
  let modal = document.getElementById("rvs_modal_detalle");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "rvs_modal_detalle";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(0,0,0,0.45)";
  modal.style.display = "none";
  modal.style.zIndex = "9999";
  modal.style.padding = "18px";
  modal.style.overflowY = "auto";
  modal.style.boxSizing = "border-box";

  const box = document.createElement("div");
  box.style.boxSizing = "border-box";
  box.style.minWidth = "0";
  box.style.flex = "0 1 auto";

  // ============================================================
  // ANCHO DEFINITIVO: 80% REAL del contenedor "app" (no viewport)
  // Se fija en PX y con prioridad IMPORTANT para que ningún CSS lo pise.
  // ============================================================
  const __getAppWrap = () => {
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;

    // 1) Ancla principal del reporte
    const anchor =
      document.getElementById("rvs_resumen") ||
      document.getElementById("reporte-ventas-semana") ||
      document.querySelector('[data-modulo="reporte-ventas-semanal"]') ||
      document.body;

    // 2) Subimos por el DOM desde el ancla buscando un contenedor que limite ancho
    const climb = (startEl) => {
      let el = startEl;
      for (let i = 0; i < 20 && el && el !== document.body && el !== document.documentElement; i++) {
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        const w = rect ? rect.width : (el.clientWidth || 0);
        if (!w) { el = el.parentElement; continue; }

        const cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
        const maxW = cs ? cs.maxWidth : "none";
        const ml = cs ? cs.marginLeft : "";
        const mr = cs ? cs.marginRight : "";
        const centered = (ml === "auto" || mr === "auto");

        const hasMaxWidth = maxW && maxW !== "none" && maxW !== "0px";
        const isNarrower = vw ? (w < vw * 0.96) : false;

        if ((hasMaxWidth || (centered && isNarrower) || isNarrower) && w >= 520) return el;
        el = el.parentElement;
      }
      return null;
    };

    const fromAnchor = climb(anchor);
    if (fromAnchor) return fromAnchor;

    // 3) Fallbacks típicos de layout
    const candidates = [
      document.querySelector("#app"),
      document.querySelector(".app"),
      document.querySelector(".app-wrap"),
      document.querySelector(".app-container"),
      document.querySelector(".panel-base"),
      document.querySelector(".panel"),
      document.querySelector("main"),
      document.querySelector(".container"),
      document.querySelector(".contenedor")
    ].filter(Boolean);

    for (const c of candidates) {
      const found = climb(c);
      if (found) return found;
    }

    return document.body;
  };

  const __setModalWidth = () => {
    try {
      const wrap = __getAppWrap();
      const rect = wrap && wrap.getBoundingClientRect ? wrap.getBoundingClientRect() : null;
      const w = rect ? rect.width : (wrap && wrap.clientWidth ? wrap.clientWidth : (window.innerWidth || 0));

      // 80% del ancho del contenedor real de la app
      const px = Math.max(520, Math.round(w * 0.80));

      // IMPORTANT para ganarle a cualquier regla externa
      box.style.setProperty("width", px + "px", "important");
      box.style.setProperty("max-width", px + "px", "important");
      box.style.setProperty("margin-left", "auto", "important");
      box.style.setProperty("margin-right", "auto", "important");
    } catch (_) {}
  };

  __setModalWidth();
  window.__rvs_setModalWidth = __setModalWidth;
  window.addEventListener("resize", __setModalWidth);

  box.style.maxHeight = "80vh";
  box.style.position = "relative";
  box.style.margin = "0 auto";
  box.style.background = "#fff";
  box.style.borderRadius = "12px";
  box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
  box.style.overflow = "hidden";

  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.justifyContent = "space-between";
  head.style.alignItems = "center";
  head.style.gap = "10px";
  head.style.padding = "12px 14px";
  head.style.borderBottom = "1px solid rgba(0,0,0,0.10)";

  const title = document.createElement("div");
  title.id = "rvs_modal_titulo";
  title.style.fontWeight = "800";
  title.style.fontSize = "14px";
  title.textContent = "Detalle";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "×";
  btn.setAttribute("aria-label","Cerrar");
  btn.title = "Cerrar";
  btn.style.position = "absolute";
  btn.style.top = "8px";
  btn.style.right = "10px";
  btn.style.fontSize = "22px";
  btn.style.fontWeight = "900";
  btn.style.color = "#1b1f23";
  btn.style.zIndex = "2";
  btn.style.lineHeight = "22px";
  btn.style.width = "32px";
  btn.style.height = "32px";
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.border = "1px solid rgba(0,0,0,0.18)";
  btn.style.background = "#fff";
  btn.style.borderRadius = "10px";
  btn.style.cursor = "pointer";
  btn.style.border = "1px solid rgba(0,0,0,0.18)";
  btn.style.background = "#fff";
  btn.style.borderRadius = "10px";
  btn.style.padding = "6px 10px";
  btn.style.cursor = "pointer";
  btn.addEventListener("click", () => cerrarModalRVS());

  head.appendChild(title);
  head.appendChild(btn);

  const body = document.createElement("div");
  body.id = "rvs_modal_body";
  body.style.padding = "12px 14px";
  body.style.maxHeight = "calc(80vh - 56px)";
  body.style.overflowY = "auto";
  body.style.boxSizing = "border-box";

  box.appendChild(head);
  box.appendChild(body);
  modal.appendChild(box);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) cerrarModalRVS();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModalRVS();
  });

  document.body.appendChild(modal);
  return modal;
}

function abrirModalRVS(titulo, htmlBody) {
  const modal = asegurarModalRVS();
  const t = document.getElementById("rvs_modal_titulo");
  const b = document.getElementById("rvs_modal_body");

  try { if (typeof window.__rvs_setModalWidth === 'function') window.__rvs_setModalWidth(); } catch (_) {}

  if (t) t.textContent = titulo || "Detalle";
  if (b) b.innerHTML = htmlBody || "";
  modal.style.display = "block";
  document.body.classList.add("modal-open");
}

function cerrarModalRVS() {
  const modal = document.getElementById("rvs_modal_detalle");
  if (!modal) return;
  modal.style.display = "none";
  document.body.classList.remove("modal-open");
}

function renderResumenPorEquipo(dsR) {
  if (!elReporte) return;
  elReporte.innerHTML = "";

  const card = document.createElement("div");
  card.style.border = "1px solid rgba(0,0,0,0.08)";
  card.style.borderRadius = "10px";
  card.style.padding = "12px";
  card.style.background = "rgba(255,255,255,0.7)";
  card.style.marginBottom = "14px";

  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.justifyContent = "space-between";
  head.style.alignItems = "baseline";
  head.style.gap = "10px";
  head.style.flexWrap = "wrap";

  const hL = document.createElement("div");
  hL.style.fontWeight = "800";
  hL.style.fontSize = "14px";
  hL.textContent = "Resumen por Equipo";

  const hR = document.createElement("div");
  hR.style.opacity = "0.85";
  hR.style.fontSize = "12px";
  hR.textContent = `Semana: ${dsR.weekStartISO} a ${dsR.weekEndISO} | Mes: ${dsR.monthStartISO} a ${dsR.monthEndISO}`;

  head.appendChild(hL);
  head.appendChild(hR);
  card.appendChild(head);

  const tbl = document.createElement("table");
  tbl.style.width = "100%";
  tbl.style.borderCollapse = "separate";
  tbl.style.borderSpacing = "0";
  tbl.style.marginTop = "10px";
  tbl.style.fontSize = "11px";
  tbl.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
  tbl.style.borderRadius = "10px";
  tbl.style.overflow = "hidden";

  const mkTh = (txt, opts = {}) => {
    const th = document.createElement("th");
    th.textContent = txt;
    th.style.background = "#cfe3f7";
    th.style.border = "1px solid rgba(0,0,0,0.12)";
    th.style.padding = "6px 8px";
    th.style.whiteSpace = "nowrap";
    th.style.textAlign = opts.align || "center";
    if (opts.rowspan) th.rowSpan = opts.rowspan;
    if (opts.colspan) th.colSpan = opts.colspan;
    return th;
  };

  const thead = document.createElement("thead");
  const tr1 = document.createElement("tr");
  // Definición: 1er col visible = Equipo (sin duplicar columna técnica)
  tr1.appendChild(mkTh("Equipo", { rowspan: 2, align: "left" }));
  tr1.appendChild(mkTh("Semana", { colspan: 5 }));
  tr1.appendChild(mkTh("Mes", { colspan: 5 }));
  tr1.appendChild(mkTh("Autorizado", { rowspan: 2 }));
  thead.appendChild(tr1);

  const tr2 = document.createElement("tr");
  ["Tope","Sobre","Bajo","Plan","Total","Tope","Sobre","Bajo","Plan","Total"].forEach((h) => tr2.appendChild(mkTh(h)));
  thead.appendChild(tr2);
  tbl.appendChild(thead);

  const getNum = (r, keys) => {
    for (const k of keys) {
      if (r && r[k] != null && r[k] !== "") {
        const n = Number(r[k]);
        if (!Number.isNaN(n)) return n;
      }
    }
    return 0;
  };

  const tbody = document.createElement("tbody");

  (dsR.rows || []).forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.idEquipo = r.id_equipo || "";
    tr.dataset.autorizado = r.autorizado ? "1" : "0";
    tr.style.background = idx % 2 ? "rgba(255,255,255,0.65)" : "white";
    tr.style.cursor = r.autorizado ? "pointer" : "not-allowed";
    if (!r.autorizado) tr.style.opacity = "0.55";

    const nombreEquipo = r.nombre_equipo ?? r.equipo ?? r.equipo_nombre ?? r.nombre ?? "";
    const tdEq = document.createElement("td");
    tdEq.textContent = nombreEquipo || "";
    tdEq.style.border = "1px solid rgba(0,0,0,0.12)";
    tdEq.style.padding = "6px 8px";
    tdEq.style.textAlign = "left";
    tdEq.style.whiteSpace = "nowrap";
    tdEq.style.fontWeight = "700";
    tr.appendChild(tdEq);

    const sem_tope  = getNum(r, ["sem_tope","semana_tope","semTope","semanal_tope"]);
    const sem_sobre = getNum(r, ["sem_sobre","semana_sobre","semSobre","semanal_sobre"]);
    const sem_bajo  = getNum(r, ["sem_bajo","semana_bajo","semBajo","semanal_bajo"]);
    const sem_plan  = getNum(r, ["sem_plan","semana_plan","semPlan","semanal_plan"]);
    const sem_total = getNum(r, ["sem_total","semana_total","semTotal","semanal_total"]);

    const mes_tope  = getNum(r, ["mes_tope","month_tope","mensual_tope"]);
    const mes_sobre = getNum(r, ["mes_sobre","month_sobre","mensual_sobre"]);
    const mes_bajo  = getNum(r, ["mes_bajo","month_bajo","mensual_bajo"]);
    const mes_plan  = getNum(r, ["mes_plan","month_plan","mensual_plan"]);
    const mes_total = getNum(r, ["mes_total","month_total","mensual_total"]);

    const cells = [
      sem_tope, sem_sobre, sem_bajo, sem_plan, sem_total,
      mes_tope, mes_sobre, mes_bajo, mes_plan, mes_total,
    ];

    cells.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = formatCLP(val);
      td.style.border = "1px solid rgba(0,0,0,0.12)";
      td.style.padding = "6px 8px";
      td.style.textAlign = "right";
      td.style.whiteSpace = "nowrap";
      tr.appendChild(td);
    });

    const tdAu = document.createElement("td");
    tdAu.textContent = r.autorizado ? "Sí" : "No";
    tdAu.style.border = "1px solid rgba(0,0,0,0.12)";
    tdAu.style.padding = "6px 8px";
    tdAu.style.textAlign = "center";
    tdAu.style.whiteSpace = "nowrap";
    tr.appendChild(tdAu);

    tr.addEventListener("click", async () => {
      if (!r.autorizado) return;

      const tituloEquipo = nombreEquipo || "";
      abrirModalRVS(`Detalle por vendedor — ${tituloEquipo}`, `<div style="opacity:0.85;">Cargando…</div>`);

      try {
                const p_dia = (window.__AV_REP_SEMANA_STATE && window.__AV_REP_SEMANA_STATE.p_dia) || dsR.p_dia || toISODate(parseSelectedDay(elDia?.value || toISODate(new Date())));
        const detalleRaw = await callRpcVariantes("rpt_ventas_semana_detalle", [
          { p_dia, p_id_equipo: r.id_equipo },
          { p_dia, id_equipo: r.id_equipo },
          { dia: p_dia, p_id_equipo: r.id_equipo },
          { dia: p_dia, id_equipo: r.id_equipo },
        ]);

        let det = normalizarDetalleRPC(detalleRaw);

        // Detalle: soporta 2 formatos
        // A) Formato legacy: [{vendedor,tipo_venta,monto}, ...]
        // B) Formato pivoteado (actual RPC): [{vendedor,tope,sobre,bajo,plan,mes_tope,mes_sobre,mes_bajo,mes_plan}, ...]
        const isPivot = det && det.length && (
          Object.prototype.hasOwnProperty.call(det[0], "tope") ||
          Object.prototype.hasOwnProperty.call(det[0], "mes_tope")
        );

        if (isPivot) {
          const num = (v) => Number(v || 0) || 0;

          const rowsHtml = det.map((r) => {
            const wTope = num(r.tope);
            const wSobre = num(r.sobre);
            const wBajo = num(r.bajo);
            const wPlan = num(r.plan);
            const wTotal = wTope + wSobre + wBajo + wPlan;

            const mTope = num(r.mes_tope);
            const mSobre = num(r.mes_sobre);
            const mBajo = num(r.mes_bajo);
            const mPlan = num(r.mes_plan);
            const mTotal = mTope + mSobre + mBajo + mPlan;

            return `
              <tr>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:left;">${escapeHtml(r.vendedor || r.nombre || "")}</td>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap;">${formatCLP(wTope)}</td>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap;">${formatCLP(wSobre)}</td>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap;">${formatCLP(wBajo)}</td>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap;">${formatCLP(wPlan)}</td>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap; font-weight:700;">${formatCLP(wTotal)}</td>

                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap;">${formatCLP(mTope)}</td>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap;">${formatCLP(mSobre)}</td>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap;">${formatCLP(mBajo)}</td>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap;">${formatCLP(mPlan)}</td>
                <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap; font-weight:700;">${formatCLP(mTotal)}</td>
              </tr>
            `;
          }).join("");

          const tot = det.reduce((acc, r) => {
            acc.wTope += num(r.tope); acc.wSobre += num(r.sobre); acc.wBajo += num(r.bajo); acc.wPlan += num(r.plan);
            acc.mTope += num(r.mes_tope); acc.mSobre += num(r.mes_sobre); acc.mBajo += num(r.mes_bajo); acc.mPlan += num(r.mes_plan);
            return acc;
          }, { wTope:0, wSobre:0, wBajo:0, wPlan:0, mTope:0, mSobre:0, mBajo:0, mPlan:0 });

          const wTotal = tot.wTope + tot.wSobre + tot.wBajo + tot.wPlan;
          const mTotal = tot.mTope + tot.mSobre + tot.mBajo + tot.mPlan;

          const html = `
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:baseline; margin-bottom:10px;">
              <div style="font-weight:700;">Totales (sin PV)</div>
              <div style="display:flex; gap:14px; font-weight:800; white-space:nowrap;">
                <div>Semana: ${formatCLP(wTotal)}</div>
                <div>Mes: ${formatCLP(mTotal)}</div>
              </div>
            </div>
            <div style="overflow:auto;">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th rowspan="2" style="padding:6px 8px; text-align:left; border-bottom:1px solid rgba(0,0,0,0.18);">AAPP</th>
                    <th colspan="5" style="padding:6px 8px; text-align:center; border-bottom:1px solid rgba(0,0,0,0.18);">Semana</th>
                    <th colspan="5" style="padding:6px 8px; text-align:center; border-bottom:1px solid rgba(0,0,0,0.18);">Mes</th>
                  </tr>
                  <tr>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Tope</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Sobre</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Bajo</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Plan</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Total</th>

                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Tope</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Sobre</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Bajo</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Plan</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || `<tr><td colspan="11" style="padding:10px; opacity:0.8;">Sin datos</td></tr>`}
                </tbody>
                <tfoot>
                  <tr>
                    <td style="padding:8px; font-weight:800; text-align:left; border-top:1px solid rgba(0,0,0,0.18);">Total</td>
                    <td style="padding:8px; font-weight:800; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(tot.wTope)}</td>
                    <td style="padding:8px; font-weight:800; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(tot.wSobre)}</td>
                    <td style="padding:8px; font-weight:800; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(tot.wBajo)}</td>
                    <td style="padding:8px; font-weight:800; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(tot.wPlan)}</td>
                    <td style="padding:8px; font-weight:900; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(wTotal)}</td>

                    <td style="padding:8px; font-weight:800; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(tot.mTope)}</td>
                    <td style="padding:8px; font-weight:800; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(tot.mSobre)}</td>
                    <td style="padding:8px; font-weight:800; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(tot.mBajo)}</td>
                    <td style="padding:8px; font-weight:800; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(tot.mPlan)}</td>
                    <td style="padding:8px; font-weight:900; text-align:right; border-top:1px solid rgba(0,0,0,0.18);">${formatCLP(mTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `;

          abrirModalRVS(`Detalle por vendedor — ${tituloEquipo}`, html);
        } else {
          // Formato legacy: Totales excluyen PV (solo en suma; las filas PV se muestran, pero no suman)
          const rowsHtml = det.map(x => `
            <tr>
              <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:left;">${escapeHtml(x.vendedor)}</td>
              <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:left;">${escapeHtml(x.tipo_venta)}</td>
              <td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.08); text-align:right; white-space:nowrap;">${formatCLP(Number(x.monto || 0))}</td>
            </tr>
          `).join("");

          const total = det.reduce((acc, x) => {
            if (esPV(x.tipo_venta)) return acc;
            return acc + (Number(x.monto || 0) || 0);
          }, 0);

          const html = `
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:baseline; margin-bottom:10px;">
              <div style="font-weight:700;">Totales (sin PV)</div>
              <div style="font-weight:800; white-space:nowrap;">${formatCLP(total)}</div>
            </div>
            <div style="overflow:auto;">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="padding:6px 8px; text-align:left; border-bottom:1px solid rgba(0,0,0,0.18);">Vendedor</th>
                    <th style="padding:6px 8px; text-align:left; border-bottom:1px solid rgba(0,0,0,0.18);">Tipo</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.18);">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || `<tr><td colspan="3" style="padding:10px; opacity:0.8;">Sin datos</td></tr>`}
                </tbody>
              </table>
            </div>
          `;

          abrirModalRVS(`Detalle por vendedor — ${tituloEquipo}`, html);
        }
      } catch (e) {
        abrirModalRVS(`Detalle por vendedor — ${tituloEquipo}`, `<div style="color:#b00020; font-weight:700;">Error</div><div style="margin-top:6px; opacity:0.85;">${escapeHtml(e?.message || String(e))}</div>`);
      }
    });

    tbody.appendChild(tr);
  });

  tbl.appendChild(tbody);
  card.appendChild(tbl);
  elReporte.appendChild(card);
}



// ======================= Excel =======================
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

async function exportarExcel(dataset, nombreArchivo) {
  if (!window.XLSX) throw new Error("No se cargó XLSX (SheetJS).");
  const XLSX = window.XLSX;

  const wb = XLSX.utils.book_new();

  const headers = [
    "AAPP","EQUIPO",
    "TOPE","SOBRE","BAJO","PLAN","TOTAL SEMANA",
    "MES TOPE","MES SOBRE","MES BAJO","MES PLAN","TOTAL MES"
  ];

  function sheetFromRows(titleLines, rowsAOA) {
    const aoa = [];
    for (const l of titleLines) aoa.push([l]);
    aoa.push([""]);
    aoa.push(headers);
    for (const r of rowsAOA) aoa.push(r);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    if (ws && ws["!ref"]) {
      ws["!cols"] = [
        { wch: 30 }, // AAPP
        { wch: 18 }, // Equipo
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      ];
    }
    return ws;
  }

  function safeSheetName(name, used) {
    const base = String(name || "Hoja")
      .replace(/[\\/*?:\[\]]/g, " ")
      .trim()
      .slice(0, 31) || "Hoja";
    let out = base;
    let i = 2;
    while (used.has(out)) {
      const suffix = ` ${i++}`;
      out = (base.slice(0, Math.max(1, 31 - suffix.length)) + suffix).slice(0, 31);
    }
    used.add(out);
    return out;
  }

  const usedNames = new Set();

  // ======================= Zonal (dataset armado por teams) =======================
  if (dataset?.mode === "zonal") {
    // 1) Sheet resumen (una sola hoja)
    const rowsResumen = [];
    for (const t of (dataset.teams || [])) {
      for (const r of (t.rows || [])) {
        rowsResumen.push([
          r.aapp,
          t.equipoNombre,
          r.tope, r.sobre, r.bajo, r.plan, r.total_semana,
          r.mes_tope, r.mes_sobre, r.mes_bajo, r.mes_plan, r.total_mes
        ]);
      }
      rowsResumen.push([
        "TOTAL",
        t.equipoNombre,
        t.tot.semana_tope, t.tot.semana_sobre, t.tot.semana_bajo, t.tot.semana_plan, t.tot.semana_total,
        t.tot.mes_tope, t.tot.mes_sobre, t.tot.mes_bajo, t.tot.mes_plan, t.tot.mes_total
      ]);
      rowsResumen.push(["",""]);
    }

    const titleLines = [
      "Reporte Ventas Semana (Zonal) — Resumen",
      `Semana: ${dataset.weekStartISO} a ${dataset.weekEndISO}`,
      `Mes: ${dataset.monthStartISO} a ${dataset.monthEndISO}`,
    ];
    XLSX.utils.book_append_sheet(wb, sheetFromRows(titleLines, rowsResumen), safeSheetName("Resumen", usedNames));

    // 2) Sheets detalle por equipo (ya vienen en dataset.teams)
    for (const t of (dataset.teams || [])) {
      const rowsDet = [];
      let s_tope=0, s_sobre=0, s_bajo=0, s_plan=0, s_tot=0;
      let m_tope=0, m_sobre=0, m_bajo=0, m_plan=0, m_tot=0;

      for (const r of (t.rows || [])) {
        const totS = Number(r.total_semana || (Number(r.tope||0)+Number(r.sobre||0)+Number(r.bajo||0)+Number(r.plan||0)));
        const totM = Number(r.total_mes || (Number(r.mes_tope||0)+Number(r.mes_sobre||0)+Number(r.mes_bajo||0)+Number(r.mes_plan||0)));

        rowsDet.push([
          r.aapp,
          t.equipoNombre,
          Number(r.tope||0), Number(r.sobre||0), Number(r.bajo||0), Number(r.plan||0), totS,
          Number(r.mes_tope||0), Number(r.mes_sobre||0), Number(r.mes_bajo||0), Number(r.mes_plan||0), totM
        ]);

        s_tope += Number(r.tope||0); s_sobre += Number(r.sobre||0); s_bajo += Number(r.bajo||0); s_plan += Number(r.plan||0); s_tot += totS;
        m_tope += Number(r.mes_tope||0); m_sobre += Number(r.mes_sobre||0); m_bajo += Number(r.mes_bajo||0); m_plan += Number(r.mes_plan||0); m_tot += totM;
      }

      rowsDet.push(["TOTAL", t.equipoNombre, s_tope, s_sobre, s_bajo, s_plan, s_tot, m_tope, m_sobre, m_bajo, m_plan, m_tot]);

      const titleDet = [
        "Reporte Ventas Semana — Detalle por vendedor",
        `Equipo: ${t.equipoNombre}`,
        `Semana: ${dataset.weekStartISO} a ${dataset.weekEndISO}`,
        `Mes: ${dataset.monthStartISO} a ${dataset.monthEndISO}`,
      ];
      XLSX.utils.book_append_sheet(wb, sheetFromRows(titleDet, rowsDet), safeSheetName(t.equipoNombre, usedNames));
    }

    XLSX.writeFile(wb, nombreArchivo);
    return;
  }

  // ======================= Resumen (RPC) => exporta detalle por equipo en hojas separadas =======================
  if (dataset?.mode === "resumen") {
    const ds = dataset;
    const perfil = (window.__AV_REP_SEMANA_STATE?.perfil || "supervisor").toLowerCase();

    // Resumen sheet
    const rowsResumen = [];
    let g_sem_tope = 0, g_sem_sobre = 0, g_sem_bajo = 0, g_sem_plan = 0, g_sem_total = 0;
    let g_mes_tope = 0, g_mes_sobre = 0, g_mes_bajo = 0, g_mes_plan = 0, g_mes_total = 0;

    for (const r of (ds.rows || [])) {
      const sem_tope = Number(r.sem_tope || 0);
      const sem_sobre = Number(r.sem_sobre || 0);
      const sem_bajo = Number(r.sem_bajo || 0);
      const sem_plan = Number(r.sem_plan || 0);
      const sem_total = Number(r.sem_total || (sem_tope + sem_sobre + sem_bajo + sem_plan));

      const mes_tope = Number(r.mes_tope || 0);
      const mes_sobre = Number(r.mes_sobre || 0);
      const mes_bajo = Number(r.mes_bajo || 0);
      const mes_plan = Number(r.mes_plan || 0);
      const mes_total = Number(r.mes_total || (mes_tope + mes_sobre + mes_bajo + mes_plan));

      const nombreEq = String(r.equipo || r.nombre_equipo || "").trim();

      rowsResumen.push([
        "",
        nombreEq,
        sem_tope, sem_sobre, sem_bajo, sem_plan, sem_total,
        mes_tope, mes_sobre, mes_bajo, mes_plan, mes_total
      ]);

      g_sem_tope += sem_tope; g_sem_sobre += sem_sobre; g_sem_bajo += sem_bajo; g_sem_plan += sem_plan; g_sem_total += sem_total;
      g_mes_tope += mes_tope; g_mes_sobre += mes_sobre; g_mes_bajo += mes_bajo; g_mes_plan += mes_plan; g_mes_total += mes_total;
    }

    rowsResumen.push([
      "TOTAL",
      "",
      g_sem_tope, g_sem_sobre, g_sem_bajo, g_sem_plan, g_sem_total,
      g_mes_tope, g_mes_sobre, g_mes_bajo, g_mes_plan, g_mes_total
    ]);

    const titleResumen = [
      "Reporte Ventas Semana — Resumen por Equipo",
      `Semana: ${ds.weekStartISO} a ${ds.weekEndISO}`,
      `Mes: ${ds.monthStartISO} a ${ds.monthEndISO}`,
    ];
    XLSX.utils.book_append_sheet(wb, sheetFromRows(titleResumen, rowsResumen), safeSheetName("Resumen", usedNames));

    // Equipos a exportar en detalle
    const equiposDetalle = (ds.rows || []).filter(r => {
      if (perfil === "zonal") return true;
      return Boolean(r.autorizado);
    });

    for (const eq of equiposDetalle) {
      const idEq = eq.id_equipo;
      const nombreEq = String(eq.equipo || eq.nombre_equipo || "").trim() || "Equipo";

      let detalleRaw = [];
      try {
        const p_dia = ds.p_dia || window.__AV_REP_SEMANA_STATE?.p_dia;
        detalleRaw = await callRpcVariantes("rpt_ventas_semana_detalle", [
          { p_dia, p_id_equipo: idEq },
          { p_dia, id_equipo: idEq },
          { dia: p_dia, p_id_equipo: idEq },
          { dia: p_dia, id_equipo: idEq },
        ]);
      } catch (e) {
        console.warn("No se pudo obtener detalle para Excel:", nombreEq, e);
        detalleRaw = [];
      }

      const det = normalizarDetalleRPC(detalleRaw)
        .map(r => ({
          vendedor: String(r.vendedor || "").trim(),
          tope: Number(r.tope || 0),
          sobre: Number(r.sobre || 0),
          bajo: Number(r.bajo || 0),
          plan: Number(r.plan || 0),
          mes_tope: Number(r.mes_tope || 0),
          mes_sobre: Number(r.mes_sobre || 0),
          mes_bajo: Number(r.mes_bajo || 0),
          mes_plan: Number(r.mes_plan || 0),
        }))
        .sort((a, b) => collator.compare(a.vendedor, b.vendedor));

      const rowsDet = [];
      let s_tope=0, s_sobre=0, s_bajo=0, s_plan=0, s_tot=0;
      let m_tope=0, m_sobre=0, m_bajo=0, m_plan=0, m_tot=0;

      for (const r of det) {
        const totS = r.tope + r.sobre + r.bajo + r.plan;
        const totM = r.mes_tope + r.mes_sobre + r.mes_bajo + r.mes_plan;
        rowsDet.push([
          r.vendedor,
          nombreEq,
          r.tope, r.sobre, r.bajo, r.plan, totS,
          r.mes_tope, r.mes_sobre, r.mes_bajo, r.mes_plan, totM
        ]);
        s_tope += r.tope; s_sobre += r.sobre; s_bajo += r.bajo; s_plan += r.plan; s_tot += totS;
        m_tope += r.mes_tope; m_sobre += r.mes_sobre; m_bajo += r.mes_bajo; m_plan += r.mes_plan; m_tot += totM;
      }

      rowsDet.push(["TOTAL", nombreEq, s_tope, s_sobre, s_bajo, s_plan, s_tot, m_tope, m_sobre, m_bajo, m_plan, m_tot]);

      const titleDet = [
        "Reporte Ventas Semana — Detalle por vendedor",
        `Equipo: ${nombreEq}`,
        `Semana: ${ds.weekStartISO} a ${ds.weekEndISO}`,
        `Mes: ${ds.monthStartISO} a ${ds.monthEndISO}`,
      ];
      XLSX.utils.book_append_sheet(wb, sheetFromRows(titleDet, rowsDet), safeSheetName(nombreEq, usedNames));
    }

    XLSX.writeFile(wb, nombreArchivo);
    return;
  }

  // ======================= Legacy: dataset por equipo =======================
  {
    const ds = dataset;
    const rows = [];
    for (const r of (ds.rows || [])) {
      rows.push([
        r.aapp,
        ds.equipoNombre,
        r.tope, r.sobre, r.bajo, r.plan, r.total_semana,
        r.mes_tope, r.mes_sobre, r.mes_bajo, r.mes_plan, r.total_mes
      ]);
    }
    rows.push([
      "TOTAL",
      ds.equipoNombre,
      ds.tot.semana_tope, ds.tot.semana_sobre, ds.tot.semana_bajo, ds.tot.semana_plan, ds.tot.semana_total,
      ds.tot.mes_tope, ds.tot.mes_sobre, ds.tot.mes_bajo, ds.tot.mes_plan, ds.tot.mes_total
    ]);

    const titleLines = [
      "Reporte Ventas Semana",
      `Equipo: ${ds.equipoNombre}`,
      `Semana: ${ds.weekStartISO} a ${ds.weekEndISO}`,
      `Mes: ${ds.monthStartISO} a ${ds.monthEndISO}`,
    ];
    const ws = sheetFromRows(titleLines, rows);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName("reporte-ventas-semana", usedNames));
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
    window.__AV_REP_SEMANA_STATE.perfil = perfil;

    const selectedDay = parseSelectedDay(elDia?.value || toISODate(new Date()));
    const { first: monthStart, last: monthEnd } = monthBounds(selectedDay);
    const { mon: weekStart, fri: weekEnd } = weekBoundsMonFri(selectedDay);

    const monthStartISO = toISODate(monthStart);
    const monthEndISO = toISODate(monthEnd);
    const weekStartISO = toISODate(weekStart);
    const weekEndISO = toISODate(weekEnd);

    setRangoLabel({ weekStart, weekEnd, monthStart, monthEnd });

    DATASET = null;
    elReporte.innerHTML = "";
    // --- Paso 1: Vista inicial Resumen por Equipo (RPC) ---
    const p_dia = toISODate(selectedDay);
    window.__AV_REP_SEMANA_STATE.p_dia = p_dia;

    estado("Cargando resumen por equipo…");
    try {
      const resumenRaw = await callRpcVariantes("rpt_ventas_semana_resumen", [
        { p_dia },
        { dia: p_dia },
      ]);

      if (resumenRaw && Array.isArray(resumenRaw)) {
        const rows = normalizarResumenRPC(resumenRaw);

        const dsR = {
          mode: "resumen",
          p_dia,
          monthStartISO, monthEndISO,
          weekStartISO, weekEndISO,
          rows
        };

        DATASET = dsR;
        estado("");
        renderResumenPorEquipo(dsR);
        return;
      }
    } catch (e) {
      // No rompemos nada: si no existe el RPC o falla, seguimos con el flujo legacy
      console.warn("RPC rpt_ventas_semana_resumen falló, usando flujo legacy. Detalle:", e);
    }


    if (perfil === "zonal") {
      const refISO = toISODate(selectedDay);

      estado("Cargando equipos del zonal…");
      const zonaIds = await fetchZonaIdsAsignadasAZonal(userId, refISO);
      const equipos = await fetchEquiposDeZonas(zonaIds, refISO);

      if (!equipos.length) {
        estado("Sin equipos asignados.", true);
        return;
      }

      estado("Cargando equipos (batch)…");
      const teams = await cargarDatasetZonalBatchSemana(equipos, monthStartISO, monthEndISO, weekStartISO, weekEndISO);

      const dsZ = { mode: "zonal", monthStartISO, monthEndISO, weekStartISO, weekEndISO, teams };
      DATASET = dsZ;
      estado("");
      renderZonal(dsZ);
      return;
    }

    // Supervisor: permitir 'ALL' si existe en selector
    const selEq = document.getElementById("selectEquipo");
    if (selEq && selEq.value === "ALL") {
      estado("Cargando todos los equipos…");
      const equipos = Array.from(selEq.options)
        .map(o => o.value)
        .filter(v => v && v !== "ALL");

      const teams = [];
      for (const idEq of equipos) {
        const t = await cargarDatasetEquipoSemana({ equipoId: idEq, monthStartISO, monthEndISO, weekStartISO, weekEndISO });
        teams.push({
          equipoId: t.equipoId,
          equipoNombre: t.equipoNombre,
          rows: t.rows,
          tot: t.tot,
        });
      }
      const dsAll = { mode: "zonal", monthStartISO, monthEndISO, weekStartISO, weekEndISO, teams };
      DATASET = dsAll;
      estado("");
      renderZonal(dsAll);
      return;
    }

    const equipoId = getEquipoIdActual();
    if (!equipoId) throw new Error("No se encontró equipo activo.");

    estado("Cargando datos…");
    const ds = await cargarDatasetEquipoSemana({ equipoId, monthStartISO, monthEndISO, weekStartISO, weekEndISO });

    DATASET = { mode: "supervisor", ...ds };
    estado("");
    renderSupervisor(ds);
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
    if (!DATASET) throw new Error("No hay datos cargados para exportar.");
    const suf = `${DATASET.weekStartISO || ""}_${DATASET.weekEndISO || ""}`;
    await exportarExcel(DATASET, `reporte-ventas-semana_${suf}.xlsx`);
  } catch (e) {
    alert(e?.message || String(e));
  }
});

elDia?.addEventListener("change", () => {
  try { window.__AV_REP_SEMANA_STATE.p_dia = String(elDia.value || "").trim() || null; } catch (_) {}
  refrescar();
});

elOrden?.addEventListener("change", () => {
  try {
    if (!DATASET) return refrescar();
    const modo = getOrdenModo();

    if (DATASET.mode === "zonal" && Array.isArray(DATASET.teams)) {
      DATASET.teams = DATASET.teams.map(t => ({
        ...t,
        rows: ordenarVendedores(Array.isArray(t.rows) ? t.rows : [], modo)
      }));
      renderZonal(DATASET);
      return;
    }

    if (DATASET.mode === "supervisor" && Array.isArray(DATASET.rows)) {
      DATASET.rows = ordenarVendedores(DATASET.rows, modo);
      renderSupervisor(DATASET);
      return;
    }

    refrescar();
  } catch (e) {
    console.error(e);
    refrescar();
  }
});

// Al cambiar equipo (suplencia/selector), recargar
(function bindEquipoSelector() {
  const sel = document.getElementById("selectEquipo");
  if (!sel) return;
  if (window.__rvs_equipo_listener_bound) return;
  window.__rvs_equipo_listener_bound = true;
  sel.addEventListener("change", refrescar);
})();

(function init() {
  ensureDiaOptions();
  if (elDia && !elDia.value) elDia.value = toISODate(new Date());
  refrescar();
})();