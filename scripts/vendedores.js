// ================================
// VENDEDORES.JS — Módulo de gestión de vendedores
// Usa cliente Supabase único desde config.js
// ================================

import { supabase } from "../config.js";


// ============================================================
// RBAC: Supervisor = auth.uid() (fuente única)
// - No se usa localStorage/sessionStorage para identidad
// ============================================================
let __AV_SUPERVISOR_UID = null;

async function ensureSupervisorUid() {
  if (__AV_SUPERVISOR_UID) return __AV_SUPERVISOR_UID;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  __AV_SUPERVISOR_UID = data.user.id;
  // compat legacy en memoria (NO storage)
  window.idSupervisorActivo = __AV_SUPERVISOR_UID;
  return __AV_SUPERVISOR_UID;
}

function getSupervisorUid() {
  return __AV_SUPERVISOR_UID || window.idSupervisorActivo || null;
}
// Namespace para APP Ventas (módulo Vendedores)
const AppVentas = (window.AppVentas = window.AppVentas || {});
AppVentas.features = AppVentas.features || {};
AppVentas.features.vendedores = AppVentas.features.vendedores || {};

// 🔹 IMPORTANTE: declarar aquí, ANTES de usarlo en init()
let idSupervisorActivo = null;

/**
 * init() del módulo Vendedores
 * (antes estaba como IIFE al final del archivo)
 */
AppVentas.features.vendedores.init = async function () {
  try {
    console.log(
      "DEBUG ▶ iniciando módulo vendedores, intentando recuperar sesión..."
    );

    // 1) Si existe una función global obtenerUsuarioActivo (flujo supervisor embebido)
    if (window.obtenerUsuarioActivo) {
      const usuario = await window.obtenerUsuarioActivo();
      console.log(
        "DEBUG ▶ obtenerUsuarioActivo() en módulo vendedores:",
        usuario
      );
      if (!usuario || !usuario.id) {
        window.location.href = "../index.html";
        return;
      }
      idSupervisorActivo = usuario.id;
// (RBAC) idSupervisorActivo eliminado: supervisor = auth.uid()
    } else {
      // 2) Fallback: lee de localStorage (flujo antiguo, entrando directo a vendedores.html)
      const userRaw = localStorage.getItem("user");
      const supRaw  = getSupervisorUid();

      if (!userRaw && !supRaw) {
        console.warn("No hay sesión válida, redirigiendo a login.");
        window.location.href = "../index.html";
        return;
      }

      const dataUser = userRaw ? JSON.parse(userRaw) : {};
      idSupervisorActivo = dataUser.id || supRaw;

      if (!idSupervisorActivo) {
        console.warn("No se pudo determinar idSupervisorActivo, redirigiendo.");
        window.location.href = "../index.html";
        return;
      }
// (RBAC) idSupervisorActivo eliminado: supervisor = auth.uid()
      console.log("DEBUG ▶ idSupervisorActivo (fallback):", idSupervisorActivo);
    }

    // 3) Una vez que tenemos idSupervisorActivo, inicializamos UI
    inicializarModuloVendedores();
  } catch (err) {
    console.error("Error en init() de módulo vendedores:", err);
    mostrarAlerta("Error inicializando módulo de vendedores.");
  }
};

/* ===========================================================
   LIMPIEZA ALERTA RESIDUAL
   =========================================================== */
(function limpiarAlertaResidual() {
  const alertaResidual = document.getElementById("alertaInstitucional");
  if (alertaResidual) {
    alertaResidual.classList.remove("activa");
    alertaResidual.style.display = "none";
    alertaResidual.removeAttribute("open");
  }
})();

/* ===========================================================
   REFERENCIAS DOM
   =========================================================== */
const tablaVendedores          = document.getElementById("tablaVendedores");
const chkVigentes              = document.getElementById("chkVigentes");
const modalNuevoVendedor       = document.getElementById("modalNuevoVendedor");
const btnGuardarVendedor       = document.getElementById("btnGuardarVendedor");
const selectEquipoModal        = document.getElementById("selectEquipoModal");
const inputRut                 = document.getElementById("rutVendedor");
const inputNombre              = document.getElementById("nombreVendedor");
const inputFechaIngreso        = document.getElementById("fechaIngreso");
const formNuevoVendedor        = document.getElementById("formNuevoVendedor");

// Modal editar
const modalEditarVendedor      = document.getElementById("modalEditarVendedor");
const formEditarVendedor       = document.getElementById("formEditarVendedor");
const btnGuardarEdicion        = document.getElementById("btnGuardarEdicion");
const btnCerrarEditar          = document.getElementById("btnCerrarEditarVendedor");
const inputEditRut             = document.getElementById("editRutVendedor");
const inputEditNombre          = document.getElementById("editNombreVendedor");
const inputEditFechaIngreso    = document.getElementById("editFechaIngreso");
const inputEditFechaEgreso     = document.getElementById("editFechaEgreso");
const selectEditEquipo         = document.getElementById("editEquipoSelect");
const inputEditRevertirBaja    = document.getElementById("editRevertirBaja");
const filaRevertirBaja         = document.getElementById("filaRevertirBaja");

// Modal baja
const modalBajaVendedor        = document.getElementById("modalBajaVendedor");
const textoBajaVendedor        = document.getElementById("textoBajaVendedor");
const inputFechaBajaVendedor   = document.getElementById("fechaBajaVendedor");
const btnConfirmarBajaVendedor = document.getElementById("btnConfirmarBajaVendedor");
const btnCancelarBajaVendedor  = document.getElementById("btnCancelarBajaVendedor");
const btnCerrarBajaVendedor    = document.getElementById("btnCerrarBajaVendedor");
const bloqueVentasPosteriores  = document.getElementById("bloqueVentasPosteriores");
const listaVentasPosteriores   = document.getElementById("listaVentasPosteriores");

