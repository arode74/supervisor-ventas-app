import { supabase } from "../config.js";

console.log("🟢 parametros-supervisor.js cargado");

const $ = (id) => document.getElementById(id);

/* ===========================================================
   AUTH
   =========================================================== */
async function getSupervisorId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("auth.getUser error:", error.message, error.details, error.hint);
    return null;
  }
  return data?.user?.id ?? null;
}

/* ===========================================================
   HELPERS
   =========================================================== */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function abrir(idModal) {
  if (typeof window.abrirModal === "function") return window.abrirModal(idModal);
  const d = $(idModal);
  if (d?.showModal) d.showModal();
}

function cerrar(idModal) {
  if (typeof window.cerrarModal === "function") return window.cerrarModal(idModal);
  const d = $(idModal);
  if (d?.close) d.close();
}

/* ===========================================================
   MODAL AVISO / MENSAJES
   =========================================================== */
function mostrarAviso(texto, titulo = "Resultado") {
  const t = $("avisoTitulo");
  const p = $("avisoTexto");
  if (t) t.textContent = titulo;
  if (p) p.textContent = texto || "";
  abrir("modalAviso");
}

function setMensaje(msg, tipo = "info") {
  // Si tienes un banner en la página
  const el = $("mensajeEstado");
  if (tipo === "error") {
    if (el) {
      el.textContent = msg || "";
      el.style.color = "#b00020";
      return;
    }
    mostrarAviso(msg, "Error");
    return;
  }

  if (el) el.textContent = "";
  if (msg) mostrarAviso(msg, "Resultado");
}

/* ===========================================================
   ESTADO UI
   =========================================================== */
let parametroActivo = null;

function setHint(texto) {
  const el = $("cfgHint");
  if (el) el.textContent = texto || "";
}

function activarParametro(param) {
  parametroActivo = param;

  if (!param) setHint("Selecciona un parámetro para habilitar acciones.");
  else if (param === "tipos_compromisos") setHint("Administra tipos de compromisos (Editar / Guardar / Cancelar).");
  else setHint("Parámetro no disponible.");

  renderAccionesDerecha();
}

function renderAccionesDerecha() {
  const box = $("accionesParametro");
  if (!box) return;

  if (!parametroActivo) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  if (parametroActivo === "tipos_compromisos") {
    box.style.display = "flex";
    box.style.gap = "12px";
    box.innerHTML = `
      <button class="btn btn--primary" id="btnEditarTipos" type="button">Modificar</button>
      <button class="btn btn--secondary" id="btnCrearTipo" type="button">Crear</button>
    `;
    return;
  }

  box.style.display = "none";
  box.innerHTML = "";
}

/* ===========================================================
   ICONOS (SVG)
   =========================================================== */
function iconEditar() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}
function iconGuardar() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"
        stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
      <path d="M17 21v-8H7v8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
      <path d="M7 3v5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>
  `;
}
function iconCancelar() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      <path d="M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>
  `;
}

/* ===========================================================
   MODALES: Tipos compromisos
   =========================================================== */
