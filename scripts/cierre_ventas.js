// ============================================
// CIERRE_VENTAS.JS - CIERRE MENSUAL DE VENTAS
// - 1 fila por vendedor (sin agrupación)
// - Carga vendedores que estuvieron en el equipo AL MENOS 1 DÍA del mes
// - Mes/Año: por defecto mes anterior al actual (enero -> dic año anterior)
// - Robusto en modo embebido (espera a que exista el DOM inyectado)
// ============================================

import { supabase } from "../config.js";

// --------------------------------------------
// Utils fecha
// --------------------------------------------
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rangoMes(anio, mes1a12) {
  const inicio = new Date(anio, mes1a12 - 1, 1);
  const finIncl = new Date(anio, mes1a12, 0); // último día del mes
  return { inicio, finIncl, iniMes: ymd(inicio), finMes: ymd(finIncl) };
}

function mesAnteriorPorDefecto() {
  const d = new Date();
  d.setDate(1); // evita saltos fin de mes
  d.setMonth(d.getMonth() - 1);
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// --------------------------------------------
// Estado global
// --------------------------------------------
const urlParams = new URLSearchParams(window.location.search);
const idEquipoLS = localStorage.getItem("idEquipoActivo");
let idEquipo = idEquipoLS || urlParams.get("equipo");

let usuarioActual = null;
let rolActual = null;

let tabla = null;
let tbody = null;
let btnVolver = null;
let selectMes = null;
let selectAnio = null;

// Cache de montos existentes del mes (para decidir deletes)
let existentesPorVendedor = new Map(); // id_vendedor -> { TOPE: n, ... }

// --------------------------------------------
// Helpers DOM (modo embebido)
// --------------------------------------------
function bindDOM() {
  tabla = document.getElementById("tablaCierre");
  tbody = tabla ? tabla.querySelector("tbody") : null;
  btnVolver = document.getElementById("btnVolver");
  selectMes = document.getElementById("selectMes");
  selectAnio = document.getElementById("selectAnio");
  return !!(tabla && tbody && selectMes && selectAnio);
}

async function esperarDOM(maxMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (bindDOM()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return bindDOM();
}

// --------------------------------------------
// Auth + perfil
// --------------------------------------------
async function obtenerUsuarioActual() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    alert("Debe iniciar sesión nuevamente.");
    window.location.href = "../index.html";
    return false;
  }
  usuarioActual = data.user;
  return true;
}

async function obtenerPerfil() {
  // tu tabla es public.profile (singular)
  const { data, error } = await supabase
    .from("profile")
    .select("role")
    .eq("id", usuarioActual.id)
    .single();

  if (error) {
    console.error("Error obteniendo perfil:", error);
    rolActual = null;
    return;
  }
  rolActual = data?.role || null;
}

// --------------------------------------------
// Filtros Mes/Año
// --------------------------------------------
function inicializarFiltros() {
  if (!selectMes || !selectAnio) return;

  // Cargar años (más amplio para evitar vacío)
  const hoy = new Date();
  const anioActual = hoy.getFullYear();

  selectAnio.innerHTML = "";
  for (let y = anioActual - 3; y <= anioActual + 1; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    selectAnio.appendChild(opt);
  }

  // Default: mes anterior
  const def = mesAnteriorPorDefecto();
  selectMes.value = String(def.mes);
  selectAnio.value = String(def.anio);

  // Si por algún motivo el año no existe en la lista, lo agregamos
  if (![...selectAnio.options].some((o) => o.value === String(def.anio))) {
    const opt = document.createElement("option");
    opt.value = String(def.anio);
    opt.textContent = String(def.anio);
    selectAnio.appendChild(opt);
    selectAnio.value = String(def.anio);
  }

  // Eventos
  selectMes.addEventListener("change", cargarCierre);
  selectAnio.addEventListener("change", cargarCierre);
}

function obtenerMesAnioFiltro() {
  const def = mesAnteriorPorDefecto();
  const mes = parseInt(selectMes?.value || "", 10) || def.mes;
  const anio = parseInt(selectAnio?.value || "", 10) || def.anio;
  return { mes, anio };
}

