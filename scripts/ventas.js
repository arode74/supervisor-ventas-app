// ================================
// VENTAS.JS - PANEL DE VENTAS
// Consolidado por vendedor + Alta / Edición por día
// ================================

import { supabase } from "../config.js";

// ================================
// UTILIDADES DE FECHA (LOCAL)
// ================================
function formatoFechaLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rangoMesActualYAnterior() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes0 = hoy.getMonth(); // 0–11

  const inicioMin = new Date(anio, mes0 - 1, 1); // 1er día mes anterior
  const finMax = new Date(anio, mes0 + 1, 0); // último día mes actual

  return {
    min: formatoFechaLocal(inicioMin),
    max: formatoFechaLocal(finMax),
    hoy: formatoFechaLocal(hoy),
  };
}

// ================================
// VALIDACIÓN DE FECHA PERMITIDA (NEGOCIO)
// Mes actual + últimos 2 días mes anterior si hoy es 1 o 2
// ================================
function fechaVentaPermitida(fechaVentaStr) {
  // ✅ NUEVO NEGOCIO: permitir grabar meses pasados.
  // Única restricción: no permitir fechas futuras.
  const hoy = new Date();
  const fechaVenta = new Date(fechaVentaStr + "T00:00:00");
  if (Number.isNaN(fechaVenta.getTime())) return false;

  const hoyISO = formatoFechaLocal(hoy);
  return String(fechaVentaStr) <= hoyISO;
}

// ================================
// NORMALIZACIÓN tipo_venta → BD
// Permitidos por constraint: TOPE, SOBRE, BAJO, PLAN, PV
// ================================
const TIPOS_PERMITIDOS = ["TOPE", "SOBRE", "BAJO", "PLAN", "PV"];

function normalizarTipoVenta(tipoRaw) {
  if (!tipoRaw) return null;
  let t = tipoRaw.toString().trim().toUpperCase();

  if (t === "PRODUCTO_VOLUNTARIO") t = "PV";

  if (!TIPOS_PERMITIDOS.includes(t)) return null;
  return t;
}

// ================================
// OFFLINE: COLA DE VENTAS PENDIENTES (solo alta)
// ================================
const KEY_VENTAS_PENDIENTES = "ventas_pendientes";

function obtenerVentasPendientes() {
  try {
    const raw = localStorage.getItem(KEY_VENTAS_PENDIENTES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error leyendo ventas pendientes offline:", e);
    return [];
  }
}

function guardarVentasPendientesOffline(registros) {
  try {
    const actuales = obtenerVentasPendientes();
    actuales.push(
      ...registros.map((r) => ({
        ...r,
        _offlineId: crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random(),
        _offlineTimestamp: new Date().toISOString(),
      }))
    );
    localStorage.setItem(KEY_VENTAS_PENDIENTES, JSON.stringify(actuales));
  } catch (e) {
    console.error("Error guardando ventas offline:", e);
  }
}

function limpiarVentasPendientes() {
  try {
    localStorage.setItem(KEY_VENTAS_PENDIENTES, "[]");
  } catch (e) {
    console.error("Error limpiando ventas offline:", e);
  }
}

async function sincronizarVentasPendientes() {
  const pendientes = obtenerVentasPendientes();
  if (!pendientes.length) return;

  const payload = pendientes
    .map(({ _offlineId, _offlineTimestamp, ...resto }) => {
      const tipoNorm = normalizarTipoVenta(resto.tipo_venta);
      if (!tipoNorm) return null;
      return { ...resto, tipo_venta: tipoNorm };
    })
    .filter((r) => r !== null);

  if (!payload.length) {
    console.warn("Ventas pendientes con tipo_venta inválido. Se limpia cola offline.");
    limpiarVentasPendientes();
    return;
  }

  try {
    const { error } = await supabase.from("ventas").insert(payload);
    if (error) {
      console.error("Error sincronizando ventas pendientes (Supabase):", error);
      if (error.code === "23514" || error.status === 400) {
        console.warn("Datos inválidos en ventas pendientes. Se limpia cola offline.");
        limpiarVentasPendientes();
      }
      return;
    }
    console.info("Ventas pendientes sincronizadas correctamente:", pendientes.length);
    limpiarVentasPendientes();
  } catch (err) {
    console.error("Error de red sincronizando ventas pendientes:", err);
  }
}

// ================================
// VARIABLES GLOBALES
// ================================
const urlParams = new URLSearchParams(window.location.search);
const idEquipoLS = localStorage.getItem("idEquipoActivo");
let idEquipo = idEquipoLS || urlParams.get("equipo");

const tablaVentas = document.getElementById("tablaVentas");
const tbodyVentas = tablaVentas ? tablaVentas.querySelector("tbody") : null;

const modal = document.getElementById("modalVenta");
const formVenta = document.getElementById("formVenta");
const tituloModal = document.getElementById("tituloModalVentasTitulo");
const tituloModalNombre = document.getElementById("tituloModalVentasNombre");
const btnCancelarVenta = document.getElementById("cancelarVenta");
const btnVolver = document.getElementById("btnVolver");
const selectMes = document.getElementById("selectMes");
const selectAnio = document.getElementById("selectAnio");
const selectDia = document.getElementById("selectDia"); // NUEVO: filtro de día
const fechaVentaInput = document.getElementById("fechaVenta");

const inputTope = document.getElementById("cantidadTope");
const inputSobre = document.getElementById("cantidadSobre");
const inputBajo = document.getElementById("cantidadBajo");
const inputPlan = document.getElementById("cantidadPlan");
const inputProductoVol = document.getElementById("cantidadProductoVol");

let usuarioActual = null;
let rolActual = null;
let idVendedorActual = null;
let nombreVendedorActual = null;
let ventasMesVendedorActual = [];
let feriadosMesVendedorActual = new Set();
let semanaBaseVendedor = null;

let datosTabla = [];
let estadoOrden = { col: "nombre", dir: "asc" };

let vendedorSeleccionadoId = null;
let vendedorSeleccionadoNombre = "";
let modoVenta = "nuevo"; // "nuevo" | "editar"
let fechaOriginalEdicion = null; // fecha base al abrir "Editar" (para mover sin perder ventas)

// ================================
// AUTENTICACIÓN
// ================================
async function obtenerUsuarioActual() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    alert("Debe iniciar sesión nuevamente.");
    window.location.href = "../index.html";
    return;
  }
  usuarioActual = data.user;
}