function abrirModalTiposCompromisos() {
  abrir("modalTiposCompromisos");
  cargarTiposCompromisos().catch((err) => {
    console.error("Error cargando tipos_compromisos:", err);
    const tbody = $("tbodyTiposCompromisos");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="color:#c00; text-align:center;">Error cargando datos</td></tr>`;
  });
}

function abrirModalCrearTipo() {
  if ($("nuevoTipoNombre")) $("nuevoTipoNombre").value = "";
  if ($("nuevoTipoDescripcion")) $("nuevoTipoDescripcion").value = "";
  if ($("nuevoTipoActivo")) $("nuevoTipoActivo").checked = true;
  if ($("nuevoTipoVisibleParaTodos")) $("nuevoTipoVisibleParaTodos").checked = false;
  if ($("nuevoTipoEsObligatorio")) $("nuevoTipoEsObligatorio").checked = false;
  if ($("nuevoTipoOrden")) $("nuevoTipoOrden").value = "";
  abrir("modalNuevoTipo");
}

/* ===========================================================
   TIPOS COMPROMISOS: DATA + RENDER
   =========================================================== */
async function cargarTiposCompromisos() {
  const tbody = $("tbodyTiposCompromisos");
  if (!tbody) return;

  const supervisorId = await getSupervisorId();
  if (!supervisorId) {
    tbody.innerHTML = `<tr><td colspan="6">Sin sesión activa</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6">Cargando...</td></tr>`;

  // OJO: PK real = id (NO id_tipo)
  const { data, error } = await supabase
    .from("tipos_compromisos")
    .select("id, supervisor_id, nombre, descripcion, activo, visible_para_todos, es_obligatorio, orden")
    .eq("supervisor_id", supervisorId)
    .order("orden", { ascending: true, nullsFirst: false })
    .order("nombre", { ascending: true });

  if (error) {
    console.error("PostgREST error:", error);
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    tbody.innerHTML = `<tr><td colspan="6" style="color:#c00; text-align:center;">${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; opacity:.7;">Sin registros</td></tr>`;
    return;
  }

  // Render mínimo + estable
  tbody.innerHTML = data
  .map((t) => {
    const desc = t.descripcion ?? "";

    return `
      <tr class="tc-row"
          data-id="${t.id}"
          data-desc-orig="${escapeHtml(desc)}"
          data-activo-orig="${t.activo ? "1" : "0"}"
          data-visible-orig="${t.visible_para_todos ? "1" : "0"}"
          data-editing="0">

        <!-- 1) Nombre -->
        <td class="tc-nombre">${escapeHtml(t.nombre)}</td>

        <!-- 2) Descripción -->
        <td>
          <textarea class="tc-desc" disabled rows="2">${escapeHtml(desc)}</textarea>
        </td>

        <!-- 3) Activo -->
        <td style="text-align:center">
          <input type="checkbox" class="tc-activo" ${t.activo ? "checked" : ""} disabled>
        </td>

        <!-- 4) Visible para todos -->
        <td style="text-align:center">
          <input type="checkbox" class="tc-visible" ${t.visible_para_todos ? "checked" : ""} disabled>
        </td>

        <!-- 5) Acciones (SOLO ICONOS) -->
        <td class="tc-actions" style="text-align:center; white-space:nowrap;">
          <!-- MODO NORMAL: solo Editar -->
          <button class="btn btn--secondary btn-icon tc-btn-editar" type="button" title="Editar" aria-label="Editar">
            ${iconEditar()}
          </button>

          <!-- MODO EDICIÓN: solo Guardar + Cancelar -->
          <button class="btn btn--primary btn-icon tc-btn-guardar" type="button" title="Guardar" aria-label="Guardar"
                  disabled style="display:none;">
            ${iconGuardar()}
          </button>

          <button class="btn btn--secondary btn-icon tc-btn-cancelar" type="button" title="Cancelar" aria-label="Cancelar"
                  disabled style="display:none;">
            ${iconCancelar()}
          </button>
        </td>
      </tr>
    `;
  })
  .join("");
}

function rowHasChanges(tr) {
  const descOrig = tr.dataset.descOrig ?? "";
  const activoOrig = tr.dataset.activoOrig === "1";
  const visibleOrig = tr.dataset.visibleOrig === "1";
  const obligOrig = tr.dataset.obligOrig === "1";
  const ordenOrig = tr.dataset.ordenOrig ?? "";

  const desc = tr.querySelector(".tc-desc")?.value ?? "";
  const activo = tr.querySelector(".tc-activo")?.checked ?? false;
  const visible = tr.querySelector(".tc-visible")?.checked ?? false;
  const oblig = tr.querySelector(".tc-oblig")?.checked ?? false;

  // (orden no está en UI aquí; si lo agregas, inclúyelo en el cálculo)
  return desc !== descOrig || activo !== activoOrig || visible !== visibleOrig || oblig !== obligOrig || ordenOrig !== (tr.dataset.ordenOrig ?? "");
}

function rowRevert(tr) {
  tr.querySelector(".tc-desc").value = tr.dataset.descOrig ?? "";
  tr.querySelector(".tc-activo").checked = tr.dataset.activoOrig === "1";
  tr.querySelector(".tc-visible").checked = tr.dataset.visibleOrig === "1";
  tr.querySelector(".tc-oblig").checked = tr.dataset.obligOrig === "1";
}

function setRowButtonsMode(tr, editing) {
  const btnEditar = tr.querySelector(".tc-btn-editar");
  const btnGuardar = tr.querySelector(".tc-btn-guardar");
  const btnCancelar = tr.querySelector(".tc-btn-cancelar");

  if (editing) {
    if (btnEditar) btnEditar.style.display = "none";
    if (btnGuardar) btnGuardar.style.display = "inline-flex";
    if (btnCancelar) btnCancelar.style.display = "inline-flex";
  } else {
    if (btnEditar) btnEditar.style.display = "inline-flex";
    if (btnGuardar) btnGuardar.style.display = "none";
    if (btnCancelar) btnCancelar.style.display = "none";
  }
}

function setRowEditing(tr, editing) {
  if (editing) {
    // Solo 1 fila en edición
    document.querySelectorAll("#modalTiposCompromisos tr.tc-row.is-editing").forEach((other) => {
      if (other !== tr) {
        rowRevert(other);
        other.classList.remove("is-editing");
        other.dataset.editing = "0";
        other.querySelectorAll("textarea, input[type=checkbox]").forEach((el) => (el.disabled = true));
        setRowButtonsMode(other, false);
      }
    });
  }

  tr.dataset.editing = editing ? "1" : "0";
  tr.classList.toggle("is-editing", !!editing);

  tr.querySelectorAll("textarea, input[type=checkbox]").forEach((el) => {
    el.disabled = !editing;
  });

  setRowButtonsMode(tr, editing);

  const btnGuardar = tr.querySelector(".tc-btn-guardar");
  const btnCancelar = tr.querySelector(".tc-btn-cancelar");
  if (btnGuardar) btnGuardar.disabled = !(editing && rowHasChanges(tr));
  if (btnCancelar) btnCancelar.disabled = !editing;
}

async function rowSave(tr) {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) {
    setMensaje("Sin sesión activa", "error");
    return;
  }

  const id = tr.dataset.id;

  const payload = {
    descripcion: tr.querySelector(".tc-desc").value ?? null,
    activo: !!tr.querySelector(".tc-activo").checked,
    visible_para_todos: !!tr.querySelector(".tc-visible").checked,
    es_obligatorio: !!tr.querySelector(".tc-oblig").checked,
  };

  const { error } = await supabase
    .from("tipos_compromisos")
    .update(payload)
    .eq("id", id) // PK real
    .eq("supervisor_id", supervisorId); // safety extra

  if (error) {
    console.error("Update error:", error.message, error.details, error.hint);
    setMensaje(error.message, "error");
    return;
  }

  tr.dataset.descOrig = payload.descripcion ?? "";
  tr.dataset.activoOrig = payload.activo ? "1" : "0";
  tr.dataset.visibleOrig = payload.visible_para_todos ? "1" : "0";
  tr.dataset.obligOrig = payload.es_obligatorio ? "1" : "0";

  setRowEditing(tr, false);
  setMensaje("Cambios guardados");
}

/* ===========================================================
   NUEVO TIPO (opcional)
   =========================================================== */
async function guardarNuevoTipo() {
  const supervisor_id = await getSupervisorId();
  if (!supervisor_id) {
    setMensaje("Sin sesión activa", "error");
    return;
  }

  const nombre = ($("nuevoTipoNombre")?.value ?? "").trim();
  if (!nombre) {
    setMensaje("Falta nombre", "error");
    return;
  }

  const payload = {
    supervisor_id,
    nombre,
    descripcion: ($("nuevoTipoDescripcion")?.value ?? "").trim() || null,
    activo: $("nuevoTipoActivo")?.checked ?? true,
    visible_para_todos: $("nuevoTipoVisibleParaTodos")?.checked ?? false,
    es_obligatorio: $("nuevoTipoEsObligatorio")?.checked ?? false,
    orden: (() => {
      const v = ($("nuevoTipoOrden")?.value ?? "").trim();
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
    fecha_creacion: new Date().toISOString(), // si la BD no tiene default; si tiene, puedes borrar esto
  };

  const { error } = await supabase.from("tipos_compromisos").insert([payload]);

  if (error) {
    console.error("Insert error:", error.message, error.details, error.hint);
    setMensaje(error.message, "error");
    return;
  }

  cerrar("modalNuevoTipo");
  setMensaje("Tipo creado");
  await cargarTiposCompromisos();
}

/* ===========================================================
   BIND UI (CLAVE)
   =========================================================== */
function bindUI() {
  document.querySelectorAll('.config-item__btn[data-param]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      activarParametro(btn.getAttribute("data-param"));
    });
  });

  const acciones = $("accionesParametro");
  if (acciones) {
    acciones.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.id === "btnEditarTipos") abrirModalTiposCompromisos();
      if (t.id === "btnCrearTipo") abrirModalCrearTipo();
    });
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-modal-cerrar]");
    if (!btn) return;
    const id = btn.getAttribute("data-modal-cerrar");
    if (id) cerrar(id);
  });

  const btnCerrarAviso = $("btnCerrarAviso");
  if (btnCerrarAviso) btnCerrarAviso.addEventListener("click", () => cerrar("modalAviso"));

  const btnGuardarNuevoTipo = $("btnGuardarNuevoTipo");
  if (btnGuardarNuevoTipo) btnGuardarNuevoTipo.addEventListener("click", guardarNuevoTipo);
}