// --------------------------------------------
// Datos: vendedores activos al menos 1 día en el mes para el equipo
// overlap: fecha_inicio <= finMes AND (fecha_fin IS NULL OR fecha_fin >= iniMes)
// --------------------------------------------
async function obtenerVendedoresDelMes(idEquipo, anio, mes) {
  const { iniMes, finMes } = rangoMes(anio, mes);

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
    .eq("id_equipo", idEquipo)
    .lte("fecha_inicio", finMes)
    .or(`fecha_fin.is.null,fecha_fin.gte.${iniMes}`);

  if (error) throw error;

  const rows = (data || [])
    .filter((r) => r?.vendedores?.id_vendedor)
    .map((r) => ({
      id_vendedor: r.vendedores.id_vendedor,
      nombre: r.vendedores.nombre,
    }));

  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (seen.has(r.id_vendedor)) continue;
    seen.add(r.id_vendedor);
    out.push(r);
  }
  out.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
  return out;
}

// --------------------------------------------
// Datos: montos existentes (si existe tabla ventas_mensuales)
// Estructura esperada: id_equipo, id_vendedor, mes, anio, tipo_venta, monto
// --------------------------------------------
async function obtenerMontosExistentes(idEquipo, anio, mes, idsVendedores) {
  existentesPorVendedor = new Map();
  if (!idsVendedores?.length) return;

  try {
    const { data, error } = await supabase
      .from("ventas_mensuales")
      .select("id_vendedor, tipo_venta, monto")
      .eq("id_equipo", idEquipo)
      .eq("anio", anio)
      .eq("mes", mes)
      .in("id_vendedor", idsVendedores);

    if (error) throw error;

    (data || []).forEach((r) => {
      const id = r.id_vendedor;
      const tipo = String(r.tipo_venta || "").toUpperCase();
      const monto = Number(r.monto || 0);

      if (!existentesPorVendedor.has(id)) existentesPorVendedor.set(id, {});
      existentesPorVendedor.get(id)[tipo] = monto;
    });
  } catch (err) {
    console.warn("No se pudo leer ventas_mensuales (grilla vacía):", err?.message || err);
    existentesPorVendedor = new Map();
  }
}