// Modal advertencia cambio fecha ingreso
const modalAdvertenciaCambioFecha = document.getElementById("modalAdvertenciaCambioFecha");
const listaVentasCambioFecha      = document.getElementById("listaVentasCambioFecha");
const btnConfirmarCambioFecha     = document.getElementById("btnConfirmarCambioFecha");
const btnCancelarCambioFecha      = document.getElementById("btnCancelarCambioFecha");

/* ===========================================================
   HELPERS PARA DIALOGS
   =========================================================== */
function abrirDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch (e) {
        console.error("Error abriendo dialog:", e);
      }
    }
  } else {
    dialog.setAttribute("open", "open");
  }
}

function cerrarDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    try {
      dialog.close();
    } catch (e) {
      console.error("Error cerrando dialog:", e);
    }
  } else {
    dialog.removeAttribute("open");
  }
}

function cerrarTodosLosModales() {
  cerrarDialog(modalEditarVendedor);
  cerrarDialog(modalBajaVendedor);
  cerrarDialog(modalAdvertenciaCambioFecha);
  const alerta = document.getElementById("alertaInstitucional");
  if (alerta) {
    alerta.classList.remove("activa");
    alerta.style.display = "none";
    alerta.style.opacity = "0";
    alerta.style.pointerEvents = "none";
  }
}

/* ===========================================================
   ESTADO EN MEMORIA
   =========================================================== */
// 🔹 OJO: aquí YA NO debe estar idSupervisorActivo
let vendedores                   = [];
let vendedoresOriginal           = [];
let equiposSupervisor            = [];
let vendedorEditando             = null;
let vendedorEnBaja               = null;
let ventasPosterioresEncontradas = [];
let estadoCambioFechaPendiente   = null;

/* ===========================================================
   CACHE (tabla vendedores) — mejora performance UX
   - usa sessionStorage (por pestaña)
   - TTL corto para no mostrar info vieja
   =========================================================== */
const VENDEDORES_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

function _cacheKeyVendedores(soloVigentes) {
  // idSupervisorActivo se setea en init() antes de cargar datos
  const sup = idSupervisorActivo || "na";
  return `av_vendedores_${sup}_${soloVigentes ? "vigentes" : "todos"}`;
}

function leerCacheVendedores(soloVigentes) {
  try {
    const raw = sessionStorage.getItem(_cacheKeyVendedores(soloVigentes));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.ts !== "number" || !Array.isArray(obj.data)) return null;
    if (Date.now() - obj.ts > VENDEDORES_CACHE_TTL_MS) return null;
    return obj.data;
  } catch {
    return null;
  }
}

function guardarCacheVendedores(soloVigentes, data) {
  try {
    sessionStorage.setItem(
      _cacheKeyVendedores(soloVigentes),
      JSON.stringify({ ts: Date.now(), data: Array.isArray(data) ? data : [] })
    );
  } catch {}
}

function limpiarCacheVendedores() {
  try {
    // limpia solo claves del supervisor activo
    const sup = idSupervisorActivo || "na";
    const pref = `av_vendedores_${sup}_`;
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(pref)) sessionStorage.removeItem(k);
    }
  } catch {}
}


/* ===========================================================
   ALERTA INSTITUCIONAL
   =========================================================== */
function mostrarAlerta(mensaje) {
  const alerta    = document.getElementById("alertaInstitucional");
  const mensajeEl = document.getElementById("alertaMensaje");
  const btnCerrar = document.getElementById("btnCerrarAlerta");

  if (!alerta || !mensajeEl || !btnCerrar) {
    alert(mensaje);
    return;
  }

  const contenedorModal =
    document.querySelector("#modalNuevoVendedor") ||
    document.querySelector("#modalEditarVendedor") ||
    document.querySelector("#modalBajaVendedor") ||
    document.body;

  if (contenedorModal && !contenedorModal.contains(alerta)) {
    contenedorModal.appendChild(alerta);
  }

  mensajeEl.textContent = mensaje;
  alerta.style.display   = "flex";
  alerta.style.opacity   = "1";
  alerta.style.pointerEvents = "auto";
  alerta.classList.add("activa");

  btnCerrar.onclick = () => {
    alerta.classList.remove("activa");
    alerta.style.opacity   = "0";
    alerta.style.display   = "none";
    alerta.style.pointerEvents = "none";
    btnCerrar.onclick = null;
  };
}

/* ===========================================================
   UTIL RUT
   =========================================================== */