// ================================
// PERFIL DEL USUARIO
// ================================
async function obtenerPerfil() {
  // ✅ RBAC: rol vigente se obtiene desde user_roles -> perfiles (no desde profiles.role)
  const { data, error } = await supabase.rpc("get_perfil_actual", {
    p_user_id: usuarioActual.id,
  });

  if (error) {
    console.error("Error obteniendo perfil actual (RBAC):", error);
    return;
  }

  rolActual = data ? String(data).trim().toLowerCase() : null;
}


// ================================
// CONTEXTO COMERCIAL VENDEDOR
// Fuente de verdad para columna Vendedor: tabla vendedores
// ================================
async function obtenerContextoComercialVendedor() {
  idVendedorActual = null;
  nombreVendedorActual = null;
  if (!usuarioActual?.id) return null;

  const { data: vu, error: vuErr } = await supabase
    .from("vendedor_usuario")
    .select("id_vendedor")
    .eq("id_usuario", usuarioActual.id)
    .maybeSingle();

  if (vuErr) {
    console.error("Error obteniendo vendedor_usuario:", vuErr);
    return null;
  }

  idVendedorActual = vu?.id_vendedor || null;
  if (!idVendedorActual) return null;

  const { data: vend, error: vendErr } = await supabase
    .from("vendedores")
    .select("id_vendedor, nombre")
    .eq("id_vendedor", idVendedorActual)
    .maybeSingle();

  if (vendErr) {
    console.error("Error obteniendo nombre desde vendedores:", vendErr);
    return { id_vendedor: idVendedorActual, nombre: null };
  }

  nombreVendedorActual = vend?.nombre || null;
  return { id_vendedor: idVendedorActual, nombre: nombreVendedorActual };
}

function esPerfilVendedor() {
  return String(rolActual || "").toLowerCase() === "vendedor";
}

function aplicarVisibilidadAccionesPorPerfil() {
  if (!tablaVentas) return;
  const ocultar = esPerfilVendedor();
  const thAcciones = tablaVentas.querySelector("thead th:last-child");
  if (thAcciones && thAcciones.textContent.trim().toLowerCase().includes("acciones")) {
    thAcciones.style.display = ocultar ? "none" : "";
  }
  tablaVentas.querySelectorAll("td.acciones").forEach((td) => {
    td.style.display = ocultar ? "none" : "";
  });
}

function avInicioSemanaLunes(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function avAddDays(fecha, dias) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() + dias);
  return d;
}
function avFmtCorta(fecha) {
  return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
}
function avNombreDia(fecha) {
  return fecha.toLocaleDateString("es-CL", { weekday: "short" }).replace(".", "");
}

function avEsFinDeSemana(fecha) {
  const dia = fecha.getDay();
  return dia === 0 || dia === 6;
}

function avEsFeriado(fecha) {
  return feriadosMesVendedorActual.has(formatoFechaLocal(fecha));
}

function avEsDiaHabil(fecha) {
  return !avEsFinDeSemana(fecha) && !avEsFeriado(fecha);
}

async function cargarFeriadosMesVendedor(desde, hasta) {
  feriadosMesVendedorActual = new Set();
  try {
    const { data, error } = await supabase
      .from("feriados")
      .select("fecha")
      .gte("fecha", desde)
      .lt("fecha", hasta);

    if (error) {
      console.warn("⚠️ No se pudieron cargar feriados. Se omiten solo fines de semana.", error);
      return;
    }

    feriadosMesVendedorActual = new Set(
      (data || [])
        .map((f) => String(f.fecha || "").slice(0, 10))
        .filter(Boolean)
    );
  } catch (e) {
    console.warn("⚠️ Error cargando feriados. Se omiten solo fines de semana.", e);
  }
}

function avAsegurarResumenSemanalVendedorUI() {
  if (!tablaVentas || document.getElementById("resumenSemanaVendedor")) return;
  if (!document.getElementById("resumen-semana-vendedor-style")) {
    const style = document.createElement("style");
    style.id = "resumen-semana-vendedor-style";
    style.textContent = `
      #resumenSemanaVendedor{ margin-top:18px; border:1px solid #d8e3f0; border-radius:10px; overflow:hidden; background:#fff; }
      #resumenSemanaVendedor .rs-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; background:#eef6ff; color:#003366; font-weight:700; }
      #resumenSemanaVendedor .rs-title{ text-align:center; flex:1; }
      #resumenSemanaVendedor .rs-nav{ min-width:42px; height:34px; border:0; border-radius:8px; background:#005baa; color:#fff; font-weight:700; cursor:pointer; }
      #resumenSemanaVendedor .rs-nav:disabled{ opacity:.35; cursor:not-allowed; }
      #tablaSemanaVendedor{ width:100%; border-collapse:collapse; }
      #tablaSemanaVendedor th{ background:#c6def4; color:#003366; padding:9px; text-align:center; }
      #tablaSemanaVendedor td{ padding:9px; border-top:1px solid #edf2f7; text-align:center; }
      #tablaSemanaVendedor td:first-child{ text-align:left; font-weight:600; color:#003366; }
    `;
    document.head.appendChild(style);
  }
  const wrap = document.createElement("div");
  wrap.id = "resumenSemanaVendedor";
  wrap.innerHTML = `
    <div class="rs-head">
      <button type="button" id="btnSemanaAnteriorVendedor" class="rs-nav">‹</button>
      <div id="tituloSemanaVendedor" class="rs-title">Semana</div>
      <button type="button" id="btnSemanaSiguienteVendedor" class="rs-nav">›</button>
    </div>
    <table id="tablaSemanaVendedor">
      <thead><tr><th>Día</th><th>Tope</th><th>Sobre</th><th>Bajo</th><th>Plan</th><th>PV</th></tr></thead>
      <tbody></tbody>
    </table>`;
  tablaVentas.insertAdjacentElement("afterend", wrap);

  document.getElementById("btnSemanaAnteriorVendedor")?.addEventListener("click", () => {
    const { mes, anio } = obtenerMesAnioFiltro();
    const mesInicio = new Date(anio, mes - 1, 1);
    const propuesta = avAddDays(avInicioSemanaLunes(semanaBaseVendedor || mesInicio), -7);
    semanaBaseVendedor = propuesta < mesInicio ? mesInicio : propuesta;
    renderResumenSemanalVendedor();
  });
  document.getElementById("btnSemanaSiguienteVendedor")?.addEventListener("click", () => {
    const { mes, anio } = obtenerMesAnioFiltro();
    const mesFin = new Date(anio, mes, 0);
    const propuesta = avAddDays(avInicioSemanaLunes(semanaBaseVendedor || mesFin), 7);
    if (propuesta <= mesFin) semanaBaseVendedor = propuesta;
    renderResumenSemanalVendedor();
  });
}