// --------------------------------------------
// Render grilla
// --------------------------------------------
function render(vendedores) {
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!idEquipo) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay equipo seleccionado</td></tr>`;
    return;
  }

  if (!vendedores.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Sin vendedores para el período seleccionado</td></tr>`;
    return;
  }

  for (const v of vendedores) {
    const ex = existentesPorVendedor.get(v.id_vendedor) || {};
    const tr = document.createElement("tr");
    tr.dataset.idVendedor = v.id_vendedor;

    tr.innerHTML = `
      <td class="col-vendedor"><span class="nombre-vendedor">${v.nombre || ""}</span></td>

      <td><input class="input-cierre" type="number" min="0" step="1" data-tipo="TOPE" value="${ex.TOPE ?? ""}"></td>
      <td><input class="input-cierre" type="number" min="0" step="1" data-tipo="SOBRE" value="${ex.SOBRE ?? ""}"></td>
      <td><input class="input-cierre" type="number" min="0" step="1" data-tipo="BAJO" value="${ex.BAJO ?? ""}"></td>
      <td><input class="input-cierre" type="number" min="0" step="1" data-tipo="PLAN" value="${ex.PLAN ?? ""}"></td>
      <td><input class="input-cierre" type="number" min="0" step="1" data-tipo="PV" value="${ex.PV ?? ""}"></td>

      <td class="acciones">
        <button type="button" class="btn-accion btn-guardar-cierre" title="Guardar cierre mensual">💾 Guardar</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

// --------------------------------------------
// Guardado por fila (upsert + delete)
// --------------------------------------------
function construirPayloadFila(tr, anio, mes) {
  const idVendedor = tr?.dataset?.idVendedor;
  if (!idEquipo || !idVendedor) return null;

  const inputs = [...tr.querySelectorAll("input.input-cierre")];
  const valores = {};
  for (const inp of inputs) {
    const tipo = String(inp.dataset.tipo || "").toUpperCase();
    const n = numOrNull(inp.value);
    valores[tipo] = n;
  }

  const payloadUpsert = [];
  const payloadDeleteTipos = [];
  const ex = existentesPorVendedor.get(idVendedor) || {};

  for (const tipo of ["TOPE", "SOBRE", "BAJO", "PLAN", "PV"]) {
    const v = valores[tipo];
    const vNum = v === null ? 0 : Number(v || 0);

    if (v !== null && vNum > 0) {
      payloadUpsert.push({
        id_equipo: idEquipo,
        id_vendedor: idVendedor,
        anio,
        mes,
        tipo_venta: tipo,
        monto: vNum,
        descripcion: "EMPTY",
      });
    } else {
      if (ex[tipo] !== undefined) payloadDeleteTipos.push(tipo);
    }
  }

  return { idVendedor, payloadUpsert, payloadDeleteTipos };
}

async function guardarFila(tr) {
  const { mes, anio } = obtenerMesAnioFiltro();
  const built = construirPayloadFila(tr, anio, mes);
  if (!built) return;

  const { idVendedor, payloadUpsert, payloadDeleteTipos } = built;

  if (!payloadUpsert.length && !payloadDeleteTipos.length) {
    alert("No hay datos para guardar (ni cambios que eliminar).");
    return;
  }

  try {
    if (payloadUpsert.length) {
      const { error } = await supabase
        .from("ventas_mensuales")
        .upsert(payloadUpsert, { onConflict: "id_equipo,id_vendedor,anio,mes,tipo_venta" });
      if (error) throw error;
    }

    if (payloadDeleteTipos.length) {
      const { error: errDel } = await supabase
        .from("ventas_mensuales")
        .delete()
        .eq("id_equipo", idEquipo)
        .eq("id_vendedor", idVendedor)
        .eq("anio", anio)
        .eq("mes", mes)
        .in("tipo_venta", payloadDeleteTipos);
      if (errDel) throw errDel;
    }

    alert("Cierre mensual guardado.");
    await cargarCierre();
  } catch (err) {
    console.error("Error guardando cierre mensual:", err);
    alert(
      "No se pudo guardar el cierre mensual.\n" +
        "Causa probable: la tabla ventas_mensuales aún no existe o falta permiso/RLS.\n" +
        (err?.message || "Revisar consola.")
    );
  }
}

// --------------------------------------------
// Carga principal
// --------------------------------------------
async function cargarCierre() {
  try {
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Cargando…</td></tr>`;

    if (!idEquipo) {
      render([]);
      return;
    }

    const { mes, anio } = obtenerMesAnioFiltro();

    // Nota: rol puede venir como 'supervisor' o 'SUPERVISOR'
    const rol = String(rolActual || "").toLowerCase();
    if (rol && rol !== "supervisor") {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Este módulo es solo para supervisor</td></tr>`;
      return;
    }

    const vendedores = await obtenerVendedoresDelMes(idEquipo, anio, mes);
    const ids = vendedores.map((v) => v.id_vendedor);

    await obtenerMontosExistentes(idEquipo, anio, mes, ids);
    render(vendedores);
  } catch (err) {
    console.error("Error cargando cierre mensual:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Error cargando datos (revisa consola)</td></tr>`;
  }
}

// --------------------------------------------
// Eventos UI
// --------------------------------------------
function bindEventos() {
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-guardar-cierre");
      if (!btn) return;
      const tr = e.target.closest("tr");
      if (!tr) return;
      guardarFila(tr);
    });
  }

  if (btnVolver) {
    btnVolver.addEventListener("click", (e) => {
      const panelBotones = document.getElementById("panel-botones");
      const contenedorModulos = document.getElementById("contenedor-modulos");
      if (panelBotones && contenedorModulos) return; // supervisor.js maneja volver
      e.preventDefault();
      window.location.href = "../views/supervisor.html";
    });
  }

  // refrescar cuando cambia el equipo activo en supervisor
  window.addEventListener("equipo:change", (ev) => {
    const nuevo = ev?.detail?.idEquipo;
    if (!nuevo || nuevo === idEquipo) return;
    idEquipo = nuevo;
    cargarCierre();
  });
}

// --------------------------------------------
// INIT
// --------------------------------------------
(async function init() {
  const okDom = await esperarDOM(4000);
  if (!okDom) {
    console.error("CIERRE_VENTAS: No se encontraron elementos del DOM (tabla/filtros).");
    return;
  }

  const okUser = await obtenerUsuarioActual();
  if (!okUser) return;

  await obtenerPerfil();
  inicializarFiltros();
  bindEventos();
  await cargarCierre();
})();