function formatearRut(cuerpo, dv) {
  const c = String(cuerpo);
  const cuerpoFmt = c.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoFmt}-${dv}`;
}

function limpiarRut(rutStr) {
  return (rutStr || "").replace(/[^0-9kK]/g, "");
}

/* ===========================================================
   UTIL NOMBRE
   =========================================================== */
function normalizarNombre(nombre) {
  if (!nombre) return "";
  return nombre
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/* ===========================================================
   ORDENAMIENTO TABLA
   =========================================================== */
let sortState = {
  key: null,
  dir: "asc",
};

function compareValues(a, b, key) {
  let va, vb;

  if (key === "nombre") {
    va = (a.nombre_vendedor || a.nombre || "").toUpperCase();
    vb = (b.nombre_vendedor || b.nombre || "").toUpperCase();
  } else if (key === "rut") {
    va = a.rut || 0;
    vb = b.rut || 0;
  } else if (key === "equipo") {
    va = (a.nombre_equipo || "").toUpperCase();
    vb = (b.nombre_equipo || "").toUpperCase();
  } else if (key === "fecha_ingreso") {
    va = a.fecha_ingreso || "";
    vb = b.fecha_ingreso || "";
  } else if (key === "fecha_egreso") {
    va = a.fecha_egreso || "";
    vb = b.fecha_egreso || "";
  } else {
    va = a[key];
    vb = b[key];
  }

  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
}

function applySort(data, sortState) {
  if (!sortState.key) return data;
  const arr = [...data];
  arr.sort((a, b) => {
    const base = compareValues(a, b, sortState.key);
    return sortState.dir === "asc" ? base : -base;
  });
  return arr;
}

function updateSortIndicators() {
  const thead = tablaVendedores?.querySelector("thead");
  if (!thead) return;

  thead.querySelectorAll("th[data-col]").forEach(th => {
    const col = th.dataset.col;
    th.classList.remove("sort-asc", "sort-desc");
    if (col === sortState.key) {
      th.classList.add(sortState.dir === "asc" ? "sort-asc" : "sort-desc");
    }
  });
}

function bindHeaderSorting() {
  const thead = tablaVendedores?.querySelector("thead");
  if (!thead) return;

  const cols = [
    { selector: "th:nth-child(1)", key: "nombre" },
    { selector: "th:nth-child(2)", key: "rut" },
    { selector: "th:nth-child(3)", key: "equipo" },
    { selector: "th:nth-child(4)", key: "fecha_ingreso" },
    { selector: "th:nth-child(5)", key: "fecha_egreso" },
  ];

  cols.forEach(col => {
    const th = thead.querySelector(col.selector);
    if (!th) return;
    th.dataset.col = col.key;
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      if (sortState.key === col.key) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState.key = col.key;
        sortState.dir = "asc";
      }
      renderizarTablaVendedores();
    });
  });
}

/* ===========================================================
   ESTADO RUT EN ALTA
   =========================================================== */
let estadoRutActual = {
  valido: false,
  existe: false,
  tieneVigente: false,
  ultimaFechaEgreso: null,
};

function resetEstadoRut() {
  estadoRutActual = {
    valido: false,
    existe: false,
    tieneVigente: false,
    ultimaFechaEgreso: null,
  };
}

/* ===========================================================
   VALIDACIÓN RUT EN BD
   =========================================================== */
async function verificarRutEnBD(rutNum, dv) {
  try {
    const { data, error } = await supabase
      .from("vendedores")
      .select("id_vendedor, fecha_egreso")
      .eq("rut", rutNum)
      .eq("dv", dv.toUpperCase());

    if (error) {
      console.error("Error verificando RUT en BD:", error);
      mostrarAlerta("Error al verificar el RUT en la base de datos.");
      resetEstadoRut();
      return;
    }

    if (!data || data.length === 0) {
      estadoRutActual = {
        valido: true,
        existe: false,
        tieneVigente: false,
        ultimaFechaEgreso: null,
      };
      return;
    }

    // Hay registros con ese RUT
    const vigente = data.find(v => !v.fecha_egreso);
    if (vigente) {
      estadoRutActual = {
        valido: true,
        existe: true,
        tieneVigente: true,
        ultimaFechaEgreso: null,
      };
      mostrarAlerta("Ya existe un vendedor vigente con ese RUT.");
      return;
    }

    const historicos = data
      .filter(v => v.fecha_egreso)
      .sort((a, b) => (a.fecha_egreso < b.fecha_egreso ? 1 : -1));
    const ultima = historicos[0] || null;

    estadoRutActual = {
      valido: true,
      existe: true,
      tieneVigente: false,
      ultimaFechaEgreso: ultima ? ultima.fecha_egreso : null,
    };

    if (ultima && ultima.fecha_egreso) {
      mostrarAlerta(
        `Este RUT ya estuvo registrado y fue dado de baja el ${ultima.fecha_egreso}. ` +
          `Si lo recontratas, se creará un nuevo registro de vendedor.`
      );
    }
  } catch (err) {
    console.error("Error general verificando RUT:", err);
    mostrarAlerta("Error al verificar el RUT en la base de datos.");
    resetEstadoRut();
  }
}

/* ===========================================================
   VALIDACIÓN RUT + NOMBRE EN ALTA (EVENTOS)
   =========================================================== */
inputRut?.addEventListener("input", e => {
  e.target.value = e.target.value.replace(/\s/g, "");
  resetEstadoRut();
});

inputRut?.addEventListener("blur", async e => {
  let valor = e.target.value.replace(/[^\dkK]/g, "").toUpperCase();
  if (valor.length < 2) return;

  const dv     = valor.slice(-1);
  const cuerpo = valor.slice(0, -1);

  // Formatear visual
  const rutFmt = formatearRut(cuerpo, dv);
  e.target.value = rutFmt;

  // Validación DV
  let suma = 0,
    mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const resto = 11 - (suma % 11);
  const dvOk  = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);

  if (dv !== dvOk) {
    mostrarAlerta("El RUT ingresado no es válido.");
    resetEstadoRut();
    return;
  }

  const rutNum = parseInt(cuerpo, 10);
  if (!isNaN(rutNum)) {
    await verificarRutEnBD(rutNum, dv);
  }
});

inputNombre?.addEventListener("blur", e => {
  let texto = e.target.value.trim().toLowerCase();
  e.target.value = texto
    .split(/\s+/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
});

inputEditNombre?.addEventListener("blur", e => {
  let texto = e.target.value.trim().toLowerCase();
  e.target.value = texto
    .split(/\s+/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
});

/* ===========================================================
   CARGA DE EQUIPOS Y VENDEDORES
   =========================================================== */
async function cargarEquipos() {
  try {
    const { data, error } = await supabase
      .from("vista_equipo_supervisor_dia")
      .select("id_equipo, nombre_equipo, vigente")
      .eq("id_supervisor", idSupervisorActivo);

    if (error) {
      console.error("Error al cargar equipos:", error);
      mostrarAlerta("No fue posible cargar los equipos.");
      return;
    }

    equiposSupervisor = (data || []).filter(e => e.vigente);

    if (!selectEquipoModal) return;

    selectEquipoModal.innerHTML = "";

    if (!equiposSupervisor.length) {
      const opt = document.createElement("option");
      opt.textContent = "No hay equipos asignados";
      selectEquipoModal.appendChild(opt);
      return;
    }

    equiposSupervisor.forEach(eq => {
      const opt = document.createElement("option");
      opt.value = eq.id_equipo;
      opt.textContent = eq.nombre_equipo;
      selectEquipoModal.appendChild(opt);
    });
  } catch (err) {
    console.error("Error al cargar equipos:", err);
    mostrarAlerta("No fue posible cargar los equipos.");
  }
}

async function cargarVendedores() {
  if (!tablaVendedores) return;

  try {
    const soloVigentes = !!chkVigentes?.checked;

    // 1) Pintar inmediato desde cache (si existe)
    const cache = leerCacheVendedores(soloVigentes);
    if (cache) {
      vendedores = cache;
      renderizarTablaVendedores();
    }

    // 2) Source of truth: 1 RPC
    const { data, error } = await supabase.rpc("get_vendedores_supervisor", {
      p_solo_vigentes: soloVigentes,
    });

    if (error) {
      console.error("Error al cargar vendedores (RPC):", error);
      if (!cache) mostrarAlerta("No fue posible cargar los vendedores.");
      return;
    }

    vendedores = Array.isArray(data) ? data : [];
    guardarCacheVendedores(soloVigentes, vendedores);

    // Si había cache, actualiza; si no, renderiza ahora
    renderizarTablaVendedores();
  } catch (e) {
    console.error("Error inesperado al cargar vendedores:", e);
    mostrarAlerta("Error inesperado al cargar vendedores.");
  }
}

/* ===========================================================
   RENDER TABLA
   =========================================================== */
function rutFormateado(rut, dv) {
  if (rut == null || dv == null) return "";
  return formatearRut(rut, dv);
}

function renderizarTablaVendedores() {
  if (!tablaVendedores) return;
  const tbody = tablaVendedores.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!vendedores.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="6" class="texto-centro">No hay vendedores para mostrar.</td>';
    tbody.appendChild(tr);
    return;
  }

  const dataOrdenada = applySort(vendedores, sortState);

  dataOrdenada.forEach(v => {
    const tr = document.createElement("tr");
    tr.dataset.idVendedor = v.id_vendedor;
    tr.dataset.idEquipo   = v.id_equipo;

    const rutFmt = v.rut_vendedor_formateado || rutFormateado(v.rut, v.dv);

    tr.innerHTML = `
      <td>${v.nombre_vendedor || v.nombre || ""}</td>
      <td>${rutFmt}</td>
      <td>${v.nombre_equipo || ""}</td>
      <td>${v.fecha_ingreso || ""}</td>
      <td>${v.fecha_egreso || ""}</td>
      <td class="acciones">
        <button class="btn-editar-vendedor" data-id="${v.id_vendedor}" title="Editar vendedor">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-baja-vendedor" data-id="${v.id_vendedor}" title="Baja vendedor">
          <i class="fa-solid fa-user-slash"></i>
        </button>
        <button class="btn-eliminar-vendedor" data-id="${v.id_vendedor}" title="Eliminar definitivo">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateSortIndicators();
}

