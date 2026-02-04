import { supabase } from "../config.js";

const ROOT_ID = "modulo-cierre-ventas";

let tabla = null;
let tbody = null;
let btnGuardarCierre = null;
let selectMes = null;
let selectAnio = null;

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
  const s = String(v).trim();
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
    return;
  }

  for (const v of vendedores) {
    const ex = existentesPorVendedor.get(v.id_vendedor) || {};
    const tr = document.createElement("tr");
    tr.dataset.idVendedor = v.id_vendedor;
    tr.dataset.dirty = "0";

    tr.innerHTML = `
      <td>${v.nombre}</td>
      <td><input class="input-cierre" data-tipo="BAJO"  type="number" value="${(ex.TOPE + ex.SOBRE + ex.BAJO) || ""}"></td>
      <td><input class="input-cierre" data-tipo="SOBRE" type="number" value="${(ex.TOPE + ex.SOBRE) || ""}"></td>
      <td><input class="input-cierre" data-tipo="TOPE"  type="number" value="${ex.TOPE || ""}"></td>
      <td><input class="input-cierre" data-tipo="PLAN"  type="number" value="${ex.PLAN || ""}"></td>
      <td><input class="input-cierre" data-tipo="PV"    type="number" value="${ex.PV || ""}"></td>
    `;

    // Al cambiar cualquier input, la fila queda dirty
    tr.querySelectorAll("input.input-cierre").forEach((inp) => {
      inp.addEventListener("input", () => marcarFilaDirty(tr));
      inp.addEventListener("change", () => marcarFilaDirty(tr));
    });

    tbody.appendChild(tr);
  }
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
    const pv   = numOrZero(tr.querySelector('input[data-tipo="PV"]')?.value);

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

  btnGuardarCierre.addEventListener("click", guardarTodo);
  selectMes.addEventListener("change", cargarCierre);
  selectAnio.addEventListener("change", cargarCierre);

  await cargarCierre();
})();
