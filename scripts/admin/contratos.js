import { supabase } from "../../config.js";

let _ctx = {
  container: null,
  rows: [],
  selected: null,
  search: "",
  hasNombreCorto: true,
  hasNuevoVendedor: true,
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getNombreCorto(row) {
  return row?.nombre_corto || row?.descripcion || "";
}

function getNuevoVendedor(row) {
  return row?.nuevo_vendedor === true;
}

function setStatus(msg, isError = false) {
  const el = _ctx.container?.querySelector("#ct-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("ct-status--error", !!isError);
}

function isMissingColumn(error, columnName) {
  const msg = String(error?.message || error?.details || "").toLowerCase();
  return msg.includes(columnName.toLowerCase()) || msg.includes("schema cache");
}

function styles() {
  return `
    <style>
      .ct-shell{width:100%;max-width:100%;margin:0 auto;display:grid;gap:16px;box-sizing:border-box}
      .ct-card{width:100%;max-width:100%;box-sizing:border-box;background:#fff;border:1px solid #dbe7f3;border-radius:20px;box-shadow:0 8px 22px rgba(7,46,94,.06);padding:24px;overflow:hidden}
      .ct-title{margin:0 0 6px 0;font-size:18px;font-weight:800;color:#0b3f79}
      .ct-sub{margin:0;color:#5b6b7c;font-size:14px}
      .ct-grid{display:grid;grid-template-columns:1fr;gap:20px;align-items:start;width:100%;max-width:100%;box-sizing:border-box}
      .ct-tools{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0;width:100%;max-width:100%;box-sizing:border-box}
      .ct-search{flex:1 1 360px;max-width:520px}
      .ct-field{display:flex;flex-direction:column;gap:6px}
      .ct-label{font-size:13px;font-weight:800;color:#33485c}
      .ct-input,.ct-select{width:100%;min-height:42px;border:1px solid #bfd3e8;border-radius:12px;padding:10px 12px;font-size:14px;color:#1e2f3f;background:#fff;box-sizing:border-box}
      .ct-input:focus,.ct-select:focus{outline:none;border-color:#0b56a5;box-shadow:0 0 0 3px rgba(11,86,165,.12)}
      .ct-form{display:grid;gap:14px}
      .ct-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .ct-field--full{grid-column:1/-1}
      .ct-check{display:flex;align-items:center;gap:10px;font-weight:700;color:#203040}
      .ct-check input{accent-color:#0b56a5}
      .ct-actions{display:flex;gap:10px;flex-wrap:wrap}
      .ct-btn{min-height:42px;padding:0 16px;border-radius:12px;border:1px solid #0b56a5;background:#0b56a5;color:#fff;font-weight:800;cursor:pointer}
      .ct-btn--secondary{background:#fff;color:#0b56a5}
      .ct-btn[disabled]{opacity:.45;cursor:not-allowed}
      .ct-table-wrap{width:100%;max-width:100%;box-sizing:border-box;border:1px solid #dbe7f3;border-radius:16px;overflow-x:auto;overflow-y:hidden;background:#fff}
      .ct-table{width:100%;min-width:760px;border-collapse:collapse;font-size:13px}
      .ct-table th,.ct-table td{padding:11px 12px;border-bottom:1px solid #eef3f8;text-align:left;vertical-align:top}
      .ct-table th{background:#f7fbff;color:#38516a;font-size:12px;text-transform:uppercase;white-space:nowrap}
      .ct-table td{white-space:normal;overflow-wrap:anywhere}
      .ct-row{cursor:pointer}
      .ct-row:hover{background:#f9fbfe}
      .ct-row.selected{background:#eaf3ff}
      .ct-pill{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap}
      .ct-pill.ok{background:#eafaf1;color:#1f6f43}
      .ct-pill.off{background:#fff1f1;color:#b42318}
      .ct-pill.new{background:#eaf3ff;color:#0b56a5}
      .ct-status{min-height:24px;font-size:13px;font-weight:800;color:#1f6f43;white-space:pre-wrap}
      .ct-status--error{color:#b42318}
      .ct-help{font-size:12px;color:#5b6b7c;line-height:1.4}
      .ct-form-card{box-shadow:none;margin-top:0}
      @media(max-width:1050px){.ct-form-grid{grid-template-columns:1fr}}
      @media(max-width:760px){.ct-card{padding:16px}.ct-table{min-width:680px}}
    </style>
  `;
}

function shell() {
  return `
    ${styles()}
    <div class="ct-shell">
      <section class="ct-card">
        <h2 class="ct-title">Mantenedor de contratos</h2>
        <p class="ct-sub">Primero se muestra la lista de contratos. Selecciona uno para editarlo en el formulario inferior.</p>

        <div class="ct-grid">
          <div>
            <div class="ct-tools">
              <input id="ct-search" class="ct-input ct-search" placeholder="Buscar contrato..." value="${esc(_ctx.search)}">
              <button id="ct-reload" class="ct-btn ct-btn--secondary" type="button">Recargar</button>
              <button id="ct-new" class="ct-btn" type="button">Nuevo contrato</button>
            </div>

            <div class="ct-table-wrap">
              <table class="ct-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Nombre corto</th>
                    <th>Regla sobre</th>
                    <th>Vigente</th>
                    <th>Nuevo vendedor</th>
                  </tr>
                </thead>
                <tbody id="ct-tbody">
                  <tr><td colspan="6">Cargando...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <aside class="ct-card ct-form-card">
            <h3 class="ct-title" id="ct-form-title">Nuevo contrato</h3>
            <form id="ct-form" class="ct-form" autocomplete="off">
              <input type="hidden" id="ct-id">

              <div class="ct-form-grid">
                <div class="ct-field">
                  <label class="ct-label">Código contrato</label>
                  <input id="ct-codigo" class="ct-input" placeholder="CONTRATO_40UF">
                  <div class="ct-help">Clave técnica. Se normaliza a mayúsculas y guion bajo.</div>
                </div>

                <div class="ct-field">
                  <label class="ct-label">Nombre corto</label>
                  <input id="ct-nombre-corto" class="ct-input" placeholder="40 UF">
                  <div class="ct-help">Este valor aparece en reportes, Excel y combos.</div>
                </div>

                <div class="ct-field ct-field--full">
                  <label class="ct-label">Nombre contrato</label>
                  <input id="ct-nombre" class="ct-input" placeholder="Contrato Comercial 40 UF">
                </div>

                <div class="ct-field">
                  <label class="ct-label">Regla sobre</label>
                  <input id="ct-regla" class="ct-input" placeholder=">40UF / 50%_TOPE_IMPONIBLE">
                </div>

                <div class="ct-field">
                  <label class="ct-label">Vigencia</label>
                  <select id="ct-vigente" class="ct-select">
                    <option value="true">Vigente</option>
                    <option value="false">No vigente</option>
                  </select>
                </div>

                <label class="ct-check ct-field--full">
                  <input type="checkbox" id="ct-nuevo-vendedor">
                  Contrato por defecto para nuevo vendedor
                </label>
              </div>

              <div class="ct-actions">
                <button id="ct-save" class="ct-btn" type="submit">Guardar</button>
                <button id="ct-clear" class="ct-btn ct-btn--secondary" type="button">Limpiar</button>
              </div>

              <div class="ct-help">
                Regla crítica: solo puede existir un contrato con <strong>nuevo_vendedor = true</strong>.
                Si marcas este contrato, el sistema desmarcará los demás antes de guardar.
              </div>

              <div id="ct-status" class="ct-status"></div>
            </form>
          </aside>
        </div>
      </section>
    </div>
  `;
}

async function tryLoadContracts(selectCols, orderCol) {
  return await supabase
    .from("contratos")
    .select(selectCols)
    .order(orderCol, { ascending: true });
}

async function loadContratos() {
  const attempts = [
    {
      name: "full",
      select: "id_contrato, codigo_contrato, nombre_contrato, nombre_corto, descripcion, regla_sobre, vigente, nuevo_vendedor, fecha_creacion",
      order: "nombre_corto",
      hasNombreCorto: true,
      hasNuevoVendedor: true,
    },
    {
      name: "sin_nombre_corto",
      select: "id_contrato, codigo_contrato, nombre_contrato, descripcion, regla_sobre, vigente, nuevo_vendedor, fecha_creacion",
      order: "descripcion",
      hasNombreCorto: false,
      hasNuevoVendedor: true,
    },
    {
      name: "sin_nuevo_vendedor",
      select: "id_contrato, codigo_contrato, nombre_contrato, nombre_corto, descripcion, regla_sobre, vigente, fecha_creacion",
      order: "nombre_corto",
      hasNombreCorto: true,
      hasNuevoVendedor: false,
    },
    {
      name: "minimo",
      select: "id_contrato, codigo_contrato, nombre_contrato, descripcion, regla_sobre, vigente, fecha_creacion",
      order: "id_contrato",
      hasNombreCorto: false,
      hasNuevoVendedor: false,
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    const result = await tryLoadContracts(attempt.select, attempt.order);

    if (!result.error) {
      _ctx.hasNombreCorto = attempt.hasNombreCorto;
      _ctx.hasNuevoVendedor = attempt.hasNuevoVendedor;

      if (attempt.name !== "full") {
        console.warn(`Contratos: cargando con fallback ${attempt.name}. Revisar schema cache/env.`, {
          hasNombreCorto: _ctx.hasNombreCorto,
          hasNuevoVendedor: _ctx.hasNuevoVendedor,
        });
      }

      _ctx.rows = (result.data || []).map((r) => ({
        ...r,
        nombre_corto: getNombreCorto(r),
        nuevo_vendedor: getNuevoVendedor(r),
      }));

      renderRows();

      const warnings = [];
      if (!_ctx.hasNombreCorto) warnings.push("PostgREST no reconoce nombre_corto; se usa descripcion como fallback.");
      if (!_ctx.hasNuevoVendedor) warnings.push("PostgREST no reconoce nuevo_vendedor; la marca por defecto no podrá guardarse hasta refrescar schema.");

      setStatus(
        warnings.length
          ? `Contratos cargados: ${_ctx.rows.length}\n${warnings.join("\n")}`
          : `Contratos cargados: ${_ctx.rows.length}`,
        warnings.length > 0
      );

      return;
    }

    lastError = result.error;
    console.warn(`Contratos: intento ${attempt.name} falló`, result.error);
  }

  throw lastError;
}

function filteredRows() {
  const q = String(_ctx.search || "").trim().toLowerCase();
  if (!q) return _ctx.rows;

  return _ctx.rows.filter((r) =>
    [
      r.codigo_contrato,
      r.nombre_contrato,
      getNombreCorto(r),
      r.descripcion,
      r.regla_sobre,
    ].join(" ").toLowerCase().includes(q)
  );
}

function renderRows() {
  const tbody = _ctx.container.querySelector("#ct-tbody");
  if (!tbody) return;

  const rows = filteredRows();

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">No hay contratos para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r) => `
    <tr class="ct-row ${_ctx.selected && String(_ctx.selected.id_contrato) === String(r.id_contrato) ? "selected" : ""}" data-id="${esc(r.id_contrato)}">
      <td>${esc(r.codigo_contrato)}</td>
      <td>${esc(r.nombre_contrato)}</td>
      <td>${esc(getNombreCorto(r))}</td>
      <td>${esc(r.regla_sobre)}</td>
      <td>${r.vigente ? '<span class="ct-pill ok">Vigente</span>' : '<span class="ct-pill off">No vigente</span>'}</td>
      <td>${r.nuevo_vendedor ? '<span class="ct-pill new">Nuevo vendedor</span>' : '-'}</td>
    </tr>
  `).join("");
}

function clearForm() {
  _ctx.selected = null;
  _ctx.container.querySelector("#ct-form-title").textContent = "Nuevo contrato";
  _ctx.container.querySelector("#ct-id").value = "";
  _ctx.container.querySelector("#ct-codigo").value = "";
  _ctx.container.querySelector("#ct-nombre").value = "";
  _ctx.container.querySelector("#ct-nombre-corto").value = "";
  _ctx.container.querySelector("#ct-regla").value = "";
  _ctx.container.querySelector("#ct-vigente").value = "true";
  _ctx.container.querySelector("#ct-nuevo-vendedor").checked = false;
  _ctx.container.querySelector("#ct-nuevo-vendedor").disabled = !_ctx.hasNuevoVendedor;
  setStatus("");
  renderRows();
}

function fillForm(row) {
  _ctx.selected = row;
  _ctx.container.querySelector("#ct-form-title").textContent = "Editar contrato";
  _ctx.container.querySelector("#ct-id").value = row.id_contrato || "";
  _ctx.container.querySelector("#ct-codigo").value = row.codigo_contrato || "";
  _ctx.container.querySelector("#ct-nombre").value = row.nombre_contrato || "";
  _ctx.container.querySelector("#ct-nombre-corto").value = getNombreCorto(row);
  _ctx.container.querySelector("#ct-regla").value = row.regla_sobre || "";
  _ctx.container.querySelector("#ct-vigente").value = String(row.vigente !== false);
  _ctx.container.querySelector("#ct-nuevo-vendedor").checked = row.nuevo_vendedor === true;
  _ctx.container.querySelector("#ct-nuevo-vendedor").disabled = !_ctx.hasNuevoVendedor;
  setStatus("");
  renderRows();
}

function buildPayload() {
  const id = _ctx.container.querySelector("#ct-id").value || null;
  const codigo = normalizeCode(_ctx.container.querySelector("#ct-codigo").value);
  const nombre = String(_ctx.container.querySelector("#ct-nombre").value || "").trim();
  const nombreCorto = String(_ctx.container.querySelector("#ct-nombre-corto").value || "").trim();
  const regla = String(_ctx.container.querySelector("#ct-regla").value || "").trim();
  const vigente = _ctx.container.querySelector("#ct-vigente").value === "true";
  const nuevoVendedor = _ctx.container.querySelector("#ct-nuevo-vendedor").checked === true;

  if (!codigo) throw new Error("Ingrese el código del contrato.");
  if (!nombre) throw new Error("Ingrese el nombre del contrato.");
  if (!nombreCorto) throw new Error("Ingrese el nombre corto.");
  if (!regla) throw new Error("Ingrese la regla de sobre.");

  const data = {
    codigo_contrato: codigo,
    nombre_contrato: nombre,
    descripcion: nombreCorto,
    regla_sobre: regla,
    vigente,
  };

  if (_ctx.hasNombreCorto) {
    data.nombre_corto = nombreCorto;
  }

  if (_ctx.hasNuevoVendedor) {
    data.nuevo_vendedor = nuevoVendedor;
  }

  return { id, data };
}

async function saveContrato(ev) {
  ev.preventDefault();

  try {
    setStatus("Guardando contrato...", false);
    const { id, data } = buildPayload();

    if (_ctx.hasNuevoVendedor && data.nuevo_vendedor) {
      const { error: resetErr } = await supabase
        .from("contratos")
        .update({ nuevo_vendedor: false })
        .eq("nuevo_vendedor", true);

      if (resetErr) throw resetErr;
    }

    let result;
    if (id) {
      result = await supabase
        .from("contratos")
        .update(data)
        .eq("id_contrato", id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("contratos")
        .insert(data)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    setStatus("Contrato guardado correctamente.", false);
    await loadContratos();
    fillForm({
      ...result.data,
      nombre_corto: getNombreCorto(result.data),
      nuevo_vendedor: getNuevoVendedor(result.data),
    });
  } catch (e) {
    console.error("Error guardando contrato:", e);
    setStatus(e?.message || "No fue posible guardar el contrato.", true);
  }
}

function bindEvents() {
  _ctx.container.querySelector("#ct-form")?.addEventListener("submit", saveContrato);
  _ctx.container.querySelector("#ct-clear")?.addEventListener("click", clearForm);
  _ctx.container.querySelector("#ct-new")?.addEventListener("click", clearForm);

  _ctx.container.querySelector("#ct-reload")?.addEventListener("click", async () => {
    try {
      setStatus("Recargando contratos...", false);
      await loadContratos();
    } catch (e) {
      setStatus(e?.message || "No fue posible recargar contratos.", true);
    }
  });

  _ctx.container.querySelector("#ct-search")?.addEventListener("input", (e) => {
    _ctx.search = e.target.value;
    renderRows();
  });

  _ctx.container.querySelector("#ct-codigo")?.addEventListener("blur", (e) => {
    e.target.value = normalizeCode(e.target.value);
  });

  _ctx.container.querySelector("#ct-tbody")?.addEventListener("click", (e) => {
    const rowEl = e.target.closest(".ct-row");
    if (!rowEl) return;

    const row = _ctx.rows.find((r) => String(r.id_contrato) === String(rowEl.dataset.id));
    if (row) fillForm(row);
  });
}

export async function renderContratos(container) {
  _ctx.container = container;
  container.innerHTML = shell();
  bindEvents();

  try {
    await loadContratos();
  } catch (e) {
    console.error("Error cargando contratos:", e);
    setStatus(e?.message || "No fue posible cargar contratos.", true);
  }
}