/* ===========================================================
   NUEVO VENDEDOR (ALTA) — ATÓMICO vía RPC
   =========================================================== */
btnGuardarVendedor?.addEventListener("click", async () => {
  try {
    let rut = inputRut.value.trim().toUpperCase().replace(/[.\s]/g, "");
    let nombre = inputNombre.value.trim();
    const idEquipo = selectEquipoModal.value;
    const fechaIng = inputFechaIngreso.value;

    if (!rut || !nombre || !idEquipo || !fechaIng) {
      mostrarAlerta("Debe completar todos los campos requeridos.");
      return;
    }

    if (!estadoRutActual.valido) {
      mostrarAlerta("Debes ingresar y validar un RUT correcto.");
      return;
    }
    if (estadoRutActual.tieneVigente) {
      mostrarAlerta("Ya existe un vendedor vigente con ese RUT.");
      return;
    }

    const valorLimpio = rut.replace(/[^\dkK]/g, "");
    if (valorLimpio.length < 2) {
      mostrarAlerta("El RUT ingresado no es válido.");
      return;
    }

    const dv = valorLimpio.slice(-1);
    const cuerpo = valorLimpio.slice(0, -1);
    const rutNum = parseInt(cuerpo, 10);
    if (isNaN(rutNum)) {
      mostrarAlerta("El RUT ingresado no es válido.");
      return;
    }

    nombre = normalizarNombre(nombre);

    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData || !userData.user) {
      mostrarAlerta("No se pudo obtener el usuario autenticado.");
      return;
    }
    const idCreador = userData.user.id;

    // ✅ Alta atómica: crea vendedor + asigna equipo (no deja huérfanos)
    const { data: idVendedorNuevo, error: rpcErr } = await supabase.rpc(
      "crear_vendedor_y_asignar_equipo",
      {
        p_id_equipo: idEquipo,
        p_nombre: nombre,
        p_rut: rutNum,
        p_dv: dv,
        p_fecha_ingreso: fechaIng || null,
        p_creado_por: idCreador,
        p_id_usuario: null,
      }
    );

    if (rpcErr || !idVendedorNuevo) {
      console.error("Error RPC crear_vendedor_y_asignar_equipo:", rpcErr);
      mostrarAlerta("Error al crear el vendedor y asignarlo al equipo.");
      return;
    }

    mostrarAlerta("✅ Vendedor creado y asignado al equipo correctamente.");
    formNuevoVendedor?.reset();
    resetEstadoRut();
    modalNuevoVendedor?.close?.();
    await cargarVendedores();
  } catch (err) {
    console.error("Error general al crear vendedor:", err);
    mostrarAlerta("Error al crear el vendedor.");
  }
});