function renderResumenSemanalVendedor() {
  const wrap = document.getElementById("resumenSemanaVendedor");
  if (!wrap) return;
  wrap.style.display = esPerfilVendedor() ? "block" : "none";
  if (!esPerfilVendedor()) return;

  const { mes, anio } = obtenerMesAnioFiltro();
  const mesInicio = new Date(anio, mes - 1, 1);
  const mesFin = new Date(anio, mes, 0);

  if (!semanaBaseVendedor) {
    const base = selectDia?.value ? new Date(selectDia.value + "T00:00:00") : new Date();
    semanaBaseVendedor = avInicioSemanaLunes(base);
  }

  const baseLunes = avInicioSemanaLunes(semanaBaseVendedor);
  let semanaInicio = baseLunes < mesInicio ? mesInicio : baseLunes;
  let semanaFin = avAddDays(baseLunes, 6);
  if (semanaFin > mesFin) semanaFin = mesFin;

  const titulo = document.getElementById("tituloSemanaVendedor");
  if (titulo) titulo.textContent = `Semana ${avFmtCorta(semanaInicio)} al ${avFmtCorta(semanaFin)}`;

  const btnPrev = document.getElementById("btnSemanaAnteriorVendedor");
  const btnNext = document.getElementById("btnSemanaSiguienteVendedor");

  // Permite llegar a la primera semana parcial del mes (ej.: 01/04).
  if (btnPrev) btnPrev.disabled = semanaInicio <= mesInicio;
  if (btnNext) btnNext.disabled = semanaFin >= mesFin;

  const porDia = new Map();
  for (let d = new Date(semanaInicio); d <= semanaFin; d = avAddDays(d, 1)) {
    if (!avEsDiaHabil(d)) continue;
    porDia.set(formatoFechaLocal(d), { tope: 0, sobre: 0, bajo: 0, plan: 0, pv: 0 });
  }

  (ventasMesVendedorActual || []).forEach((v) => {
    const fecha = String(v.fecha_venta || "").slice(0, 10);
    const row = porDia.get(fecha);
    if (!row) return;

    const monto = Number(v.monto || 0);
    switch (normalizarTipoVenta(v.tipo_venta)) {
      case "TOPE": row.tope += monto; break;
      case "SOBRE": row.sobre += monto; break;
      case "BAJO": row.bajo += monto; break;
      case "PLAN": row.plan += monto; break;
      case "PV": row.pv += monto; break;
      default: break;
    }
  });

  const tbody = document.querySelector("#tablaSemanaVendedor tbody");
  if (!tbody) return;

  const fmt = (v) => Number(v || 0).toLocaleString("de-DE");
  const filas = Array.from(porDia.entries()).map(([fecha, r]) => {
    const d = new Date(fecha + "T00:00:00");
    return `<tr><td>${avNombreDia(d)} ${avFmtCorta(d)}</td><td>${fmt(r.tope)}</td><td>${fmt(r.sobre)}</td><td>${fmt(r.bajo)}</td><td>${fmt(r.plan)}</td><td>$ ${fmt(r.pv)}</td></tr>`;
  });

  tbody.innerHTML = filas.length
    ? filas.join("")
    : `<tr><td colspan="6" style="text-align:center;">Sin días hábiles para mostrar en esta semana.</td></tr>`;
}

// ================================
// FILTROS DE FECHA (MES / AÑO / DÍA)
// ================================
function inicializarDiaFiltro() {
  if (!selectDia) return;
  const hoy = new Date();
  selectDia.value = formatoFechaLocal(hoy);
}

function obtenerMesAnioFiltro() {
  const hoy = new Date();
  const mes = selectMes ? parseInt(selectMes.value) || hoy.getMonth() + 1 : hoy.getMonth() + 1;
  const anio = selectAnio ? parseInt(selectAnio.value) || hoy.getFullYear() : hoy.getFullYear();
  return { mes, anio };
}

function sincronizarDiaConMesAnio() {
  if (!selectDia) return;
  const { mes, anio } = obtenerMesAnioFiltro();

  let dia = 1;
  if (selectDia.value) {
    const d = new Date(selectDia.value + "T00:00:00");
    if (!Number.isNaN(d.getTime())) {
      dia = d.getDate();
    }
  } else {
    const hoy = new Date();
    dia = hoy.getDate();
  }

  const ultimoDiaMes = new Date(anio, mes, 0).getDate();
  if (dia > ultimoDiaMes) dia = ultimoDiaMes;

  const mm = String(mes).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  selectDia.value = `${anio}-${mm}-${dd}`;
}

