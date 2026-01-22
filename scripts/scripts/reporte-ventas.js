
// ======================= Día (combo) =======================
// Nota: cuando este módulo se embebe vía innerHTML, los <script> inline del HTML no ejecutan.
// Por eso garantizamos aquí que el combo de Día tenga opciones y un valor visible.
function ensureDiaOptions() {
  if (!elDia) return;

  const hasOptions = elDia.options && elDia.options.length > 0;
  const currentVal = String(elDia.value || "").trim();

  // Determinar fecha base:
  // - Si hay un value válido (YYYY-MM-DD), usar ese mes/año
  // - Si no, usar fecha actual
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

  // Si hay opciones pero el value no matchea ninguna, regenerar para que se vea el día.
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

    // Mantener valor previo si existe; si no, hoy
    const fallback = toISO(new Date());
    elDia.value = prev && /^\d{4}-\d{2}-\d{2}$/.test(prev) ? prev : fallback;

    // Si el valor no existe (prev fuera del mes), dejar hoy
    let ok = false;
    for (const opt of elDia.options) {
      if (opt && opt.value === elDia.value) { ok = true; break; }
    }
    if (!ok) elDia.value = fallback;
  }
}

// scripts/reporte-ventas.js
// Reporte Ventas (general) - APP Ventas
//
// Reglas (SIN DECIMALES):
// Fuente: public.ventas
// Tope  = SUM(monto) donde tipo_venta='TOPE'
// Sobre = SUM(monto) donde tipo_venta='SOBRE'
// Bajo  = SUM(monto) donde tipo_venta='BAJO'
// Plan  = SUM(monto) donde tipo_venta='PLAN'
// Reales TF   = Tope + Sobre + Bajo
// Reales >40  = Tope + Sobre
// Reales >70  = Tope
// OTIs C/Saldo = COUNT(*) de registros PV (cantidad, no monto) -> se detecta por descripcion contiene 'PV'
//
// Equipo–vendedor vía public.equipo_vendedor.
// Incluye vendedores sin ventas (0). Incluye fila TOTAL.
//
// Comportamiento por rol:
// - Supervisor (y similares): muestra SOLO el equipo actualmente seleccionado (principal o suplente) vía #selectEquipo.
// - Zonal: muestra TODOS los equipos de las zonas asignadas al zonal (zona_zonal -> zona_equipo),
//          ordenado por Equipo ASC y dentro por Vendedor ASC.

if (!window.supabase) throw new Error("Supabase no inicializado en window");
const supabase = window.supabase;

// ======================= DOM =======================
const $ = (id) => document.getElementById(id);

const elDia = $("selectDiaVentas");
const elRango = $("labelRangoVentas");
const elReporte = $("contenedorReporteVentas");
const elCarga = $("estadoCargaVentas");
const btnVolver = $("btnVolverReporteVentas");
const btnExcel = $("btnExcelVentas");
const elOrden = $("selectOrdenVentas");

let DATASET = null; // para export (supervisor: 1 equipo; zonal: multi-equipos)

// ======================= UI helpers =======================
function estado(msg, esError = false) {
  if (!elCarga) return;
  elCarga.textContent = msg || "";
  elCarga.style.color = esError ? "#b00020" : "";
}

// SIN DECIMALES
const MAX_MONTO = 999_999_999_999; // margen amplio
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
const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

// ======================= Orden =======================
function getOrdenModo() {
  const sel = document.getElementById("selectOrdenVentas");
  return sel?.value || "gt40_desc";
}