/* ===========================================================
   EDICIÓN VENDEDOR
   =========================================================== */
function abrirModalEditar(v) {
  if (!modalEditarVendedor) return;

  cerrarTodosLosModales(); // por seguridad, cierra cualquier resto

  vendedorEditando = v;

  if (inputEditRut)          inputEditRut.value          = rutFormateado(v.rut, v.dv);
  if (inputEditNombre)       inputEditNombre.value       = v.nombre_vendedor || v.nombre || "";
  if (inputEditFechaIngreso) inputEditFechaIngreso.value = v.fecha_ingreso || "";
  if (inputEditFechaEgreso)  inputEditFechaEgreso.value  = v.fecha_egreso || "";

  if (selectEditEquipo) {
    selectEditEquipo.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = v.id_equipo;
    opt.textContent = v.nombre_equipo || "";
    selectEditEquipo.appendChild(opt);
    selectEditEquipo.disabled = true;
  }

  // Manejar visibilidad del check "Reversar baja"
  if (filaRevertirBaja) {
    const tieneBaja = !!v.fecha_egreso;
    filaRevertirBaja.style.display = tieneBaja ? "" : "none";
  }
  if (inputEditRevertirBaja) {
    inputEditRevertirBaja.checked  = false;
    inputEditRevertirBaja.disabled = !v.fecha_egreso;
  }

  abrirDialog(modalEditarVendedor);
}

function cerrarModalEditar() {
  if (!modalEditarVendedor) return;
  vendedorEditando = null;
  cerrarDialog(modalEditarVendedor);
}

btnCerrarEditar?.addEventListener("click", e => {
  e.preventDefault();
  cerrarModalEditar();
});

/* ===========================================================
   FLUJO APLICAR CAMBIO FECHA INGRESO (CONFIRMADO)
   =========================================================== */
async function aplicarCambioFechaIngresoConfirmado(params) {
  const { idVendedor, nombreEdit, fechaIngEdit, fechaEgrEdit } = params;

  const nombreNormalizado = normalizarNombre(nombreEdit);

  // 1) Update vendedores
  const { error: errVend } = await supabase
    .from("vendedores")
    .update({
      nombre:        nombreNormalizado,
      fecha_ingreso: fechaIngEdit,
      fecha_egreso:  fechaEgrEdit || null,
    })
    .eq("id_vendedor", idVendedor);

  if (errVend) {
    console.error("Error actualizando vendedor:", errVend);
    mostrarAlerta(
      "Error al actualizar el vendedor: " +
        (errVend.message || JSON.stringify(errVend))
    );
    return;
  }

  // 2) Ver relaciones ANTES del UPDATE en equipo_vendedor
  const { data: beforeRel, error: errBefore } = await supabase
    .from("equipo_vendedor")
    .select("*")
    .eq("id_vendedor", idVendedor);

  console.log("DEBUG relaciones ANTES del update equipo_vendedor:", {
    beforeRel,
    errBefore,
  });

  // 3) UPDATE crítico en equipo_vendedor (vigentes)
  const { data: dataRelUpd, error: errRelUpd } = await supabase
    .from("equipo_vendedor")
    .update({ fecha_inicio: fechaIngEdit })
    .eq("id_vendedor", idVendedor)
    .is("fecha_fin", null)
    .select("*");

  console.log("DEBUG update equipo_vendedor:", { dataRelUpd, errRelUpd });

  if (errRelUpd) {
    console.error(
      "Error sincronizando fecha_inicio en equipo_vendedor:",
      errRelUpd
    );
    mostrarAlerta(
      "Vendedor actualizado, pero hubo un problema al sincronizar la fecha de inicio en el equipo. " +
        (errRelUpd.message || JSON.stringify(errRelUpd))
    );
    return;
  }

  // 4) Ver relaciones DESPUÉS del UPDATE
  const { data: afterRel, error: errAfter } = await supabase
    .from("equipo_vendedor")
    .select("*")
    .eq("id_vendedor", idVendedor);

  console.log("DEBUG relaciones DESPUÉS del update equipo_vendedor:", {
    afterRel,
    errAfter,
  });

  cerrarModalAdvertenciaCambioFecha();
  cerrarModalEditar();
  mostrarAlerta("✅ Vendedor actualizado correctamente.");
  await cargarVendedores();
}

btnConfirmarCambioFecha?.addEventListener("click", async e => {
  e.preventDefault();
  if (!estadoCambioFechaPendiente) {
    cerrarModalAdvertenciaCambioFecha();
    return;
  }
  await aplicarCambioFechaIngresoConfirmado(estadoCambioFechaPendiente);
});

btnCancelarCambioFecha?.addEventListener("click", e => {
  e.preventDefault();
  cerrarModalAdvertenciaCambioFecha();
});

function cerrarModalAdvertenciaCambioFecha() {
  if (!modalAdvertenciaCambioFecha) return;
  estadoCambioFechaPendiente = null;
  cerrarDialog(modalAdvertenciaCambioFecha);
}

/* ===========================================================
   GUARDAR EDICIÓN VENDEDOR
   =========================================================== */