function sincronizarMesAnioConDia() {
  if (!selectDia || !selectDia.value) return;
  const d = new Date(selectDia.value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return;

  if (selectMes) selectMes.value = String(d.getMonth() + 1);
  if (selectAnio) selectAnio.value = String(d.getFullYear());
}

function inicializarFiltrosFecha() {
  if (!selectMes || !selectAnio) return;

  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  selectAnio.innerHTML = "";
  for (let year = anioActual - 1; year <= anioActual + 1; year++) {
    const opt = document.createElement("option");
    opt.value = year.toString();
    opt.textContent = year.toString();
    selectAnio.appendChild(opt);
  }

  selectMes.value = mesActual.toString();
  selectAnio.value = anioActual.toString();

  // Día por defecto = hoy
  inicializarDiaFiltro();
  // Ajustar día para que quede consistente con mes/año inicial
  sincronizarDiaConMesAnio();

  // Eventos
  if (selectDia) {
    selectDia.addEventListener("change", () => {
      sincronizarMesAnioConDia();
      semanaBaseVendedor = selectDia.value ? avInicioSemanaLunes(new Date(selectDia.value + "T00:00:00")) : null;
      cargarVentas();
    });
  }

  selectMes.addEventListener("change", () => {
    sincronizarDiaConMesAnio();
    semanaBaseVendedor = selectDia?.value ? avInicioSemanaLunes(new Date(selectDia.value + "T00:00:00")) : null;
    cargarVentas();
  });

  selectAnio.addEventListener("change", () => {
    sincronizarDiaConMesAnio();
    semanaBaseVendedor = selectDia?.value ? avInicioSemanaLunes(new Date(selectDia.value + "T00:00:00")) : null;
    cargarVentas();
  });
}

// ================================
// FECHA VENTA (RANGO MES ACTUAL + ANTERIOR)
// ================================
function configurarRangoFechaVenta() {
  if (!fechaVentaInput) return;

  const hoy = new Date();
  const hoyISO = formatoFechaLocal(hoy);

  // ✅ NUEVO NEGOCIO: permitir registrar en meses pasados.
  // Rango amplio hacia atrás para no bloquear operación histórica.
  // Si necesitas acotar (ej. 24 meses), se ajusta acá.
  const minFecha = "2020-01-01";

  fechaVentaInput.min = minFecha;
  fechaVentaInput.max = hoyISO;

  // No sobre-escribimos si ya hay una fecha seleccionada válida.
  if (!fechaVentaInput.value || fechaVentaInput.value > hoyISO) {
    fechaVentaInput.value = hoyISO;
  }
}

// ================================
// ORDENAMIENTO TABLA
// ================================
function inicializarOrdenamiento() {
  const ths = document.querySelectorAll("th.th-sortable");
  ths.forEach((th) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (!col) return;

      if (estadoOrden.col === col) {
        estadoOrden.dir = estadoOrden.dir === "asc" ? "desc" : "asc";
      } else {
        estadoOrden.col = col;
        estadoOrden.dir = "asc";
      }

      aplicarOrdenYRender();
    });
  });
}

function actualizarIndicadoresOrden() {
  const ths = document.querySelectorAll("th.th-sortable");
  ths.forEach((th) => {
    const col = th.dataset.col;
    const span = th.querySelector(".sort-arrow");
    if (!span) return;

    if (col === estadoOrden.col) {
      span.textContent = estadoOrden.dir === "asc" ? "▲" : "▼";
    } else {
      span.textContent = "";
    }
  });
}