function ordenarRows(rows, modo) {
  const arr = Array.isArray(rows) ? [...rows] : [];

  const getNombre = (r) => String(r?.aapp ?? "").trim();
  const get40 = (r) => Number(r?.reales40 ?? 0);
  const get70 = (r) => Number(r?.reales70 ?? 0);
  const getTF = (r) => Number(r?.realesTF ?? 0);

  const cmpNombreAsc = (a, b) => collator.compare(getNombre(a), getNombre(b));
  const cmpNombreDesc = (a, b) => collator.compare(getNombre(b), getNombre(a));

  // Nota: si hay "nuevos", la agrupación al final se resuelve en el render (no aquí).
  switch (modo) {
    case "nombre_desc":
      arr.sort(cmpNombreDesc);
      break;

    case "gt40_asc":
      // Reales >40, luego Reales >70, luego Reales TF, luego nombre
      arr.sort((a, b) =>
        (get40(a) - get40(b)) ||
        (get70(a) - get70(b)) ||
        (getTF(a) - getTF(b)) ||
        cmpNombreAsc(a, b)
      );
      break;

    case "gt40_desc":
      // Reales >40, luego Reales >70, luego Reales TF, luego nombre
      arr.sort((a, b) =>
        (get40(b) - get40(a)) ||
        (get70(b) - get70(a)) ||
        (getTF(b) - getTF(a)) ||
        cmpNombreAsc(a, b)
      );
      break;

    case "nombre_asc":
    default:
      arr.sort(cmpNombreAsc);
      break;
  }

  return arr;
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
function setRangoLabel(ctx) {
  if (!elRango) return;
  elRango.textContent = `${fmtDMY(ctx.monthStart)} a ${fmtDMY(ctx.monthEnd)}`;
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

// ======================= Utilidades de vigencia (zonal) =======================
function iso10(x) {
  return x ? String(x).slice(0, 10) : null;
}
function overlaps(fechaInicio, fechaFin, startISO, endISO) {
  const fi = iso10(fechaInicio) || "0000-01-01";
  const ff = iso10(fechaFin) || "9999-12-31";
  return fi <= endISO && ff >= startISO;
}

function vigente(fechaInicio, fechaFin, refISO) {
  const fi = iso10(fechaInicio) || "0000-01-01";
  const ff = iso10(fechaFin) || "9999-12-31";
  return fi <= refISO && refISO <= ff;
}


function addMonthsSafe(dateObj, deltaMonths) {
  const d = new Date(dateObj.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + deltaMonths);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  d.setHours(0,0,0,0);
  return d;
}

function quarterBounds(dateObj) {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth(); // 0-11
  const qStartMonth = Math.floor(m / 3) * 3; // 0,3,6,9
  const start = new Date(y, qStartMonth, 1);
  start.setHours(0,0,0,0);
  const end = new Date(y, qStartMonth + 3, 0);
  end.setHours(0,0,0,0);
  return { start, end };
}

function cuatrimestreBounds(dateObj) {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth(); // 0-11
  const cStartMonth = Math.floor(m / 4) * 4; // 0,4,8
  const start = new Date(y, cStartMonth, 1);
  start.setHours(0,0,0,0);
  const nextStart = new Date(y, cStartMonth + 4, 1);
  nextStart.setHours(0,0,0,0);
  const end = new Date(y, cStartMonth + 4, 0);
  end.setHours(0,0,0,0);
  return { start, nextStart, end };
}

// Regla solicitada: NUEVO si fecha_ingreso >= (inicio del trimestre actual - 1 mes)
// - "trimestre actual" se calcula sobre la fecha de emisión del reporte
// - umbral = addMonthsSafe(inicio_trimestre_actual, -1)
function esNuevoPorIngreso(fechaIngresoISO, fechaEmisionDate) {
  const fi = iso10(fechaIngresoISO);
  if (!fi) return false;

  // Regla "ejecutivo nuevo":
  // - Entra como NUEVO si su fecha_ingreso cae dentro de la ventana:
  //   [ (inicio cuatrimestre actual - 2 meses), (inicio cuatrimestre siguiente - 2 meses) )
  // - Deja de ser NUEVO cuando se cruza el umbral del cuatrimestre siguiente - 2 meses.
  const { start: cStart, nextStart: cNextStart } = cuatrimestreBounds(fechaEmisionDate);

  const winStartISO = toISODate(addMonthsSafe(cStart, -2));
  const winEndISO   = toISODate(addMonthsSafe(cNextStart, -2));

  return fi >= winStartISO && fi < winEndISO;
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
    .select("id_vendedor, nombre, fecha_ingreso")
    .in("id_vendedor", vendorIds);

  if (error) throw new Error(`Error vendedores: ${error.message}`);

  return (data || []).map((v) => ({ id: v.id_vendedor, nombre: v.nombre || "", fecha_ingreso: v.fecha_ingreso }));
}

async function fetchVentas(vendorIds, desdeISO, hastaISO) {
  if (!vendorIds.length) return [];
  const { data, error } = await supabase
    .from("ventas")
    .select("id_vendedor, fecha_venta, monto, tipo_venta, descripcion")
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

  // 1 sola llamada (evita N+1)
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
function isPV(desc) {
  return normTipo(desc).includes("pv");
}

function buildAgg(ventasRows, tramosPorVendedor) {
  const acc = {}; // acc[vendedorId] = { tope, sobre, bajo, plan, pvCount }

  for (const r of ventasRows || []) {
    const vid = r.id_vendedor;
    if (!vid) continue;

    const f = iso10(r.fecha_venta);
    const tramos = tramosPorVendedor.get(vid) || [];
    const ok = tramos.some((t) => t.fi <= f && f <= t.ff);
    if (!ok) continue;

    const tipo = normTipo(r.tipo_venta);
    const monto = clampMonto(r.monto || 0);

    acc[vid] ??= { tope: 0, sobre: 0, bajo: 0, plan: 0, pvCount: 0 };

    if (tipo === "tope") acc[vid].tope = clampMonto(acc[vid].tope + monto);
    else if (tipo === "sobre") acc[vid].sobre = clampMonto(acc[vid].sobre + monto);
    else if (tipo === "bajo") acc[vid].bajo = clampMonto(acc[vid].bajo + monto);
    else if (tipo === "plan") acc[vid].plan = clampMonto(acc[vid].plan + monto);

    if (isPV(r.descripcion)) acc[vid].pvCount += 1;
  }

  return acc;
}

function computeRow(accRow) {
  const tope = clampMonto(accRow?.tope || 0);
  const sobre = clampMonto(accRow?.sobre || 0);
  const bajo = clampMonto(accRow?.bajo || 0);
  const plan = clampMonto(accRow?.plan || 0);
  const pv = Math.trunc(accRow?.pvCount || 0);

  const realesTF = clampMonto(tope + sobre + bajo);
  const reales40 = clampMonto(tope + sobre);
  const reales70 = tope;

  return { realesTF, reales40, reales70, plan, pv, tope, sobre, bajo };
}

// ======================= Dataset por equipo =======================
async function cargarDatasetEquipo({ equipoId, monthStartISO, monthEndISO, fechaEmision }) {
  const equipoNombre = await fetchEquipoNombre(equipoId);

  const tramos = await fetchEquipoVendedorTramos(equipoId);
  const { vendorIds, tramosPorVendedor } = tramosVigentesEnRango(tramos, monthStartISO, monthEndISO);
  const vendorList = Array.from(vendorIds);

  const vendedores = await fetchVendedoresPorIds(vendorList);
  vendedores.sort((a, b) => collator.compare(a.nombre || "", b.nombre || "")); // VENDEDOR ASC

  const ventas = await fetchVentas(vendorList, monthStartISO, monthEndISO);
  const acc = buildAgg(ventas, tramosPorVendedor);

  const rows = [];
  const tot = { realesTF: 0, reales40: 0, reales70: 0, plan: 0, pv: 0, tope: 0, sobre: 0, bajo: 0 };

  for (const v of vendedores) {
    const m = computeRow(acc[v.id] || null);
    rows.push({
      aapp: v.nombre || "",
      fecha_ingreso: v.fecha_ingreso,
      isNuevo: esNuevoPorIngreso(v.fecha_ingreso, fechaEmision),
      realesTF: m.realesTF,
      reales40: m.reales40,
      reales70: m.reales70,
      plan: m.plan,
      pv: m.pv,
      tope: m.tope,
      sobre: m.sobre,
      bajo: m.bajo,
    });

    tot.realesTF = clampMonto(tot.realesTF + m.realesTF);
    tot.reales40 = clampMonto(tot.reales40 + m.reales40);
    tot.reales70 = clampMonto(tot.reales70 + m.reales70);
    tot.plan = clampMonto(tot.plan + m.plan);
    tot.tope = clampMonto(tot.tope + m.tope);
    tot.sobre = clampMonto(tot.sobre + m.sobre);
    tot.bajo = clampMonto(tot.bajo + m.bajo);
    tot.pv += m.pv;
  }

  const modoOrden = getOrdenModo();
  const normales = rows.filter(r => !r.isNuevo);
  const nuevos = rows.filter(r => r.isNuevo);
  const rowsOrdenadas = [...ordenarRows(normales, modoOrden), ...ordenarRows(nuevos, modoOrden)];
  return { equipoId, equipoNombre, monthStartISO, monthEndISO, rows: rowsOrdenadas, tot };
}

async function cargarDatasetZonalBatch(equipos, monthStartISO, monthEndISO, fechaEmision) {
  const equipoIds = equipos.map(e => e.id_equipo);

  // Tramos de todos los equipos (1 llamada)
  const { data: tramosAll, error: eTr } = await supabase
    .from("equipo_vendedor")
    .select("id_vendedor, id_equipo, fecha_inicio, fecha_fin, estado")
    .in("id_equipo", equipoIds);

  if (eTr) throw new Error(`Error equipo_vendedor: ${eTr.message}`);

  // Armar por equipo: vendorIds + tramosPorVendedor
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
  const vendedoresAll = await fetchVendedoresPorIds(vendorList);
  const vendedorById = new Map(vendedoresAll.map(v => [v.id, { nombre: v.nombre || "", fecha_ingreso: v.fecha_ingreso }]));

  // Ventas de todos los vendedores (1 llamada)
  const ventasAll = await fetchVentas(vendorList, monthStartISO, monthEndISO);

  // Pre-group ventas por vendedor para armar equipos sin re-scan
  const ventasByVendor = new Map();
  for (const v of ventasAll) {
    if (!v?.id_vendedor) continue;
    if (!ventasByVendor.has(v.id_vendedor)) ventasByVendor.set(v.id_vendedor, []);
    ventasByVendor.get(v.id_vendedor).push(v);
  }

  const teams = [];
  for (const eq of equipos) {
    const ctx = equipoCtx.get(eq.id_equipo) || { vendorIds: [], tramosPorVendedor: new Map() };
    const vendorIdsEq = ctx.vendorIds || [];
    const tramosPorVendedor = ctx.tramosPorVendedor || new Map();

    // Vendedores del equipo (incluye sin ventas)
    const vendedoresEq = vendorIdsEq.map(id => ({ id, nombre: (vendedorById.get(id)?.nombre) || "", fecha_ingreso: vendedorById.get(id)?.fecha_ingreso }));
    vendedoresEq.sort((a, b) => collator.compare(a.nombre || "", b.nombre || ""));

    // Ventas del equipo
    const ventasEq = [];
    for (const id of vendorIdsEq) {
      const arr = ventasByVendor.get(id);
      if (arr?.length) ventasEq.push(...arr);
    }

    const acc = buildAgg(ventasEq, tramosPorVendedor);
    const rows = [];
    const tot = { realesTF: 0, reales40: 0, reales70: 0, plan: 0, pv: 0, tope: 0, sobre: 0, bajo: 0 };

    for (const v of vendedoresEq) {
      const m = acc[v.id] || { tope: 0, sobre: 0, bajo: 0, plan: 0, pvCount: 0 };
      const tope = m.tope || 0;
      const sobre = m.sobre || 0;
      const bajo = m.bajo || 0;
      const plan = m.plan || 0;
      const pv = m.pvCount || 0;

      const reales70 = tope;
      const reales40 = tope + sobre;
      const realesTF = tope + sobre + bajo;

      rows.push({
        aapp: v.nombre || "",
        fecha_ingreso: v.fecha_ingreso,
        isNuevo: esNuevoPorIngreso(v.fecha_ingreso, fechaEmision),
        equipo: equipoMeta.get(eq.id_equipo) || eq.nombre_equipo || "(sin nombre)",
        realesTF: clampMonto(realesTF),
        reales40: clampMonto(reales40),
        reales70: clampMonto(reales70),
        plan: clampMonto(plan),
        pv: Math.trunc(pv),
        tope: clampMonto(tope),
        sobre: clampMonto(sobre),
        bajo: clampMonto(bajo),
      });

      tot.realesTF = clampMonto(tot.realesTF + realesTF);
      tot.reales40 = clampMonto(tot.reales40 + reales40);
      tot.reales70 = clampMonto(tot.reales70 + reales70);
      tot.plan = clampMonto(tot.plan + plan);
      tot.pv += pv;
      tot.tope = clampMonto(tot.tope + tope);
      tot.sobre = clampMonto(tot.sobre + sobre);
      tot.bajo = clampMonto(tot.bajo + bajo);
    }
    const modoOrden = getOrdenModo();
  const normales = rows.filter(r => !r.isNuevo);
  const nuevos = rows.filter(r => r.isNuevo);
  const rowsOrdenadas = [...ordenarRows(normales, modoOrden), ...ordenarRows(nuevos, modoOrden)];


    teams.push({
      equipoId: eq.id_equipo,
      equipoNombre: equipoMeta.get(eq.id_equipo) || eq.nombre_equipo || "(sin nombre)",
      rows: rowsOrdenadas,
      tot,
    });
  }

  // Ordenar equipos ASC por nombre
  teams.sort((a, b) => collator.compare(a.equipoNombre || "", b.equipoNombre || ""));
  return teams;
}

// ======================= Render =======================
function makeTableCard({ titulo, subtitulo, rows, tot }) {
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

  const cols = ["AAPP", "EQUIPO", "REALES TF", "REALES >40", "REALES >70", "Plan", "OTIs C/Saldo", "Tope", "Sobre", "Bajo"];

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  cols.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c;
    th.style.background = "#cfe3f7";
    th.style.border = "1px solid rgba(0,0,0,0.12)";
    th.style.padding = "6px 8px";
    th.style.textAlign = (c === "AAPP" || c === "EQUIPO") ? "left" : "right";
    th.style.whiteSpace = "nowrap";
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  tbl.appendChild(thead);

  const tbody = document.createElement("tbody");

  
const normales = (rows || []).filter(r => !r?.isNuevo);
const nuevos = (rows || []).filter(r => !!r?.isNuevo);

const rowsRender = [...normales];
if (nuevos.length) {
  // Separador visual para "nuevos"
  rowsRender.push({ __separadorNuevos: true });
  rowsRender.push(...nuevos);
}

rowsRender.forEach((r, idx) => {
  if (r && r.__separadorNuevos) {
    const trSep = document.createElement("tr");
    const tdSep = document.createElement("td");
    tdSep.colSpan = cols.length;
    tdSep.textContent = "NUEVOS (según fecha de ingreso)";
    tdSep.style.border = "1px solid rgba(0,0,0,0.12)";
    tdSep.style.padding = "6px 8px";
    tdSep.style.textAlign = "left";
    tdSep.style.background = "rgba(176,0,32,0.08)";
    tdSep.style.fontWeight = "800";
    trSep.appendChild(tdSep);
    tbody.appendChild(trSep);
    return;
  }

  const tr = document.createElement("tr");
  tr.style.background = idx % 2 ? "rgba(255,255,255,0.65)" : "white";

  const tdA = document.createElement("td");
  tdA.textContent = r.aapp;

  const tdE = document.createElement("td");
  tdE.textContent = titulo.replace("Equipo: ","");
  tdE.style.border = "1px solid rgba(0,0,0,0.12)";
  tdE.style.padding = "6px 8px";
  tdE.style.textAlign = "left";
  tdE.style.whiteSpace = "nowrap";

  tdA.style.border = "1px solid rgba(0,0,0,0.12)";
  tdA.style.padding = "6px 8px";
  tdA.style.textAlign = "left";
  tdA.style.whiteSpace = "normal";
  tdA.style.maxWidth = "180px";
  tdA.style.lineHeight = "1.2";

  // Nombre en rojo para "nuevos"
  if (r?.isNuevo) {
    tdA.style.color = "#b00020";
    tdA.style.fontWeight = "700";
  }

  tr.appendChild(tdA);
  tr.appendChild(tdE);

  const cells = [
    { key: "realesTF", val: formatCLP(r.realesTF) },
    { key: "reales40", val: formatCLP(r.reales40) },
    { key: "reales70", val: formatCLP(r.reales70) },
    { key: "plan", val: formatCLP(r.plan) },
    { key: "pv", val: String(r.pv) },
    { key: "tope", val: formatCLP(r.tope) },
    { key: "sobre", val: formatCLP(r.sobre) },
    { key: "bajo", val: formatCLP(r.bajo) },
  ];

  cells.forEach((c) => {
    const td = document.createElement("td");
    td.textContent = c.val;
    td.style.border = "1px solid rgba(0,0,0,0.12)";
    td.style.padding = "6px 8px";
    td.style.textAlign = "right";
    td.style.whiteSpace = "nowrap";

    // Reales >40 = 0 => celda roja con 40% opacidad
    if (c.key === "reales40" && Number(r?.reales40 || 0) === 0) {
      td.style.background = "rgba(176,0,32,0.40)";
    }

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

  const tdTE = document.createElement("td");
  tdTE.textContent = "";
  tdT0.style.border = "1px solid rgba(0,0,0,0.12)";
  tdT0.style.padding = "6px 8px";
  tdT0.style.textAlign = "left";
  tdTE.style.border = "1px solid rgba(0,0,0,0.12)";
  tdTE.style.padding = "6px 8px";
  tdTE.style.textAlign = "left";
  tdTE.style.whiteSpace = "nowrap";
  trT.appendChild(tdT0);
  trT.appendChild(tdTE);

  const totCells = [
    formatCLP(tot.realesTF),
    formatCLP(tot.reales40),
    formatCLP(tot.reales70),
    formatCLP(tot.plan),
    String(tot.pv),
    formatCLP(tot.tope),
    formatCLP(tot.sobre),
    formatCLP(tot.bajo),
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
  elReporte.innerHTML = "";
  const card = makeTableCard({
    titulo: `Equipo: ${ds.equipoNombre || "(sin nombre)"}`,
    subtitulo: `Mes: ${ds.monthStartISO} a ${ds.monthEndISO}`,
    rows: ds.rows,
    tot: ds.tot,
  });
  elReporte.appendChild(card);
}

function renderZonal(dsZ) {
  elReporte.innerHTML = "";

  // ===== Resumen por equipo (primero) =====
  const resumenAnchorId = "rv_resumen";
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
  hR.textContent = `Mes: ${dsZ.monthStartISO} a ${dsZ.monthEndISO}`;

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

  const cols = ["EQUIPO","REALES TF","REALES >40","REALES >70","Plan","OTIs C/Saldo","Tope","Sobre","Bajo"];

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  cols.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c;
    th.style.background = "#cfe3f7";
    th.style.border = "1px solid rgba(0,0,0,0.12)";
    th.style.padding = "6px 8px";
    th.style.textAlign = c === "EQUIPO" ? "left" : "right";
    th.style.whiteSpace = "nowrap";
    trh.appendChild(th);
  });
  thead.appendChild(trh);
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
      formatCLP(r.realesTF),
      formatCLP(r.reales40),
      formatCLP(r.reales70),
      formatCLP(r.plan),
      String(r.pv),
      formatCLP(r.tope),
      formatCLP(r.sobre),
      formatCLP(r.bajo),
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

    const targetId = `rv_team_${t.equipoId}`;
    tr.addEventListener("click", () => scrollToEl(byId(targetId)));
    tbody.appendChild(tr);
  });

  tbl.appendChild(tbody);
  card.appendChild(tbl);
  wrapResumen.appendChild(card);
  elReporte.appendChild(wrapResumen);

  // ===== Detalle por equipo =====
  for (const t of dsZ.teams) {
    const anchorId = `rv_team_${t.equipoId}`;
    const detailCard = makeTableCard({
      titulo: `Equipo: ${t.equipoNombre || "(sin nombre)"}`,
      subtitulo: `Mes: ${dsZ.monthStartISO} a ${dsZ.monthEndISO}`,
      rows: t.rows,
      tot: t.tot,
    });
    detailCard.id = anchorId;
    detailCard.style.position = "relative";

    const mini = document.createElement("button");
    mini.type = "button";
    mini.textContent = "↑";
    mini.style.display = "inline-flex";
    mini.style.alignItems = "center";
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
    mini.style.marginLeft = "10px";
mini.style.right = "10px";
const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.padding = "6px 8px";
    footer.style.gap = "6px";
    footer.appendChild(mini);
    detailCard.appendChild(footer);

    mini.addEventListener("click", (e) => {
      e.preventDefault();
      scrollToEl(byId(resumenAnchorId));
    });

    elReporte.appendChild(detailCard);
  }

  const sel = document.getElementById("selectEquipo");
  if (sel && sel.value && sel.value !== "ALL") {
    const target = byId(`rv_team_${sel.value}`);
    if (target) scrollToEl(target);
  }
}

// ======================= Scroll helpers =======================
function scrollToEl(el) {
  try {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (_) {}
}
function byId(id) { return document.getElementById(id); }

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

function exportarExcel(dataset, nombreArchivo) {
  if (!window.XLSX) throw new Error("No se cargó XLSX (SheetJS).");
  const XLSX = window.XLSX;

  const wb = XLSX.utils.book_new();

  const headers = ["AAPP","EQUIPO","REALES TF","REALES >40","REALES >70","Plan","OTIs C/Saldo","Tope","Sobre","Bajo"];

  function applyTableStyle(ws) {
    if (!ws || !ws["!ref"]) return;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const ref = XLSX.utils.encode_range(range);
    ws["!tables"] = ws["!tables"] || [];
    ws["!tables"].push({
      name: "ReporteVentas",
      ref,
      headerRow: true,
      style: { theme: "TableStyleLight9" } // "Claro 9"
    });

    // Anchos de columna (aprox.)
    ws["!cols"] = [
      { wch: 28 }, // AAPP
      { wch: 16 }, // Equipo
      { wch: 10 },
      { wch: 11 },
      { wch: 11 },
      { wch: 10 },
      { wch: 11 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 }
    ];

    // Wrap para AAPP (col A) y NO wrap para Equipo (col B)
    // Aplicamos estilo a todo el rango de datos (incluye header y totales)
    for (let R = range.s.r; R <= range.e.r; R++) {
      const addrA = XLSX.utils.encode_cell({ r: R, c: 0 });
      const addrB = XLSX.utils.encode_cell({ r: R, c: 1 });
      const cellA = ws[addrA];
      if (cellA) {
        cellA.s = cellA.s || {};
        cellA.s.alignment = cellA.s.alignment || {};
        cellA.s.alignment.wrapText = true; // AAPP en 2 líneas cuando Excel lo requiera
        cellA.s.alignment.vertical = "top";
      }
      const cellB = ws[addrB];
      if (cellB) {
        cellB.s = cellB.s || {};
        cellB.s.alignment = cellB.s.alignment || {};
        cellB.s.alignment.wrapText = false;
      }
    }
  }

  
function applyMetaStyles(ws, titleLinesLen, metaRows) {
  const XLSX = window.XLSX;
  const baseRow = titleLinesLen + 2; // (titleLines) + blank + header => data starts after header; meta incluye header como primer fila de aoaRows
  for (let i = 0; i < metaRows.length; i++) {
    const meta = metaRows[i] || {};
    const sheetRow = titleLinesLen + 1 + i; // blank row included before aoaRows
    // meta aplicado fila completa (A..J)
    if (meta.separator) {
      for (let c = 0; c <= 9; c++) {
        const addr = XLSX.utils.encode_cell({ r: sheetRow, c });
        const cell = ws[addr];
        if (!cell) continue;
        cell.s = cell.s || {};
        cell.s.font = { bold: true, color: { rgb: "B00020" } };
        cell.s.fill = { patternType: "solid", fgColor: { rgb: "FCE4EC" } };
        cell.s.alignment = { vertical: "center", horizontal: "left", wrapText: true };
      }
    }
    if (meta.nuevo) {
      const addr = XLSX.utils.encode_cell({ r: sheetRow, c: 0 }); // AAPP
      const cell = ws[addr];
      if (cell) {
        cell.s = cell.s || {};
        cell.s.font = cell.s.font || {};
        cell.s.font.color = { rgb: "B00020" };
        cell.s.font.bold = true;
      }
    }
    if (meta.gt40Zero) {
      const addr = XLSX.utils.encode_cell({ r: sheetRow, c: 3 }); // Reales >40 (col D)
      const cell = ws[addr];
      if (cell) {
        cell.s = cell.s || {};
        cell.s.fill = { patternType: "solid", fgColor: { rgb: "F8BBD0" } }; // rojo claro
      }
    }
  }
}

  function sheetFromAOA(titleLines, aoaRows) {
    const aoa = [];
    for (const l of titleLines) aoa.push([l]);
    aoa.push([""]);
    aoa.push(headers);
    for (const r of aoaRows) aoa.push(r);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applyTableStyle(ws);
    return ws;
  }

  if (dataset?.mode === "zonal") {
    const rows = [];
    const metaRows = [];

    for (const t of dataset.teams) {
      const normales = (t.rows || []).filter(r => !r.isNuevo);
      const nuevos = (t.rows || []).filter(r => r.isNuevo);

      for (const r of normales) {
        rows.push([
          r.aapp,
          t.equipoNombre,
          r.realesTF, r.reales40, r.reales70, r.plan, r.pv, r.tope, r.sobre, r.bajo
        ]);
        metaRows.push({ nuevo: false, gt40Zero: Number(r.reales40 || 0) === 0 });
      }

      if (nuevos.length) {
        rows.push(["NUEVOS (según fecha de ingreso)", "", "", "", "", "", "", "", "", ""]);
        metaRows.push({ separator: true });

        for (const r of nuevos) {
          rows.push([
            r.aapp,
            t.equipoNombre,
            r.realesTF, r.reales40, r.reales70, r.plan, r.pv, r.tope, r.sobre, r.bajo
          ]);
          metaRows.push({ nuevo: true, gt40Zero: Number(r.reales40 || 0) === 0 });
        }
      }

      rows.push([
        "TOTAL",
        t.equipoNombre,
        t.tot.realesTF, t.tot.reales40, t.tot.reales70, t.tot.plan, t.tot.pv, t.tot.tope, t.tot.sobre, t.tot.bajo
      ]);
      metaRows.push({});

      rows.push(["",""]);
      metaRows.push({});
    }

    const titleLines = [`Reporte Ventas (Zonal)`, `Mes: ${dataset.monthStartISO} a ${dataset.monthEndISO}`];
    const ws = sheetFromAOA(titleLines, rows);
    applyMetaStyles(ws, titleLines.length, metaRows);

    XLSX.utils.book_append_sheet(wb, ws, "reporte-ventas");
  } else {
    const ds = dataset;

    
const rows = [];
const metaRows = [];

const normales = (ds.rows || []).filter(r => !r.isNuevo);
const nuevos = (ds.rows || []).filter(r => r.isNuevo);

for (const r of normales) {
  rows.push([r.aapp, ds.equipoNombre, r.realesTF, r.reales40, r.reales70, r.plan, r.pv, r.tope, r.sobre, r.bajo]);
  metaRows.push({ nuevo: false, gt40Zero: Number(r.reales40 || 0) === 0 });
}

if (nuevos.length) {
  rows.push(["NUEVOS (según fecha de ingreso)", "", "", "", "", "", "", "", "", ""]);
  metaRows.push({ separator: true });

  for (const r of nuevos) {
    rows.push([r.aapp, ds.equipoNombre, r.realesTF, r.reales40, r.reales70, r.plan, r.pv, r.tope, r.sobre, r.bajo]);
    metaRows.push({ nuevo: true, gt40Zero: Number(r.reales40 || 0) === 0 });
  }
}

    rows.push([
      "TOTAL",
      ds.equipoNombre,
      ds.tot.realesTF, ds.tot.reales40, ds.tot.reales70, ds.tot.plan, ds.tot.pv, ds.tot.tope, ds.tot.sobre, ds.tot.bajo
    ]);
    metaRows.push({});

    const titleLines = [`Reporte Ventas`, `Equipo: ${ds.equipoNombre}`, `Mes: ${ds.monthStartISO} a ${ds.monthEndISO}`];
    const ws = sheetFromAOA(titleLines, rows);
    applyMetaStyles(ws, titleLines.length, metaRows);
    XLSX.utils.book_append_sheet(wb, ws, "reporte-ventas");
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

    const selectedDay = parseSelectedDay(elDia?.value || toISODate(new Date()));
    const { first: monthStart, last: monthEnd } = monthBounds(selectedDay);
    const monthStartISO = toISODate(monthStart);
    const monthEndISO = toISODate(monthEnd);
    setRangoLabel({ monthStart, monthEnd });

    DATASET = null;
    elReporte.innerHTML = "";

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
      const teams = await cargarDatasetZonalBatch(equipos, monthStartISO, monthEndISO, selectedDay);

      const dsZ = { mode: "zonal", monthStartISO, monthEndISO, teams };
      DATASET = dsZ;
      estado("");
      renderZonal(dsZ);
      return;
    }

    
    // Supervisor: permitir 'Todos' los equipos visibles en el selector
    const selEq = document.getElementById("selectEquipo");
    if (selEq && selEq.value === "ALL") {
      estado("Cargando todos los equipos…");
      const equipos = Array.from(selEq.options)
        .map(o => o.value)
        .filter(v => v && v !== "ALL");
      const teams = [];
      for (const idEq of equipos) {
        const t = await cargarDatasetEquipo({ equipoId: idEq, monthStartISO, monthEndISO, fechaEmision: selectedDay });
        teams.push(t);
      }
      const dsAll = { mode: "zonal", monthStartISO, monthEndISO, teams };
      DATASET = dsAll;
      estado("");
      renderZonal(dsAll);
      return;
    }

    // Supervisor / Admin / etc: SOLO equipo actualmente visible
    const equipoId = getEquipoIdActual();
    if (!equipoId) throw new Error("No se encontró equipo activo.");

    estado("Cargando datos…");
    const ds = await cargarDatasetEquipo({ equipoId, monthStartISO, monthEndISO, fechaEmision: selectedDay });
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
    const suf = DATASET?.monthStartISO && DATASET?.monthEndISO ? `${DATASET.monthStartISO}_${DATASET.monthEndISO}` : "";
    exportarExcel(DATASET, `reporte-ventas_${suf}.xlsx`);
  } catch (e) {
    alert(e?.message || String(e));
  }
});

elDia?.addEventListener("change", refrescar);


elOrden?.addEventListener("change", () => {
  try {
    if (!DATASET) return refrescar();

    const modo = getOrdenModo();

    if (DATASET.mode === "zonal" && Array.isArray(DATASET.teams)) {
      DATASET.teams = DATASET.teams.map(t => {
        const rows = Array.isArray(t.rows) ? t.rows : [];
        const normales = rows.filter(r => !r.isNuevo);
        const nuevos = rows.filter(r => r.isNuevo);
        return { ...t, rows: [...ordenarRows(normales, modo), ...ordenarRows(nuevos, modo)] };
      });
      renderZonal(DATASET);
      return;
    }

    if (DATASET.mode === "supervisor" && Array.isArray(DATASET.rows)) {
      const rows = Array.isArray(DATASET.rows) ? DATASET.rows : [];
      const normales = rows.filter(r => !r.isNuevo);
      const nuevos = rows.filter(r => r.isNuevo);
      DATASET.rows = [...ordenarRows(normales, modo), ...ordenarRows(nuevos, modo)];
      renderSupervisor(DATASET);
      return;
    }

    // fallback
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
  if (window.__rv_equipo_listener_bound) return;
  window.__rv_equipo_listener_bound = true;
  sel.addEventListener("change", refrescar);
})();

(function init() {
  ensureDiaOptions();
  if (elDia && !elDia.value) elDia.value = toISODate(new Date());
  refrescar();
})();