btnGuardarEdicion?.addEventListener("click", async e => {
  e.preventDefault();

  if (!vendedorEditando) {
    mostrarAlerta("No hay un vendedor seleccionado para editar.");
    return;
  }

  const idVendedor        = vendedorEditando.id_vendedor;
  const fechaIngOriginal  = vendedorEditando.fecha_ingreso || "";
  const fechaEgrOriginal  = vendedorEditando.fecha_egreso  || "";
  let   nombreEdit        = (inputEditNombre?.value || "").trim();
  const fechaIngEdit      = inputEditFechaIngreso?.value || "";
  const fechaEgrEdit      = inputEditFechaEgreso?.value || "";
  const revertirBaja      = inputEditRevertirBaja?.checked === true;

  if (!nombreEdit || !fechaIngEdit) {
    mostrarAlerta("Debes completar el nombre y la fecha de ingreso.");
    return;
  }

  const fechasIguales = fechaIngOriginal === fechaIngEdit;

  // ===========================================================
  // CASO ESPECIAL: REVERSAR BAJA (check marcado)
  // ===========================================================
  if (revertirBaja) {
    if (!fechaEgrOriginal) {
      mostrarAlerta("El vendedor no está dado de baja, no hay nada que reversar.");
      return;
    }

    const confirma = window.confirm(
      `El vendedor actualmente está dado de baja con fecha ${fechaEgrOriginal}.\n\n` +
      `¿Deseas reversar la baja y dejarlo nuevamente ACTIVO?`
    );

    if (!confirma) {
      return;
    }

    try {
      const nombreNormalizado = normalizarNombre(nombreEdit);

      // 1) Reactivar en tabla vendedores
      const { error: errVend } = await supabase
        .from("vendedores")
        .update({
          nombre:        nombreNormalizado,
          fecha_ingreso: fechaIngEdit,
          fecha_egreso:  null,
          estado:        "ACTIVO",
        })
        .eq("id_vendedor", idVendedor);

      if (errVend) {
        console.error("Error revirtiendo baja en vendedores:", errVend);
        mostrarAlerta(
          "Error al intentar reversar la baja del vendedor: " +
          (errVend.message || JSON.stringify(errVend))
        );
        return;
      }

      // 2) Reactivar relación en equipo_vendedor
      const { error: errEV } = await supabase
        .from("equipo_vendedor")
        .update({
          fecha_fin: null,
          estado:    true,
        })
        .eq("id_vendedor", idVendedor)
        .eq("id_equipo",  vendedorEditando.id_equipo);

      if (errEV) {
        console.error("Error reactivando relación equipo_vendedor:", errEV);
        mostrarAlerta(
          "El vendedor fue reactivado, pero hubo un problema al actualizar su relación con el equipo."
        );
      } else {
        mostrarAlerta("✅ Baja reversada, el vendedor se encuentra nuevamente ACTIVO.");
      }

      cerrarModalEditar();
      await cargarVendedores();
      return; // no seguir con lógica normal
    } catch (err) {
      console.error("Error general al reversar baja:", err);
      mostrarAlerta("Error al intentar reversar la baja del vendedor.");
      return;
    }
  }

  // ===========================================================
  // CASO NORMAL: sin reversar baja
  // ===========================================================
  if (fechasIguales) {
    try {
      const nombreNormalizado = normalizarNombre(nombreEdit);

      const { error: errVend } = await supabase
        .from("vendedores")
        .update({
          nombre:        nombreNormalizado,
          fecha_ingreso: fechaIngEdit,
          fecha_egreso:  fechaEgrEdit || null,
        })
        .eq("id_vendedor", idVendedor);

      if (errVend) {
        console.error(
          "Error actualizando vendedor (sin cambio fecha):",
          errVend
        );
        mostrarAlerta("Error al actualizar el vendedor.");
        return;
      }

      cerrarModalEditar();
      mostrarAlerta("✅ Vendedor actualizado correctamente.");
      await cargarVendedores();
      return;
    } catch (err) {
      console.error(
        "Error general al actualizar vendedor (sin cambio fecha):",
        err
      );
      mostrarAlerta("Error al actualizar el vendedor.");
      return;
    }
  }

  // ===========================================================
  // CASO EXISTENTE: cambio de fecha de ingreso
  // ===========================================================
  try {
    // Validar relaciones equipo_vendedor
    const { data: rels, error: errRelSel } = await supabase
      .from("equipo_vendedor")
      .select("id_relacion, fecha_inicio, fecha_fin, id_equipo")
      .eq("id_vendedor", idVendedor);

    console.log("DEBUG relaciones equipo_vendedor para edición:", {
      rels,
      errRelSel,
    });

    if (errRelSel) {
      console.error(
        "Error consultando relaciones equipo_vendedor:",
        errRelSel
      );
      mostrarAlerta(
        "Error al validar la relación del vendedor con el equipo."
      );
      return;
    }

    const relActivas = (rels || []).filter(r => !r.fecha_fin);
    console.log("DEBUG relaciones activas:", relActivas);

    if (relActivas.length === 0) {
      mostrarAlerta(
        "El vendedor no tiene una relación activa con un equipo."
      );
      return;
    }

    if (relActivas.length > 1) {
      mostrarAlerta(
        "El vendedor tiene más de una relación activa con equipos. " +
          "No se permite cambiar la fecha de ingreso en este caso."
      );
      return;
    }

    const relUnica = relActivas[0];
    console.log(
      "DEBUG relación única seleccionada para update:",
      relUnica
    );

    const rangoInicio = fechaIngEdit;
    const rangoFin    = fechaIngOriginal;

    const { data: ventasAfectadas, error: errVentas } = await supabase
      .from("ventas")
      .select("id_venta, fecha_venta, monto, descripcion")
      .eq("id_vendedor", idVendedor)
      .gte("fecha_venta", rangoInicio)
      .lte("fecha_venta", rangoFin);

    console.log("DEBUG ventas afectadas:", {
      ventasAfectadas,
      errVentas,
    });

    if (errVentas) {
      console.error(
        "Error consultando ventas en el rango:",
        errVentas
      );
      mostrarAlerta(
        "Error al validar las ventas en el rango de fechas."
      );
      return;
    }

    const hayVentas = (ventasAfectadas || []).length > 0;

    if (!hayVentas) {
      await aplicarCambioFechaIngresoConfirmado({
        idVendedor,
        nombreEdit,
        fechaIngEdit,
        fechaEgrEdit,
      });
      return;
    }

    if (
      modalAdvertenciaCambioFecha &&
      listaVentasCambioFecha &&
      btnConfirmarCambioFecha &&
      btnCancelarCambioFecha
    ) {
      listaVentasCambioFecha.innerHTML = ventasAfectadas
        .map(v => {
          const fecha = v.fecha_venta || "";
          const monto =
            v.monto != null
              ? Number(v.monto).toLocaleString("es-CL")
              : "";
          const desc = v.descripcion || "";
          return `<li>${fecha}${
            monto ? ` — $${monto}` : ""
          }${desc ? ` — ${desc}` : ""}</li>`;
        })
        .join("");

      estadoCambioFechaPendiente = {
        idVendedor,
        nombreEdit,
        fechaIngEdit,
        fechaEgrEdit,
      };
      abrirDialog(modalAdvertenciaCambioFecha);
    } else {
      const ok = window.confirm(
        "Existen ventas en el rango entre la fecha original y la nueva fecha de ingreso.\n" +
          "Si continúas, esas ventas se considerarán dentro del nuevo período del equipo.\n\n" +
          "¿Deseas aplicar igualmente el cambio de fecha de ingreso?"
      );
      if (!ok) return;

      await aplicarCambioFechaIngresoConfirmado({
        idVendedor,
        nombreEdit,
        fechaIngEdit,
        fechaEgrEdit,
      });
    }
  } catch (err) {
    console.error(
      "Error general al preparar advertencia de cambio de fecha:",
      err
    );
    mostrarAlerta(
      "Error al preparar el cambio de fecha de ingreso."
    );
  }
});