// ================================
// RENDER TABLA (MES + DÍA CON AGRUPAR)
// ================================
function aplicarOrdenYRender() {
  if (!tbodyVentas) return;

  const col = estadoOrden.col;
  const dir = estadoOrden.dir === "asc" ? 1 : -1;

  const datosOrdenados = [...datosTabla].sort((a, b) => {
    if (col === "nombre") {
      return a.nombre.localeCompare(b.nombre, "es") * dir;
    } else {
      const va = Number(a[col] || 0);
      const vb = Number(b[col] || 0);
      return (va - vb) * dir;
    }
  });

  tbodyVentas.innerHTML = "";

  if (datosOrdenados.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="${esPerfilVendedor() ? 6 : 7}" style="text-align:center;">Sin datos para el período seleccionado</td>`;
    tbodyVentas.appendChild(row);
    actualizarIndicadoresOrden();
    return;
  }

  const formatMiles = (v) => Number(v || 0).toLocaleString("de-DE");

  datosOrdenados.forEach((m) => {
    // FILA PRINCIPAL: ventas del DÍA
    const rowDia = document.createElement("tr");
    rowDia.dataset.idVendedor = m.id_vendedor;
    rowDia.classList.add("fila-dia-ventas");

    const accionesHtml = esPerfilVendedor()
      ? ""
      : `
      <td class="acciones">
        <button type="button" class="btn-accion btn-agregar-venta" title="Agregar ventas del día">➕</button>
        <button type="button" class="btn-accion btn-editar-ventas" title="Editar ventas del día">✏️</button>
      </td>`;

    rowDia.innerHTML = `
      <td class="col-vendedor">
        <button type="button" class="btn-toggle-detalle" data-id-vendedor="${m.id_vendedor}">+</button>
        <span class="nombre-vendedor">${m.nombre}</span>
      </td>
      <td class="celda-dia">${m.dia_tope || 0}</td>
      <td class="celda-dia">${m.dia_sobre || 0}</td>
      <td class="celda-dia">${m.dia_bajo || 0}</td>
      <td class="celda-dia">${m.dia_plan || 0}</td>
      <td class="celda-dia">$ ${formatMiles(m.dia_productoVoluntario || 0)}</td>
      ${accionesHtml}
    `;
    tbodyVentas.appendChild(rowDia);

    // FILA SECUNDARIA: acumulado MES
    const rowMes = document.createElement("tr");
    rowMes.dataset.idVendedor = m.id_vendedor;
    rowMes.classList.add("fila-mes-ventas", "detalle-mes");
	
	// oculto por defecto → viene AGRUPADO
	rowMes.style.display = "none";

    rowMes.innerHTML = `
      <td class="col-mes-label">Mes</td>
      <td>${m.tope}</td>
      <td>${m.sobre}</td>
      <td>${m.bajo}</td>
      <td>${m.plan}</td>
      <td>$ ${formatMiles(m.productoVoluntario)}</td>
      ${esPerfilVendedor() ? "" : "<td></td>"}
    `;
    tbodyVentas.appendChild(rowMes);
  });

  actualizarIndicadoresOrden();
  aplicarVisibilidadAccionesPorPerfil();
}

// ================================
// CARGA CONSOLIDADO DE VENTAS
// ================================
async function cargarVentas() {
  try {
    if (!tbodyVentas) return;

    const { mes, anio } = obtenerMesAnioFiltro();

    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 1);
    const desde = formatoFechaLocal(inicio);
    const hasta = formatoFechaLocal(fin);

    const fechaDia = selectDia && selectDia.value ? selectDia.value : null;

    // SUPERVISOR → consolidado por equipo
    if (rolActual === "supervisor" && idEquipo) {
      const { data: vendedoresEquipo, error: errorVends } = await supabase
        .from("equipo_vendedor")
        .select(
          `
          id_vendedor,
          vendedores (
            id_vendedor,
            nombre
          )
        `
        )
        .eq("id_equipo", idEquipo)
        .eq("estado", true);

      if (errorVends) throw errorVends;

      if (!vendedoresEquipo || vendedoresEquipo.length === 0) {
        datosTabla = [];
        tbodyVentas.innerHTML = "";
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="7" style="text-align:center;">Sin vendedores asociados al equipo</td>`;
        tbodyVentas.appendChild(row);
        actualizarIndicadoresOrden();
        return;
      }

      const ids = vendedoresEquipo
        .filter((rel) => rel.vendedores)
        .map((rel) => rel.vendedores.id_vendedor);

      let ventasData = [];
      if (ids.length > 0) {
        const { data: ventas, error: errorVentas } = await supabase
          .from("ventas")
          .select(`id_venta, id_vendedor, fecha_venta, monto, tipo_venta`)
          .in("id_vendedor", ids)
          .gte("fecha_venta", desde)
          .lt("fecha_venta", hasta);

        if (errorVentas) throw errorVentas;
        ventasData = ventas || [];
      }

      const metricasPorVendedor = {};
      vendedoresEquipo.forEach((rel) => {
        const vend = rel.vendedores;
        if (!vend) return;
        metricasPorVendedor[vend.id_vendedor] = {
          id_vendedor: vend.id_vendedor,
          nombre: vend.nombre,
          // MES
          tope: 0,
          sobre: 0,
          bajo: 0,
          plan: 0,
          productoVoluntario: 0,
          // DÍA
          dia_tope: 0,
          dia_sobre: 0,
          dia_bajo: 0,
          dia_plan: 0,
          dia_productoVoluntario: 0,
        };
      });

      ventasData.forEach((v) => {
        const entry = metricasPorVendedor[v.id_vendedor];
        if (!entry) return;

        const tipo = normalizarTipoVenta(v.tipo_venta);
        const monto = Number(v.monto || 0);
        const esDiaObjetivo = fechaDia && String(v.fecha_venta) === fechaDia;

        switch (tipo) {
          case "TOPE":
            entry.tope += monto;
            if (esDiaObjetivo) entry.dia_tope += monto;
            break;
          case "SOBRE":
            entry.sobre += monto;
            if (esDiaObjetivo) entry.dia_sobre += monto;
            break;
          case "BAJO":
            entry.bajo += monto;
            if (esDiaObjetivo) entry.dia_bajo += monto;
            break;
          case "PLAN":
            entry.plan += monto;
            if (esDiaObjetivo) entry.dia_plan += monto;
            break;
          case "PV":
            entry.productoVoluntario += monto;
            if (esDiaObjetivo) entry.dia_productoVoluntario += monto;
            break;
          default:
            break;
        }
      });

      datosTabla = Object.values(metricasPorVendedor);
      aplicarOrdenYRender();
      const rs = document.getElementById("resumenSemanaVendedor");
      if (rs) rs.style.display = "none";
      return;
    }

    // VENDEDOR → su propio consolidado
    if (!idVendedorActual) await obtenerContextoComercialVendedor();

    if (!idVendedorActual) {
      datosTabla = [];
      ventasMesVendedorActual = [];
      aplicarOrdenYRender();
      avAsegurarResumenSemanalVendedorUI();
      renderResumenSemanalVendedor();
      return;
    }

    await cargarFeriadosMesVendedor(desde, hasta);

    const { data, error } = await supabase
      .from("ventas")
      .select(`id_venta, id_vendedor, fecha_venta, monto, tipo_venta`)
      .eq("id_vendedor", idVendedorActual)
      .gte("fecha_venta", desde)
      .lt("fecha_venta", hasta);

    if (error) throw error;
    ventasMesVendedorActual = data || [];

    const m = {
      id_vendedor: idVendedorActual,
      nombre: nombreVendedorActual || "Vendedor",
      // MES
      tope: 0,
      sobre: 0,
      bajo: 0,
      plan: 0,
      productoVoluntario: 0,
      // DÍA
      dia_tope: 0,
      dia_sobre: 0,
      dia_bajo: 0,
      dia_plan: 0,
      dia_productoVoluntario: 0,
    };

    (data || []).forEach((v) => {
      const tipo = normalizarTipoVenta(v.tipo_venta);
      const monto = Number(v.monto || 0);
      const esDiaObjetivo = fechaDia && String(v.fecha_venta) === fechaDia;

      switch (tipo) {
        case "TOPE":
          m.tope += monto;
          if (esDiaObjetivo) m.dia_tope += monto;
          break;
        case "SOBRE":
          m.sobre += monto;
          if (esDiaObjetivo) m.dia_sobre += monto;
          break;
        case "BAJO":
          m.bajo += monto;
          if (esDiaObjetivo) m.dia_bajo += monto;
          break;
        case "PLAN":
          m.plan += monto;
          if (esDiaObjetivo) m.dia_plan += monto;
          break;
        case "PV":
          m.productoVoluntario += monto;
          if (esDiaObjetivo) m.dia_productoVoluntario += monto;
          break;
        default:
          break;
      }
    });

    datosTabla = [m];
    aplicarOrdenYRender();
    avAsegurarResumenSemanalVendedorUI();
    renderResumenSemanalVendedor();
  } catch (err) {
    console.error("Error al cargar ventas:", err);
    alert("Error al cargar ventas. Revisa consola.");
  }
}

