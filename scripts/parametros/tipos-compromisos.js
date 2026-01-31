// Modulo aislado: Tipos de Compromisos
// Usa elementos existentes en parametros-supervisor.html:
// - modalTiposCompromisos, tbodyTiposCompromisos
// - modalNuevoTipo + inputs nuevoTipo*
// - modalAviso

let __inited = false;
let __ctx = null;

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

async function cargarTiposCompromisos() {
  const tbody = __ctx.$("tbodyTiposCompromisos");
  if (!tbody) return;

  const supervisorId = await __ctx.getSupervisorId();
  if (!supervisorId) {
    tbody.innerHTML = `<tr><td colspan="6">Sin sesión activa</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6">Cargando...</td></tr>`;

  const { data, error } = await __ctx.supabase
    .from("tipos_compromisos")
    .select("id, supervisor_id, nombre, descripcion, activo, visible_para_todos, es_obligatorio, orden")
    .eq("supervisor_id", supervisorId)
    .order("orden", { ascending: true, nullsFirst: false })
    .order("nombre", { ascending: true });

  if (error) {
    console.error("PostgREST error:", error);
    tbody.innerHTML = `<tr><td colspan="6" style="color:#c00; text-align:center;">${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; opacity:.7;">Sin registros</td></tr>`;
    return;
  }

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

          <td class="tc-nombre">${escapeHtml(t.nombre)}</td>

          <td>
            <textarea class="tc-desc" disabled rows="2">${escapeHtml(desc)}</textarea>
          </td>

          <td style="text-align:center">
            <input type="checkbox" class="tc-activo" ${t.activo ? "checked" : ""} disabled>
          </td>

          <td style="text-align:center">
            <input type="checkbox" class="tc-visible" ${t.visible_para_todos ? "checked" : ""} disabled>
          </td>

          <td class="tc-actions" style="text-align:center; white-space:nowrap;">
            <button class="btn btn--secondary btn-icon tc-btn-editar" type="button" title="Editar" aria-label="Editar">
              ${iconEditar()}
            </button>

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

  const desc = tr.querySelector(".tc-desc")?.value ?? "";
  const activo = tr.querySelector(".tc-activo")?.checked ?? false;
  const visible = tr.querySelector(".tc-visible")?.checked ?? false;

  return desc !== descOrig || activo !== activoOrig || visible !== visibleOrig;
}

function rowRevert(tr) {
  const desc = tr.querySelector(".tc-desc");
  const activo = tr.querySelector(".tc-activo");
  const visible = tr.querySelector(".tc-visible");

  if (desc) desc.value = tr.dataset.descOrig ?? "";
  if (activo) activo.checked = tr.dataset.activoOrig === "1";
  if (visible) visible.checked = tr.dataset.visibleOrig === "1";
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
  const supervisorId = await __ctx.getSupervisorId();
  if (!supervisorId) {
    __ctx.setMensaje("Sin sesión activa", "error");
    return;
  }

  const id = tr.dataset.id;

  const payload = {
    descripcion: tr.querySelector(".tc-desc")?.value ?? null,
    activo: !!tr.querySelector(".tc-activo")?.checked,
    visible_para_todos: !!tr.querySelector(".tc-visible")?.checked,
  };

  const { error } = await __ctx.supabase
    .from("tipos_compromisos")
    .update(payload)
    .eq("id", id)
    .eq("supervisor_id", supervisorId);

  if (error) {
    console.error("Update error:", error.message, error.details, error.hint);
    __ctx.setMensaje(error.message, "error");
    return;
  }

  tr.dataset.descOrig = payload.descripcion ?? "";
  tr.dataset.activoOrig = payload.activo ? "1" : "0";
  tr.dataset.visibleOrig = payload.visible_para_todos ? "1" : "0";

  setRowEditing(tr, false);
  __ctx.setMensaje("Cambios guardados");
}

async function guardarNuevoTipo() {
  const supervisor_id = await __ctx.getSupervisorId();
  if (!supervisor_id) {
    __ctx.setMensaje("Sin sesión activa", "error");
    return;
  }

  const nombre = (__ctx.$("nuevoTipoNombre")?.value ?? "").trim();
  if (!nombre) {
    __ctx.setMensaje("Falta nombre", "error");
    return;
  }

  const payload = {
    supervisor_id,
    nombre,
    descripcion: (__ctx.$("nuevoTipoDescripcion")?.value ?? "").trim() || null,
    activo: __ctx.$("nuevoTipoActivo")?.checked ?? true,
    visible_para_todos: __ctx.$("nuevoTipoVisibleParaTodos")?.checked ?? false,
    // Si el HTML futuro incluye estos campos, quedan soportados
    es_obligatorio: __ctx.$("nuevoTipoEsObligatorio")?.checked ?? false,
    orden: (() => {
      const v = (__ctx.$("nuevoTipoOrden")?.value ?? "").trim();
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
  };

  const { error } = await __ctx.supabase.from("tipos_compromisos").insert([payload]);

  if (error) {
    console.error("Insert error:", error.message, error.details, error.hint);
    __ctx.setMensaje(error.message, "error");
    return;
  }

  __ctx.cerrar("modalNuevoTipo");
  __ctx.setMensaje("Tipo creado");
  await cargarTiposCompromisos();
}

function open() {
  __ctx.abrir("modalTiposCompromisos");
  cargarTiposCompromisos().catch((err) => {
    console.error("Error cargando tipos_compromisos:", err);
    const tbody = __ctx.$("tbodyTiposCompromisos");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="color:#c00; text-align:center;">Error cargando datos</td></tr>`;
  });
}

function openCreate() {
  if (__ctx.$("nuevoTipoNombre")) __ctx.$("nuevoTipoNombre").value = "";
  if (__ctx.$("nuevoTipoDescripcion")) __ctx.$("nuevoTipoDescripcion").value = "";
  if (__ctx.$("nuevoTipoActivo")) __ctx.$("nuevoTipoActivo").checked = true;
  if (__ctx.$("nuevoTipoVisibleParaTodos")) __ctx.$("nuevoTipoVisibleParaTodos").checked = false;
  if (__ctx.$("nuevoTipoEsObligatorio")) __ctx.$("nuevoTipoEsObligatorio").checked = false;
  if (__ctx.$("nuevoTipoOrden")) __ctx.$("nuevoTipoOrden").value = "";

  __ctx.abrir("modalNuevoTipo");
}

function bindOnce() {
  // Tabla: delegación
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

  const btnGuardarNuevoTipo = __ctx.$("btnGuardarNuevoTipo");
  if (btnGuardarNuevoTipo) {
    btnGuardarNuevoTipo.addEventListener("click", guardarNuevoTipo);
  }
}

export function initTiposCompromisos(ctx) {
  // Mantiene un singleton para no duplicar listeners
  __ctx = ctx;

  if (!__inited) {
    __inited = true;
    bindOnce();
  }

  return { open, openCreate, reload: cargarTiposCompromisos };
}