/* ===========================================================
   BAJA VENDEDOR
   =========================================================== */
function abrirModalBaja(v) {
  if (!modalBajaVendedor) return;

  cerrarTodosLosModales();

  vendedorEnBaja = v;

  const nombre = v.nombre_vendedor || v.nombre || "";
  if (textoBajaVendedor) {
    textoBajaVendedor.textContent = `¿Deseas dar de baja al vendedor ${nombre}?`;
  }

  // Fecha ingreso para validación de baja (usa fecha_ingreso si existe, si no fecha_creacion)
  const fechaIngreso =
    (v.fecha_ingreso && String(v.fecha_ingreso).slice(0, 10)) ||
    (v.fecha_creacion && String(v.fecha_creacion).slice(0, 10)) ||
    "";

  if (inputFechaBajaVendedor) {
    inputFechaBajaVendedor.value = "";
    if (fechaIngreso) inputFechaBajaVendedor.min = fechaIngreso; // ✅ evita fechas anteriores
  }

  if (bloqueVentasPosteriores && listaVentasPosteriores) {
    bloqueVentasPosteriores.style.display = "none";
    listaVentasPosteriores.innerHTML = "";
  }

  abrirDialog(modalBajaVendedor);
}

function cerrarModalBaja() {
  if (!modalBajaVendedor) return;
  vendedorEnBaja = null;
  cerrarDialog(modalBajaVendedor);
}

btnCerrarBajaVendedor?.addEventListener("click", e => {
  e.preventDefault();
  cerrarModalBaja();
});

btnCancelarBajaVendedor?.addEventListener("click", e => {
  e.preventDefault();
  cerrarModalBaja();
});

btnConfirmarBajaVendedor?.addEventListener("click", async e => {
  e.preventDefault();

  if (!vendedorEnBaja) {
    mostrarAlerta("No hay vendedor seleccionado para dar de baja.");
    return;
  }

  if (!inputFechaBajaVendedor) {
    mostrarAlerta("Falta el campo de fecha de baja en el formulario.");
    return;
  }

  const fechaBaja = inputFechaBajaVendedor.value;
  if (!fechaBaja) {
    mostrarAlerta("Debes ingresar la fecha de baja.");
    return;
  }

  // ✅ Validación: fecha baja no puede ser anterior a ingreso/creación
  const fechaIngreso =
    (vendedorEnBaja.fecha_ingreso && String(vendedorEnBaja.fecha_ingreso).slice(0, 10)) ||
    (vendedorEnBaja.fecha_creacion && String(vendedorEnBaja.fecha_creacion).slice(0, 10)) ||
    "";

  if (fechaIngreso && fechaBaja < fechaIngreso) {
    mostrarAlerta(
      `La fecha de baja no puede ser anterior a la fecha de ingreso (${fechaIngreso}).`
    );
    return;
  }

  try {
    const { data: ventasPosteriores, error: errVentas } = await supabase
      .from("ventas")
      .select("id_venta, fecha_venta, monto, descripcion")
      .eq("id_vendedor", vendedorEnBaja.id_vendedor)
      .gt("fecha_venta", fechaBaja);

    if (errVentas) {
      console.error("Error consultando ventas del vendedor:", errVentas);
      mostrarAlerta("Error al validar ventas del vendedor.");
      return;
    }

    if (ventasPosteriores && ventasPosteriores.length > 0) {
      if (bloqueVentasPosteriores && listaVentasPosteriores) {
        listaVentasPosteriores.innerHTML = ventasPosteriores
          .map(v => {
            const fecha = v.fecha_venta || "";
            const monto =
              v.monto != null ? Number(v.monto).toLocaleString("es-CL") : "";
            const desc = v.descripcion || "";
            return `<li>${fecha}${monto ? ` — $${monto}` : ""}${desc ? ` — ${desc}` : ""}</li>`;
          })
          .join("");

        bloqueVentasPosteriores.style.display = "block";
      }

      mostrarAlerta(
        "No se puede dar de baja al vendedor porque existen ventas posteriores a la fecha seleccionada."
      );
      return;
    }

    const idVendedor = vendedorEnBaja.id_vendedor;
    const idEquipo = vendedorEnBaja.id_equipo;

    const { error: errEV } = await supabase
      .from("equipo_vendedor")
      .update({
        fecha_fin: fechaBaja,
        estado: false,
      })
      .eq("id_vendedor", idVendedor)
      .eq("id_equipo", idEquipo)
      .is("fecha_fin", null);

    if (errEV) {
      console.error("Error actualizando equipo_vendedor en baja:", errEV);

      const msg =
        String(errEV?.message || "").toLowerCase().includes("check") ||
        String(errEV?.message || "").toLowerCase().includes("constraint")
          ? "Fecha inválida: la baja debe ser igual o posterior a la fecha de inicio."
          : "Error al actualizar la asignación del vendedor al equipo.";

      mostrarAlerta(msg);
      return;
    }

    const { error: errVend } = await supabase
      .from("vendedores")
      .update({
        fecha_egreso: fechaBaja,
        estado: "DESVINCULADO",
      })
      .eq("id_vendedor", idVendedor);

    if (errVend) {
      console.error("Error actualizando vendedor:", errVend);

      const msg =
        String(errVend?.message || "").toLowerCase().includes("check") ||
        String(errVend?.message || "").toLowerCase().includes("constraint")
          ? "Fecha inválida: la baja debe ser igual o posterior a la fecha de ingreso."
          : "Error al actualizar la fecha de egreso del vendedor.";

      mostrarAlerta(msg);
      return;
    }

    mostrarAlerta("✅ Vendedor dado de baja correctamente.");
    cerrarModalBaja();
    await cargarVendedores();
  } catch (err) {
    console.error("Error general al dar de baja al vendedor:", err);
    mostrarAlerta(
      "Error al dar de baja al vendedor: " + (err?.message || JSON.stringify(err))
    );
  }
});