// ================================
// MODAL NUEVA / EDITAR VENTA
// ================================
function resetCantidadesModal() {
  // UX: inputs vacíos por defecto (evita el "10" por cursor delante de 0)
  if (inputTope) inputTope.value = "";
  if (inputSobre) inputSobre.value = "";
  if (inputBajo) inputBajo.value = "";
  if (inputPlan) inputPlan.value = "";
  if (inputProductoVol) inputProductoVol.value = "";
}

function setTituloModal(modo, nombreVendedor) {
  if (!tituloModal) return;
  const nombre = nombreVendedor || "Vendedor";
  if (modo === "editar") {
    tituloModal.textContent = `Editar Ventas - `;
  } else {
    tituloModal.textContent = `Registrar Ventas - `;
  }
  if (tituloModalNombre) {
    tituloModalNombre.textContent = nombre;
  } else {
    tituloModal.textContent += nombre;
  }
}

function abrirModalNuevaVentaPara(idVendedor, nombreVendedor) {
  vendedorSeleccionadoId = idVendedor || null;
  vendedorSeleccionadoNombre = nombreVendedor || "";
  modoVenta = "nuevo";

  
  fechaOriginalEdicion = null;
setTituloModal("nuevo", vendedorSeleccionadoNombre);
  configurarRangoFechaVenta();
  inicializarBotonesCantidad();
  // Usar el día seleccionado en el filtro como fecha por defecto
  if (selectDia && fechaVentaInput && selectDia.value) {
    fechaVentaInput.value = selectDia.value;
  }
  resetCantidadesModal();

  if (modal) {
    modal.classList.remove("oculto");
    if (typeof modal.showModal === "function" && !modal.open) {
      modal.showModal();
    }
  }
}

async function cargarVentasDiaEnModal(idVendedor, fecha) {
  if (!idVendedor || !fecha) return;

  try {
    const { data, error } = await supabase
      .from("ventas")
      .select("monto, tipo_venta")
      .eq("id_vendedor", idVendedor)
      .eq("fecha_venta", fecha);

    if (error) {
      console.error("Error cargando ventas del día para edición:", error);
      return;
    }

    let totTope = 0;
    let totSobre = 0;
    let totBajo = 0;
    let totPlan = 0;
    let totPV = 0;

    (data || []).forEach((v) => {
      const tipo = normalizarTipoVenta(v.tipo_venta);
      const monto = Number(v.monto || 0);
      switch (tipo) {
        case "TOPE":
          totTope += monto;
          break;
        case "SOBRE":
          totSobre += monto;
          break;
        case "BAJO":
          totBajo += monto;
          break;
        case "PLAN":
          totPlan += monto;
          break;
        case "PV":
          totPV += monto;
          break;
        default:
          break;
      }
    });

    if (inputTope) inputTope.value = totTope === 0 ? "" : String(totTope);
    if (inputSobre) inputSobre.value = totSobre === 0 ? "" : String(totSobre);
    if (inputBajo) inputBajo.value = totBajo === 0 ? "" : String(totBajo);
    if (inputPlan) inputPlan.value = totPlan === 0 ? "" : String(totPlan);
    if (inputProductoVol) {
      const n = Number(totPV || 0);
      inputProductoVol.value = n === 0 ? "" : n.toLocaleString("de-DE");
    }
  } catch (err) {
    console.error("Error general cargando ventas del día para edición:", err);
  }
}

function abrirModalEditarVentaPara(idVendedor, nombreVendedor) {
  vendedorSeleccionadoId = idVendedor || null;
  vendedorSeleccionadoNombre = nombreVendedor || "";
  modoVenta = "editar";

  setTituloModal("editar", vendedorSeleccionadoNombre);
  configurarRangoFechaVenta();
  inicializarBotonesCantidad();
  // Usar el día seleccionado como fecha base de edición
  if (selectDia && fechaVentaInput && selectDia.value) {
    fechaVentaInput.value = selectDia.value;
  }
    // ✅ Guardar fecha base de edición (la que estaba seleccionada al abrir Editar)
  fechaOriginalEdicion = fechaVentaInput?.value || null;
resetCantidadesModal();

  const fecha = fechaVentaInput?.value;
  if (fecha) {
    cargarVentasDiaEnModal(vendedorSeleccionadoId, fecha);
  }

  if (modal) {
    modal.classList.remove("oculto");
    if (typeof modal.showModal === "function" && !modal.open) {
      modal.showModal();
    }
  }
}

// Cuando cambia la fecha en modo edición, recargar totales del día
if (fechaVentaInput) {
  fechaVentaInput.addEventListener("change", () => {
    // En modo EDITAR, NO recargamos automáticamente los valores del nuevo día,
    // porque pisaría las cantidades actuales y puede dejar ventas en 0 sin que el usuario lo note.
    // La confirmación de “mover día” se hace al guardar.
    if (modoVenta === "editar") return;
  });
}