/* ===========================================================
   EVENTOS TABLA (delegación)
   =========================================================== */
document.addEventListener("click", async (e) => {
  const tr = e.target.closest("tr.tc-row");
  if (!tr) return;

  if (e.target.closest(".tc-btn-editar")) {
    setRowEditing(tr, true);
    return;
  }

  if (e.target.closest(".tc-btn-cancelar")) {
    rowRevert(tr);
    setRowEditing(tr, false);
    return;
  }

  if (e.target.closest(".tc-btn-guardar")) {
    await rowSave(tr);
  }
});

document.addEventListener("input", (e) => {
  const tr = e.target.closest("tr.tc-row");
  if (!tr || tr.dataset.editing !== "1") return;
  const btnGuardar = tr.querySelector(".tc-btn-guardar");
  if (btnGuardar) btnGuardar.disabled = !rowHasChanges(tr);
});

/* ===========================================================
   INIT robusto (para módulos inyectados)
   =========================================================== */
let __ps_inited = false;

function init() {
  if (__ps_inited) return;

  // Tu módulo depende de este contenedor. Si tu HTML usa otro id, cámbialo aquí.
  const cont = $("modulo-configuracion");
  if (!cont) return;

  __ps_inited = true;
  bindUI();
  activarParametro(null);
}

// DOM listo
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

// Módulo inyectado después (caso supervisor.js)
const mo = new MutationObserver(() => {
  if (!__ps_inited && $("modulo-configuracion")) init();
});
mo.observe(document.documentElement, { childList: true, subtree: true });
