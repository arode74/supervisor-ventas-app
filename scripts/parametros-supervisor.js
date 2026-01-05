import { supabase } from "../config.js";

console.log("🟢 parametros-supervisor.js cargado");

const $ = (id) => document.getElementById(id);

function getSupervisorIdActivo() {
  return window.idSupervisorActivo || localStorage.getItem("idSupervisorActivo") || null;
}

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
   AVISO MODAL (reemplaza mensajes persistentes en pantalla)
   Requiere: dialog#modalAviso con #avisoTitulo #avisoTexto y #btnCerrarAviso
   =========================================================== */

function mostrarAviso(texto, titulo = "Resultado") {
  const t = $("avisoTitulo");
  const p = $("avisoTexto");
  if (t) t.textContent = titulo;
  if (p) p.textContent = texto || "";
  abrir("modalAviso");
}

// Mantiene errores inline (útil), y avisos informativos como modal.
function setMensaje(msg, tipo = "info") {
  const el = $("mensajeEstado");

  if (tipo === "error") {
    if (el) {
      el.textContent = msg || "";
      el.style.color = "#b00020";
    }
    return;
  }

  // info/warn/success → modal
  if (el) el.textContent = ""; // evita que quede pegado
  if (msg) mostrarAviso(msg, "Resultado");
}

/* ===========================================================
   ESTADO UI
   =========================================================== */

let parametroActivo = null;

function renderAccionesDerecha() {
  const box = $("accionesParametro");
  if (!box) return;

  if (!parametroActivo) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  box.style.display = "flex";

  if (parametroActivo === "tipos_compromisos") {
    box.innerHTML = `
      <button class="btn btn--primary" id="btnVerEditarTipos" type="button">Ver / Editar</button>
      <button class="btn btn--secondary" id="btnNuevoTipo" type="button">+ Nuevo Tipo</button>
    `;
    return;
  }

  if (parametroActivo === "ingreso_ventas") {
    box.innerHTML = `
      <button class="btn btn--primary" type="button" disabled>Ver / Editar</button>
    `;
    return;
  }

  box.style.display = "none";
  box.innerHTML = "";
}

function setTooltip(texto, mostrar) {
  const tip = $("tooltipParametro");
  if (!tip) return;

  if (!mostrar || !texto) {
    tip.style.display = "none";
    tip.textContent = "";
    return;
  }

  tip.textContent = texto;
  tip.style.display = "block";
}

/* ===========================================================
   TIPOS COMPROMISOS — SOLO DEL SUPERVISOR (supervisor_id)
   Columnas reales: id, supervisor_id, nombre, descripcion, activo, ...
   =========================================================== */