// ================================
// BOTONES + / - (UNA SOLA VEZ)
// ================================
function inicializarBotonesCantidad() {
  if (!formVenta || formVenta.dataset.cantidadInit === "1") return;
  formVenta.dataset.cantidadInit = "1";

  formVenta.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-cantidad");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const targetId = btn.dataset.target;
    const delta = parseInt(btn.dataset.delta || "0", 10);
    if (!targetId || !Number.isFinite(delta)) return;

    const input = document.getElementById(targetId);
    if (!input) return;

    const actual = parseInt(input.value || "0", 10);
    let nuevo = actual + delta;
    if (nuevo < 0) nuevo = 0;

    input.value = String(nuevo);
  });
}

// ================================
// AUTOFORMATEO PRODUCTO VOLUNTARIO
// ================================
if (inputProductoVol) {
  inputProductoVol.addEventListener("input", () => {
    let raw = inputProductoVol.value.replace(/\D/g, "");

    // Permitir vacío (no forzar "0" mientras escribe)
    if (raw === "") {
      inputProductoVol.value = "";
      return;
    }

    if (raw.length > 9) raw = raw.slice(0, 9);

    let num = Number(raw || "0");
    if (num > 999999999) num = 999999999;

    inputProductoVol.value = num.toLocaleString("de-DE");
  });

  inputProductoVol.addEventListener("blur", () => {
    let raw = inputProductoVol.value.replace(/\D/g, "");

    // Si queda vacío, lo dejamos vacío (0 se interpreta al guardar)
    if (raw === "") {
      inputProductoVol.value = "";
      return;
    }

    let num = Number(raw || "0");
    if (num > 999999999) num = 999999999;

    inputProductoVol.value = num.toLocaleString("de-DE");
  });
}

// Cancelar modal
if (btnCancelarVenta && modal && formVenta) {
  btnCancelarVenta.addEventListener("click", () => {
    if (typeof modal.close === "function") {
      modal.close();
    }
    modal.classList.add("oculto");
    formVenta.reset();
    resetCantidadesModal();
  });
}

// ================================
// SUBMIT: GUARDAR VENTAS (NUEVO / EDITAR)
// ================================
if (formVenta) {
  formVenta.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fecha = fechaVentaInput?.value;
    if (!fecha) {
      alert("Debe seleccionar la fecha de la venta.");
      return;
    }
    // VALIDACIÓN DE NEGOCIO: rango permitido
    if (!fechaVentaPermitida(fecha)) {
      alert("No puedes ingresar ventas con fecha futura.");
      return;
    }


    const tope = parseInt(inputTope?.value || "0", 10);
    const sobre = parseInt(inputSobre?.value || "0", 10);
    const bajo = parseInt(inputBajo?.value || "0", 10);
    const plan = parseInt(inputPlan?.value || "0", 10);

    const prodRaw = inputProductoVol?.value ? inputProductoVol.value.replace(/\D/g, "") : "0";
    let prod = parseInt(prodRaw || "0", 10);
    if (prod > 999999999) prod = 999999999;
    if (isNaN(prod)) prod = 0;

    const total = tope + sobre + bajo + plan + prod;
    if (total === 0) {
      alert("Debe ingresar al menos una venta.");
      return;
    }

    const idVendedor = vendedorSeleccionadoId || idVendedorActual || usuarioActual.id;

    const registros = [];

    if (tope > 0) {
      registros.push({
        id_vendedor: idVendedor,
        fecha_venta: fecha,
        monto: tope,
        descripcion: "",
        tipo_venta: "TOPE",
      });
    }
    if (sobre > 0) {
      registros.push({
        id_vendedor: idVendedor,
        fecha_venta: fecha,
        monto: sobre,
        descripcion: "",
        tipo_venta: "SOBRE",
      });
    }
    if (bajo > 0) {
      registros.push({
        id_vendedor: idVendedor,
        fecha_venta: fecha,
        monto: bajo,
        descripcion: "",
        tipo_venta: "BAJO",
      });
    }
    if (plan > 0) {
      registros.push({
        id_vendedor: idVendedor,
        fecha_venta: fecha,
        monto: plan,
        descripcion: "",
        tipo_venta: "PLAN",
      });
    }
    if (prod > 0) {
      registros.push({
        id_vendedor: idVendedor,
        fecha_venta: fecha,
        monto: prod,
        descripcion: "",
        tipo_venta: "PV",
      });
    }

    if (modoVenta === "nuevo") {
      // ============================
      // MODO NUEVO: mantiene lógica offline
      // ============================
      try {
        const { error } = await supabase.from("ventas").insert(registros);

        if (error) {
          console.error("Error al registrar ventas en Supabase:", error);
          const msg = (error.message || "").toLowerCase();

          if (msg.includes("failed to fetch") || msg.includes("network")) {
            guardarVentasPendientesOffline(registros);
            alert(
              "No hay conexión o hubo un problema con la red. Las ventas se guardaron en el dispositivo para sincronizar más adelante."
            );
            if (typeof modal.close === "function") modal.close();
            modal.classList.add("oculto");
            formVenta.reset();
            resetCantidadesModal();
            return;
          }

          alert(
            "Error al registrar las ventas en el servidor:\n" + (error.message || "Revisar consola.")
          );
          return;
        }

        alert("Ventas registradas correctamente.");
        if (typeof modal.close === "function") modal.close();
        modal.classList.add("oculto");
        formVenta.reset();
        resetCantidadesModal();
        await cargarVentas();
        await sincronizarVentasPendientes();
      } catch (err) {
        console.error("Excepción al insertar ventas (probable problema de red):", err);
        guardarVentasPendientesOffline(registros);
        alert(
          "No hay conexión o hubo un problema con el servidor. Las ventas se guardaron en el dispositivo para sincronizar más adelante."
        );
        if (typeof modal.close === "function") modal.close();
        modal.classList.add("oculto");
        formVenta.reset();
        resetCantidadesModal();
      }
    } else {
      // ============================
// MODO EDITAR: usa RPC editar_ventas_dia
// - Si cambia fecha: confirmar + guardar en nueva fecha (snapshot) + luego vaciar fecha original
// ============================
      try {
        // Snapshot de valores actuales (ANTES de cualquier acción)
        const fechaNueva = fecha;
        const fechaOrigen = fechaOriginalEdicion;

        if (fechaOrigen && fechaNueva && fechaNueva !== fechaOrigen) {
          const ok = confirm(
            `Vas a mover estas ventas del día ${fechaOrigen} al día ${fechaNueva}.

` +
            `Esto reemplazará las ventas existentes en el día destino y dejará el día origen en 0.

` +
            `¿Confirmas el cambio?`
          );
          if (!ok) {
            // Revertir fecha y salir sin tocar datos
            if (fechaVentaInput) fechaVentaInput.value = fechaOrigen;
            return;
          }
        }
        // 1) Guardar/actualizar en la fecha destino (siempre)
        const { data, error } = await supabase.rpc("editar_ventas_dia", {
          p_id_vendedor: idVendedor,
          p_fecha_venta: fecha,
          p_registros: registros,
        });

if (error) {
          console.error("Error al actualizar ventas del día (RPC):", error);

          const msg = (error.message || "").toUpperCase();

          if (msg.includes("PERMISO_DENEGADO")) {
            alert("No tienes permisos para editar las ventas de este vendedor.");
          } else {
            alert(
              "Error al actualizar las ventas del día.\n" +
                (error.message || "Revisar consola.")
            );
          }
          return;
        }

        // 2) Si hubo cambio de fecha, vaciar el día origen DESPUÉS de guardar en destino
        if (fechaOriginalEdicion && fecha && fechaOriginalEdicion !== fecha) {
          const { error: errVaciar } = await supabase.rpc("editar_ventas_dia", {
            p_id_vendedor: idVendedor,
            p_fecha_venta: fechaOriginalEdicion,
            p_registros: [],
          });
          if (errVaciar) {
            // No abortamos el guardado ya hecho, pero avisamos: aquí hay inconsistencia
            console.error("Error al vaciar ventas del día origen (mover):", errVaciar);
            alert(
              "Se guardó la venta en el nuevo día, pero no se pudo limpiar el día original.\n" +
              "Revisa permisos/RLS o la función editar_ventas_dia."
            );
          } else {
            // actualizar base de edición
            fechaOriginalEdicion = fecha;
          }
        }

        alert("Ventas del día actualizadas correctamente.");
        if (typeof modal.close === "function") modal.close();
        modal.classList.add("oculto");
        formVenta.reset();
        resetCantidadesModal();
        await cargarVentas();
      } catch (err) {
        console.error("Error general al llamar editar_ventas_dia:", err);
        alert(
          "Error al actualizar las ventas del día.\n" +
            (err?.message || "Revisar consola.")
        );
      }
    }
  });
}