/* ===========================================================
   DELEGACIÓN DE EVENTOS EN TABLA
   =========================================================== */
tablaVendedores?.addEventListener("click", async e => {
  const btnEditar = e.target.closest(".btn-editar-vendedor");
  const btnBaja   = e.target.closest(".btn-baja-vendedor");
  const btnDel    = e.target.closest(".btn-eliminar-vendedor");

  if (!btnEditar && !btnBaja && !btnDel) return;

  const fila = e.target.closest("tr");
  if (!fila) return;

  const idVendedor = fila.dataset.idVendedor;
  const idEquipo   = fila.dataset.idEquipo;

  const vendedor = vendedores.find(
    v => v.id_vendedor === idVendedor && v.id_equipo === idEquipo
  );
  if (!vendedor) return;

  if (btnEditar) {
    abrirModalEditar(vendedor);
    return;
  }

  if (btnBaja) {
    abrirModalBaja(vendedor);
    return;
  }

  if (btnDel) {
    try {
      // Ahora toda la lógica de negocio (ventas, permisos, deletes)
      // la maneja el RPC en el backend.
      const { data, error } = await supabase.rpc(
        "eliminar_vendedor_sin_ventas",
        { p_id_vendedor: vendedor.id_vendedor }
      );

      if (error) {
        console.error("Error en RPC eliminar_vendedor_sin_ventas:", error);
        mostrarAlerta("Error al intentar eliminar el vendedor.");
        return;
      }

      switch (data) {
        case "ELIMINADO":
          mostrarAlerta("El vendedor fue eliminado correctamente.");
          await cargarVendedores();
          break;

        case "TIENE_VENTAS":
          mostrarAlerta(
            "El vendedor posee ventas registradas, por lo que se debe Dar de Baja al Vendedor"
          );
          break;

        case "SIN_PERMISO":
          mostrarAlerta(
            "No tienes permisos para eliminar este vendedor."
          );
          break;

        case "SIN_AUTH":
          mostrarAlerta(
            "Sesión no válida. Vuelve a iniciar sesión e inténtalo nuevamente."
          );
          break;

        default:
          console.warn(
            "Respuesta inesperada de eliminar_vendedor_sin_ventas:",
            data
          );
          mostrarAlerta("No fue posible eliminar el vendedor.");
          break;
      }
    } catch (err) {
      console.error("Error general al eliminar vendedor:", err);
      mostrarAlerta("Error al eliminar el vendedor.");
    }
    return;
  }
});

/* ===========================================================
   INICIALIZACIÓN INTERNA
   =========================================================== */
async function inicializarModuloVendedores() {
  await ensureSupervisorUid();

  try {
    console.log(
      "DEBUG ▶ inicializarModuloVendedores() — idSupervisorActivo:",
      idSupervisorActivo
    );

    if (!idSupervisorActivo) {
      console.warn("No hay idSupervisorActivo, redirigiendo a login.");
      window.location.href = "../index.html";
      return;
    }

    // Carga inicial de UI
    bindHeaderSorting();
    await cargarEquipos();
    await cargarVendedores();

    // Filtro “Mostrar solo vigentes”
    chkVigentes?.addEventListener("change", cargarVendedores);

    // ===========================
    // Botón VOLVER
    // ===========================
    const btnVolver = document.getElementById("btnVolver");
    if (btnVolver) {
      btnVolver.addEventListener("click", (e) => {
        const panelBotones = document.getElementById("panel-botones");
        const contenedorModulos = document.getElementById("contenedor-modulos");

        // Si está embebido, supervisor.js maneja el volver.
        if (panelBotones && contenedorModulos) {
          return;
        }

        // Fallback: si se abrió vendedores.html directo
        e.preventDefault();
        window.location.href = "../views/supervisor.html";
      });
    }
  } catch (err) {
    console.error("Error inicializando módulo vendedores:", err);
    mostrarAlerta("Error al inicializar el módulo de vendedores.");
  }
}

/* ===========================================================
   LLAMADA DE INICIO DEL MÓDULO
   (movida al final para evitar la TDZ con tablaVendedores)
   =========================================================== */
AppVentas.features.vendedores.init();