async function cargarTiposCompromisos() {
  const tbody = $("tbodyTiposCompromisos");
  if (!tbody) return;

  const supervisorId = getSupervisorIdActivo();
  if (!supervisorId) {
    tbody.innerHTML = `<tr><td colspan="4">Sin supervisor activo</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="4">Cargando...</td></tr>`;

  const { data, error } = await supabase
    .from("tipos_compromisos")
    .select("id, supervisor_id, nombre, descripcion, activo")
    .eq("supervisor_id", supervisorId)
    .order("nombre", { ascending: true });

  if (error) {
    console.error("❌ Error cargando tipos_compromisos:", error);
    tbody.innerHTML = `<tr><td colspan="4">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="4">Sin registros para este supervisor</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map((t) => {
      const nombre = escapeHtml(t.nombre);
      const desc = escapeHtml(t.descripcion ?? "");
      const activo = !!t.activo;

      return `
        <tr class="tc-row"
            data-id="${t.id}"
            data-desc-orig="${desc}"
            data-activo-orig="${activo ? "1" : "0"}"
            data-editing="0"
            data-dirty="0">
          <td>${nombre}</td>

          <td>
            <textarea class="tc-desc" rows="2" disabled style="width:100%; resize:vertical;">${desc}</textarea>
          </td>

          <td style="text-align:center;">
            <input class="tc-activo" type="checkbox" ${activo ? "checked" : ""} disabled />
          </td>

          <td>
            <button class="btn btn--secondary tc-btn-editar" type="button" title="Editar">✏️</button>
            <button class="btn btn--primary tc-btn-guardar" type="button" title="Guardar" disabled>💾</button>
            <button class="btn btn--secondary tc-btn-cancelar" type="button" title="Cancelar" disabled>✖</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function setRowEditing(tr, editing) {
  tr.dataset.editing = editing ? "1" : "0";

  const desc = tr.querySelector(".tc-desc");
  const activo = tr.querySelector(".tc-activo");
  const btnGuardar = tr.querySelector(".tc-btn-guardar");
  const btnCancelar = tr.querySelector(".tc-btn-cancelar");

  if (desc) desc.disabled = !editing;
  if (activo) activo.disabled = !editing;

  if (btnCancelar) btnCancelar.disabled = !editing;

  const dirty = tr.dataset.dirty === "1";
  if (btnGuardar) btnGuardar.disabled = !(editing && dirty);
}

function setRowDirty(tr, dirty) {
  tr.dataset.dirty = dirty ? "1" : "0";
  const editing = tr.dataset.editing === "1";
  const btnGuardar = tr.querySelector(".tc-btn-guardar");
  if (btnGuardar) btnGuardar.disabled = !(editing && dirty);
}

function rowHasChanges(tr) {
  const origDesc = tr.dataset.descOrig ?? "";
  const origActivo = tr.dataset.activoOrig === "1";

  const desc = tr.querySelector(".tc-desc")?.value ?? "";
  const activo = !!tr.querySelector(".tc-activo")?.checked;

  return desc !== origDesc || activo !== origActivo;
}

function rowRevert(tr) {
  const origDesc = tr.dataset.descOrig ?? "";
  const origActivo = tr.dataset.activoOrig === "1";

  const descEl = tr.querySelector(".tc-desc");
  const activoEl = tr.querySelector(".tc-activo");

  if (descEl) descEl.value = origDesc;
  if (activoEl) activoEl.checked = origActivo;

  setRowDirty(tr, false);
}

async function rowSave(tr) {
  const id = tr.dataset.id;
  const desc = tr.querySelector(".tc-desc")?.value ?? "";
  const activo = !!tr.querySelector(".tc-activo")?.checked;

  const { error } = await supabase
    .from("tipos_compromisos")
    .update({ descripcion: desc, activo })
    .eq("id", id);

  if (error) {
    console.error("❌ Error guardando tipo compromiso:", error);
    setMensaje(`Error guardando: ${error.message}`, "error");
    return;
  }

  tr.dataset.descOrig = escapeHtml(desc);
  tr.dataset.activoOrig = activo ? "1" : "0";

  setRowDirty(tr, false);
  setRowEditing(tr, false);

  setMensaje("Cambios guardados.", "info");
}

/* ===========================================================
   NUEVO TIPO (asociado al supervisor)
   =========================================================== */

async function guardarNuevoTipo() {
  const btn = document.getElementById("btnGuardarNuevoTipo");
  if (btn && btn.dataset.loading === "1") return; // anti-doble click / doble listener
  if (btn) {
    btn.dataset.loading = "1";
    btn.disabled = true;
  }
  try {
    const supervisor_id = getSupervisorIdActivo();
    if (!supervisor_id) {
      setMensaje("Sin supervisor activo.", "error");
      return;
    }

    const nombre = ($("nuevoTipoNombre")?.value || "").trim();
    const descripcion = ($("nuevoTipoDescripcion")?.value || "").trim();
    const activo = !!$("nuevoTipoActivo")?.checked;

    if (!nombre) {
      setMensaje("Falta nombre del tipo.", "error");
      $("nuevoTipoNombre")?.focus?.();
      return;
    }

    const { error } = await supabase.from("tipos_compromisos").insert([
      {
        supervisor_id,
        nombre,
        descripcion: descripcion || null,
        activo,
      },
    ]);

    if (error) {
      console.error("❌ Error creando tipo:", error);
      setMensaje(`Error creando: ${error.message}`, "error");
      return;
    }

    cerrar("modalNuevoTipo");
    setMensaje("Tipo creado.", "info");
    await cargarTiposCompromisos();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.dataset.loading = "0";
    }
  }
}

/* ===========================================================
   EVENTOS (delegación)
   =========================================================== */

// Evita duplicar listeners si este módulo se inyecta más de una vez (navegación embebida)
if (window.__ps_click_handler) {
  document.removeEventListener("click", window.__ps_click_handler);
}
window.__ps_click_handler = async (e) => {
  // Botón cerrar aviso
  if (e.target && e.target.id === "btnCerrarAviso") {
    cerrar("modalAviso");
    return;
  }

  if (!$("modulo-configuracion")) return;

  // Selección de parámetro (izquierda)
  const btnParam = e.target.closest("[data-param]");
  if (btnParam) {
    if (btnParam.disabled || btnParam.classList.contains("is-disabled")) return;
    parametroActivo = btnParam.getAttribute("data-param");
    renderAccionesDerecha();
    if ($("mensajeEstado")) $("mensajeEstado").textContent = "";
    return;
  }

  // Acciones derecha (Ver/Editar)
  const btnVer = e.target.closest("#btnVerEditarTipos");
  if (btnVer && parametroActivo === "tipos_compromisos") {
    await cargarTiposCompromisos();
    abrir("modalTiposCompromisos");
    return;
  }

  // Acciones derecha (Nuevo)
  const btnNuevo = e.target.closest("#btnNuevoTipo");
  if (btnNuevo && parametroActivo === "tipos_compromisos") {
    if ($("nuevoTipoNombre")) $("nuevoTipoNombre").value = "";
    if ($("nuevoTipoDescripcion")) $("nuevoTipoDescripcion").value = "";
    if ($("nuevoTipoActivo")) $("nuevoTipoActivo").checked = true;
    abrir("modalNuevoTipo");
    return;
  }

  // Guardar nuevo tipo
  const btnGuardarNuevo = e.target.closest("#btnGuardarNuevoTipo");
  if (btnGuardarNuevo) {
    await guardarNuevoTipo();
    return;
  }

  // Edición por fila
  const tr = e.target.closest("tr.tc-row");
  if (tr) {
    const btnEditar = e.target.closest(".tc-btn-editar");
    const btnGuardar = e.target.closest(".tc-btn-guardar");
    const btnCancelar = e.target.closest(".tc-btn-cancelar");

    if (btnEditar) {
      setRowEditing(tr, true);
      setRowDirty(tr, rowHasChanges(tr));
      return;
    }

    if (btnCancelar) {
      rowRevert(tr);
      setRowEditing(tr, false);
      return;
    }

    if (btnGuardar) {
      if (!rowHasChanges(tr)) {
        setRowDirty(tr, false);
        setRowEditing(tr, false);
        return;
      }
      await rowSave(tr);
      return;
    }
  }
};
document.addEventListener("click", window.__ps_click_handler);

// Detecta cambios para habilitar Guardar
if (window.__ps_input_handler) {
  document.removeEventListener("input", window.__ps_input_handler);
}
window.__ps_input_handler = (e) => {
  if (!$("modulo-configuracion")) return;

  const tr = e.target.closest("tr.tc-row");
  if (!tr) return;
  if (tr.dataset.editing !== "1") return;

  if (e.target.classList.contains("tc-desc")) {
    setRowDirty(tr, rowHasChanges(tr));
  }
};
document.addEventListener("input", window.__ps_input_handler);

document.addEventListener("change", (e) => {
  if (!$("modulo-configuracion")) return;

  const tr = e.target.closest("tr.tc-row");
  if (!tr) return;
  if (tr.dataset.editing !== "1") return;

  if (e.target.classList.contains("tc-activo")) {
    setRowDirty(tr, rowHasChanges(tr));
  }
});

// Tooltip hover sobre “Tipos de compromiso”
document.addEventListener("mouseover", (e) => {
  if (!$("modulo-configuracion")) return;
  const el = e.target.closest('[data-param="tipos_compromisos"]');
  if (el) setTooltip("Administra los tipos de compromisos disponibles.", true);
});

document.addEventListener("mouseout", (e) => {
  if (!$("modulo-configuracion")) return;
  const el = e.target.closest('[data-param="tipos_compromisos"]');
  if (el) setTooltip("", false);
});

// Init
(function init() {
  if (!$("modulo-configuracion")) return;
  parametroActivo = null;
  renderAccionesDerecha();
  setTooltip("", false);
  if ($("mensajeEstado")) $("mensajeEstado").textContent = "";
})();