// ================================
// ACCIONES DE FILA (AGRUPAR, +, ✏️)
// ================================
if (tbodyVentas) {
  tbodyVentas.addEventListener("click", (e) => {
    const btnToggle = e.target.closest(".btn-toggle-detalle");
    if (btnToggle) {
      const idVendedor = btnToggle.dataset.idVendedor;
      const filaMes = tbodyVentas.querySelector(
        `tr.detalle-mes[data-id-vendedor="${idVendedor}"]`
      );
      if (!filaMes) return;
      const visible = filaMes.style.display !== "none";
      filaMes.style.display = visible ? "none" : "";
      btnToggle.textContent = visible ? "+" : "−";
      return;
    }

    const btnAgregar = e.target.closest(".btn-agregar-venta");
    const btnEditar = e.target.closest(".btn-editar-ventas");
    if (!btnAgregar && !btnEditar) return;

    const filaDia = e.target.closest("tr.fila-dia-ventas");
    if (!filaDia) return;

    const idVendedor = filaDia.dataset.idVendedor;
    const nombre =
      filaDia.querySelector(".nombre-vendedor")?.textContent?.trim() || "";

    if (btnAgregar) {
      abrirModalNuevaVentaPara(idVendedor, nombre);
      return;
    }

    if (btnEditar) {
      abrirModalEditarVentaPara(idVendedor, nombre);
      return;
    }
  });
}

// ================================
// BOTÓN VOLVER
// ================================
btnVolver.addEventListener("click", (e) => {
  const panelBotones = document.getElementById("panel-botones");
  const contenedorModulos = document.getElementById("contenedor-modulos");

  // Si está embebido en supervisor, NO hacemos nada aquí.
  // supervisor.js ya engancha este botón y se encarga del volver.
  if (panelBotones && contenedorModulos) {
    return;
  }

  // Fallback solo si se abrió ventas.html directo
  e.preventDefault();
  window.location.href = "../views/supervisor.html";
});


// ================================
// INIT
// ================================
(async function init() {
  await obtenerUsuarioActual();
  await obtenerPerfil();
  await obtenerContextoComercialVendedor();
  inicializarFiltrosFecha();
  avAsegurarResumenSemanalVendedorUI();
  inicializarOrdenamiento();
  configurarRangoFechaVenta();
  inicializarBotonesCantidad();
  await sincronizarVentasPendientes();
  await cargarVentas();

  // 🔁 Refrescar ventas y vendedores cuando cambia el equipo del supervisor
  window.addEventListener("equipo:change", (ev) => {
    const nuevo = ev?.detail?.idEquipo;
    if (!nuevo || nuevo === idEquipo) return;

    idEquipo = nuevo;

    // Reset mínimo de estado dependiente del equipo
    vendedorSeleccionadoId = null;
    vendedorSeleccionadoNombre = "";
    modoVenta = "nuevo";
    fechaOriginalEdicion = null;

    cargarVentas();
  });

  window.addEventListener("online", () => {
    sincronizarVentasPendientes();
  });
})();
