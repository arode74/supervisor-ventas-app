import { supabase } from "../../config.js";

/**
 * vendedor.js — Administración de vendedores
 * Archivo nuevo para gestión administrativa de vendedores.
 *
 * Exporta:
 *   renderVendedor(container)
 */

let _ctx = {
  container: null,
  zonas: [],
  equipos: [],
  zonaEquipo: [],
  vendedores: [],
  vendedoresView: [],
  contratos: [],
  selected: null,
  filters: { idZona: "", idEquipo: "", nombre: "", rut: "" },
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarTexto(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function onlyRut(value) {
  return String(value ?? "").replace(/[^0-9kK]/g, "").toUpperCase();
}

function rutFormateado(rut, dv) {
  if (rut == null || dv == null) return "";
  const cuerpo = String(rut).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${String(dv).toUpperCase()}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateIso, days) {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function notify(msg) {
  try {
    if (typeof mostrarAlerta === "function") return mostrarAlerta(msg);
  } catch (_) {}
  window.alert(msg);
}

function setStatus(msg, error = false) {
  const el = _ctx.container?.querySelector("#ven-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("ven-status--error", !!error);
}

function styles() {
  return `
    <style>
      .ven-shell{
        display:grid;
        gap:16px;
        width:100%;
        max-width:100%;
        min-width:0;
        box-sizing:border-box;
      }

      .ven-card{
        background:#fff;
        border:1px solid #dbe7f3;
        border-radius:20px;
        box-shadow:0 8px 22px rgba(7,46,94,.06);
        padding:24px;
        width:100%;
        max-width:100%;
        min-width:0;
        overflow:hidden;
        box-sizing:border-box;
      }
      .ven-title{margin:0 0 6px 0;font-size:18px;font-weight:800;color:#0b3f79}
      .ven-sub{margin:0;color:#5b6b7c;font-size:14px}
      .ven-filters{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin-top:16px;
        width:100%;
        max-width:100%;
        min-width:0;
        box-sizing:border-box;
      }
      .ven-field{display:flex;flex-direction:column;gap:6px}
      .ven-label{font-size:13px;font-weight:800;color:#33485c}
      .ven-input,.ven-select{width:100%;min-height:42px;border:1px solid #bfd3e8;border-radius:12px;padding:10px 12px;font-size:14px;color:#1e2f3f;background:#fff;box-sizing:border-box}
      .ven-input:focus,.ven-select:focus{outline:none;border-color:#0b56a5;box-shadow:0 0 0 3px rgba(11,86,165,.12)}
      .ven-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
      .ven-btn{min-height:52px;padding:12px 20px;border-radius:12px;border:1px solid #0b56a5;background:#0b56a5;color:#fff;font-weight:800;cursor:pointer;white-space:normal;line-height:1.2;text-align:center;display:inline-flex;align-items:center;justify-content:center;width:260px;max-width:100%}
      .ven-btn--secondary{background:#fff;color:#0b56a5}
      .ven-btn--danger{background:#b42318;border-color:#b42318}
      .ven-table-wrap{
        border:1px solid #dbe7f3;
        border-radius:16px;
        overflow:auto;
        background:#fff;
        margin-top:16px;
        max-height:calc(100vh - 320px);
        width:100%;
        max-width:100%;
        min-width:0;
        box-sizing:border-box;
      }

      .ven-table{
        width:100%;
        max-width:100%;
        min-width:760px;
        border-collapse:collapse;
        font-size:13px;
      }
      .ven-table th,.ven-table td{padding:11px 12px;border-bottom:1px solid #eef3f8;text-align:left;white-space:nowrap}
      .ven-table th{
        background:#f7fbff;
        color:#38516a;
        font-size:12px;
        text-transform:uppercase;
        position:sticky;
        top:0;
        z-index:2;
      }
      .ven-row{cursor:pointer}
      .ven-row:hover{background:#f9fbfe}
      .ven-pill{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800}
      .ven-pill.ok{background:#eafaf1;color:#1f6f43}
      .ven-status{min-height:24px;font-size:13px;font-weight:800;color:#1f6f43;margin-top:10px;white-space:pre-wrap}
      .ven-status--error{color:#b42318}
      .ven-modal{border:0;border-radius:20px;padding:0;max-width:980px;width:min(980px,94vw);box-shadow:0 24px 80px rgba(0,0,0,.25)}
      .ven-modal::backdrop{background:rgba(4,20,38,.45)}
      .ven-modal__body{padding:22px;background:#fff}
      .ven-modal__header{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid #edf3f8;padding-bottom:14px;margin-bottom:16px}
      .ven-modal__title{margin:0;font-size:18px;font-weight:900;color:#0b3f79}
      .ven-x{border:1px solid #bfd3e8;background:#fff;border-radius:10px;min-width:38px;min-height:38px;font-size:18px;font-weight:900;color:#0b3f79;cursor:pointer}
      .ven-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px}
      .ven-block{border:1px solid #dbe7f3;border-radius:16px;background:#fbfdff;padding:16px;margin-top:14px}
      .ven-block h3{margin:0 0 12px 0;color:#0b3f79;font-size:15px}
      .ven-help{font-size:12px;color:#5b6b7c;line-height:1.4;margin-top:6px}
      @media(max-width:900px){.ven-filters{grid-template-columns:1fr 1fr}.ven-grid{grid-template-columns:1fr}}
      @media(max-width:620px){.ven-filters{grid-template-columns:1fr}}
    </style>
  `;
}

function shell() {
  return `
    ${styles()}
    <div class="ven-shell">
      <section class="ven-card">
        <h2 class="ven-title">Vendedores</h2>
        <p class="ven-sub">Listado de vendedores vigentes con filtros por zona, equipo, nombre y RUT. Doble clic para editar.</p>
        <div class="ven-filters">
          <div class="ven-field"><label class="ven-label">Zona</label><select class="ven-select" id="ven-filtro-zona"><option value="">Todas</option></select></div>
          <div class="ven-field"><label class="ven-label">Equipo</label><select class="ven-select" id="ven-filtro-equipo" disabled><option value="">Todos</option></select></div>
          <div class="ven-field"><label class="ven-label">Nombre vendedor</label><input class="ven-input" id="ven-filtro-nombre" placeholder="Buscar por nombre"></div>
          <div class="ven-field"><label class="ven-label">RUT</label><input class="ven-input" id="ven-filtro-rut" placeholder="Buscar por RUT"></div>
        </div>
        <div class="ven-actions">
          <button class="ven-btn" id="ven-buscar">Buscar</button>
          <button class="ven-btn ven-btn--secondary" id="ven-limpiar">Limpiar filtros</button>
          <button class="ven-btn ven-btn--secondary" id="ven-recargar">Recargar</button>
        </div>
        <div id="ven-status" class="ven-status"></div>
        <div class="ven-table-wrap">
          <table class="ven-table">
            <thead><tr><th>Vendedor</th><th>RUT</th><th>Zona</th><th>Equipo vigente</th><th>Contrato vigente</th><th>Ingreso</th><th>Estado</th></tr></thead>
            <tbody id="ven-tbody"><tr><td colspan="7">Cargando...</td></tr></tbody>
          </table>
        </div>
      </section>
      <dialog id="ven-modal" class="ven-modal">
        <div class="ven-modal__body">
          <div class="ven-modal__header">
            <h2 class="ven-modal__title" id="ven-modal-title">Detalle vendedor</h2>
            <button type="button" class="ven-x" id="ven-modal-close">×</button>
          </div>
          <div id="ven-modal-content"></div>
        </div>
      </dialog>
    </div>
  `;
}

async function selectTable(table, columns, filters = null) {
  let q = supabase.from(table).select(columns);
  if (filters) q = filters(q);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function loadAll() {
  setStatus("Cargando vendedores...", false);

  const [zonas, equipos, zonaEquipo, contratos, vendedoresBase, equipoVendedor, vendedorContrato] = await Promise.all([
    selectTable("zonas", "id_zona, nombre", (q) => q.order("nombre", { ascending: true })),
    selectTable("equipos", "id_equipo, nombre_equipo", (q) => q.order("nombre_equipo", { ascending: true })),
    selectTable("zona_equipo", "id_zona, id_equipo, fecha_inicio, fecha_fin, estado", (q) => q.eq("estado", true)),
    selectTable("contratos", "id_contrato, descripcion, vigente", (q) => q.eq("vigente", true).order("descripcion", { ascending: true })),
    selectTable("vendedores", "id_vendedor, nombre, rut, dv, fecha_ingreso, fecha_egreso, estado, fecha_creacion", (q) => q.is("fecha_egreso", null).order("nombre", { ascending: true })),
    selectTable("equipo_vendedor", "id_relacion, id_vendedor, id_equipo, fecha_inicio, fecha_fin, estado", (q) => q.eq("estado", true).is("fecha_fin", null)),
    selectTable("vendedor_contrato", "id_vendedor_contrato, id_vendedor, id_contrato, fecha_inicio, fecha_fin", (q) => q.is("fecha_fin", null)),
  ]);

  _ctx.zonas = zonas;
  _ctx.equipos = equipos;
  _ctx.zonaEquipo = zonaEquipo;
  _ctx.contratos = contratos;

  const equipoById = new Map(equipos.map((e) => [String(e.id_equipo), e]));
  const contratoById = new Map(contratos.map((c) => [String(c.id_contrato), c]));
  const evByVend = new Map(equipoVendedor.map((ev) => [String(ev.id_vendedor), ev]));
  const vcByVend = new Map(vendedorContrato.map((vc) => [String(vc.id_vendedor), vc]));

  _ctx.vendedores = vendedoresBase.map((v) => {
    const ev = evByVend.get(String(v.id_vendedor)) || null;
    const equipo = ev ? equipoById.get(String(ev.id_equipo)) : null;
    const ze = ev ? zonaEquipo.find((z) => String(z.id_equipo) === String(ev.id_equipo) && z.estado === true && !z.fecha_fin) : null;
    const zona = ze ? zonas.find((z) => String(z.id_zona) === String(ze.id_zona)) : null;
    const vc = vcByVend.get(String(v.id_vendedor)) || null;
    const contrato = vc ? contratoById.get(String(vc.id_contrato)) : null;

    return {
      ...v,
      rut_fmt: rutFormateado(v.rut, v.dv),
      id_equipo: ev?.id_equipo || null,
      id_relacion_equipo: ev?.id_relacion || null,
      nombre_equipo: equipo?.nombre_equipo || "",
      id_zona: zona?.id_zona || null,
      nombre_zona: zona?.nombre || "",
      id_vendedor_contrato: vc?.id_vendedor_contrato || null,
      id_contrato: vc?.id_contrato || null,
      contrato_fecha_inicio: vc?.fecha_inicio || null,
      contrato_desc: contrato?.descripcion || "",
    };
  });

  fillZonaFilter();
  fillEquipoFilter();
  applyFilters();
  setStatus(`Vendedores cargados: ${_ctx.vendedoresView.length}`, false);
}

function fillZonaFilter() {
  const sel = _ctx.container.querySelector("#ven-filtro-zona");
  if (!sel) return;
  sel.innerHTML = `<option value="">Todas</option>` + _ctx.zonas.map((z) => `<option value="${esc(z.id_zona)}">${esc(z.nombre)}</option>`).join("");
  sel.value = _ctx.filters.idZona || "";
}

function fillEquipoFilter() {
  const sel = _ctx.container.querySelector("#ven-filtro-equipo");
  if (!sel) return;

  let equipos = _ctx.equipos;
  if (_ctx.filters.idZona) {
    const ids = new Set(_ctx.zonaEquipo.filter((ze) => String(ze.id_zona) === String(_ctx.filters.idZona) && ze.estado === true && !ze.fecha_fin).map((ze) => String(ze.id_equipo)));
    equipos = equipos.filter((e) => ids.has(String(e.id_equipo)));
  }

  sel.innerHTML = `<option value="">Todos</option>` + equipos.map((e) => `<option value="${esc(e.id_equipo)}">${esc(e.nombre_equipo)}</option>`).join("");
  sel.disabled = !!_ctx.filters.idZona && equipos.length === 0;
  sel.value = _ctx.filters.idEquipo || "";
}

function applyFilters() {
  const nombre = normalizarTexto(_ctx.filters.nombre);
  const rut = onlyRut(_ctx.filters.rut);

  _ctx.vendedoresView = _ctx.vendedores.filter((v) => {
    if (_ctx.filters.idZona && String(v.id_zona) !== String(_ctx.filters.idZona)) return false;
    if (_ctx.filters.idEquipo && String(v.id_equipo) !== String(_ctx.filters.idEquipo)) return false;
    if (nombre && !normalizarTexto(v.nombre).includes(nombre)) return false;
    if (rut && !onlyRut(`${v.rut}${v.dv}`).includes(rut)) return false;
    return true;
  });

  renderTable();
}

function renderTable() {
  const tbody = _ctx.container.querySelector("#ven-tbody");
  if (!tbody) return;

  if (!_ctx.vendedoresView.length) {
    tbody.innerHTML = `<tr><td colspan="7">No hay vendedores vigentes para los filtros seleccionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = _ctx.vendedoresView.map((v) => `
    <tr class="ven-row" data-id="${esc(v.id_vendedor)}">
      <td>${esc(v.nombre)}</td>
      <td>${esc(v.rut_fmt)}</td>
      <td>${esc(v.nombre_zona || "-")}</td>
      <td>${esc(v.nombre_equipo || "-")}</td>
      <td>${esc(v.contrato_desc || "Sin contrato")}</td>
      <td>${esc(v.fecha_ingreso || "-")}</td>
      <td><span class="ven-pill ok">Vigente</span></td>
    </tr>
  `).join("");
}

function modalHtml(v) {
  const zonasOptions = _ctx.zonas.map((z) => `<option value="${esc(z.id_zona)}" ${String(z.id_zona) === String(v.id_zona) ? "selected" : ""}>${esc(z.nombre)}</option>`).join("");
  const equiposOptions = _ctx.equipos.map((e) => `<option value="${esc(e.id_equipo)}" ${String(e.id_equipo) === String(v.id_equipo) ? "selected" : ""}>${esc(e.nombre_equipo)}</option>`).join("");
  const contratosOptions = _ctx.contratos.map((c) => `<option value="${esc(c.id_contrato)}" ${String(c.id_contrato) === String(v.id_contrato) ? "selected" : ""}>${esc(c.descripcion)}</option>`).join("");

  return `
    <div class="ven-block">
      <h3>Datos del vendedor</h3>
      <div class="ven-grid">
        <div class="ven-field">
          <label class="ven-label">Nombre</label>
          <input class="ven-input" id="ven-edit-nombre" value="${esc(v.nombre)}">
        </div>

        <div class="ven-field">
          <label class="ven-label">RUT</label>
          <input class="ven-input" value="${esc(v.rut_fmt)}" readonly>
        </div>

        <div class="ven-field">
          <label class="ven-label">Fecha ingreso</label>
          <input class="ven-input" id="ven-edit-fecha-ingreso" type="date" value="${esc(v.fecha_ingreso || "")}">
        </div>

        <div class="ven-field">
          <label class="ven-label">Zona actual</label>
          <select class="ven-select" id="ven-edit-zona-actual">
            <option value="">Seleccione zona</option>
            ${zonasOptions}
          </select>
          <div class="ven-help">La zona filtra los equipos disponibles para cambio de equipo.</div>
        </div>

        <div class="ven-field">
          <label class="ven-label">Equipo actual</label>
          <input class="ven-input" value="${esc(v.nombre_equipo || "")}" readonly>
        </div>

        <div class="ven-field">
          <label class="ven-label">Contrato actual</label>
          <select class="ven-select" id="ven-edit-contrato">
            <option value="">Seleccione contrato</option>
            ${contratosOptions}
          </select>
        </div>

        <div class="ven-field">
          <label class="ven-label">Fecha cambio contrato</label>
          <input class="ven-input" id="ven-edit-contrato-inicio" type="date">
          <div class="ven-help">El contrato anterior se cerrará automáticamente con fecha cambio - 1.</div>
        </div>
      </div>

      <div class="ven-actions">
        <button class="ven-btn" id="ven-btn-guardar-datos">Guardar datos vendedor</button>
        <button class="ven-btn ven-btn--secondary" id="ven-btn-cambiar-contrato">Guardar cambio contrato</button>
      </div>

      <div class="ven-help">
        El RUT queda bloqueado. El equipo actual no se edita directamente; se cambia en el bloque "Cambiar equipo".
      </div>
    </div>

    <div class="ven-block">
      <h3>Cambiar equipo</h3>
      <div class="ven-grid">
        <div class="ven-field">
          <label class="ven-label">Nuevo equipo</label>
          <select class="ven-select" id="ven-edit-equipo">${equiposOptions}</select>
        </div>

        <div class="ven-field">
          <label class="ven-label">Fecha fin equipo actual</label>
          <input class="ven-input" id="ven-edit-equipo-fin" type="date">
          <div class="ven-help">Debe ser anterior o igual a la fecha inicio del nuevo equipo.</div>
        </div>

        <div class="ven-field">
          <label class="ven-label">Fecha inicio nuevo equipo</label>
          <input class="ven-input" id="ven-edit-equipo-inicio" type="date">
        </div>
      </div>

      <div class="ven-actions">
        <button class="ven-btn" id="ven-btn-cambiar-equipo">Aplicar cambio de equipo</button>
      </div>
    </div>

    <div class="ven-block">
      <h3>Dar de baja</h3>
      <div class="ven-grid">
        <div class="ven-field">
          <label class="ven-label">Fecha de baja</label>
          <input class="ven-input" id="ven-edit-fecha-baja" type="date" min="${esc(v.fecha_ingreso || "")}">
          <div class="ven-help">No se permite baja anterior a la fecha de ingreso ni con ventas posteriores.</div>
        </div>
      </div>

      <div class="ven-actions">
        <button class="ven-btn ven-btn--danger" id="ven-btn-baja">Dar de baja vendedor</button>
      </div>
    </div>
  `;
}

function filtrarEquiposModalPorZona() {
  const zonaSel = _ctx.container.querySelector("#ven-edit-zona-actual");
  const equipoSel = _ctx.container.querySelector("#ven-edit-equipo");
  if (!zonaSel || !equipoSel) return;

  const idZona = zonaSel.value;
  let equipos = _ctx.equipos;

  if (idZona) {
    const ids = new Set(
      _ctx.zonaEquipo
        .filter((ze) => String(ze.id_zona) === String(idZona) && ze.estado === true && !ze.fecha_fin)
        .map((ze) => String(ze.id_equipo))
    );
    equipos = equipos.filter((e) => ids.has(String(e.id_equipo)));
  }

  equipoSel.innerHTML = equipos
    .map((e) => `<option value="${esc(e.id_equipo)}">${esc(e.nombre_equipo)}</option>`)
    .join("");
}

function openModal(v) {
  _ctx.selected = v;
  const modal = _ctx.container.querySelector("#ven-modal");
  const title = _ctx.container.querySelector("#ven-modal-title");
  const content = _ctx.container.querySelector("#ven-modal-content");
  title.textContent = `Detalle vendedor — ${v.nombre}`;
  content.innerHTML = modalHtml(v);
  bindModalEvents();
  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "open");
}

function closeModal() {
  const modal = _ctx.container.querySelector("#ven-modal");
  if (!modal) return;
  if (typeof modal.close === "function") modal.close();
  else modal.removeAttribute("open");
}

async function validarVentasPosteriores(idVendedor, fechaCorte) {
  const { data, error } = await supabase
    .from("ventas")
    .select("id_venta, fecha_venta, monto, descripcion")
    .eq("id_vendedor", idVendedor)
    .gt("fecha_venta", fechaCorte);

  if (error) throw error;
  return data || [];
}

async function guardarDatosVendedor() {
  const v = _ctx.selected;
  if (!v) return;

  const nombre = _ctx.container.querySelector("#ven-edit-nombre")?.value?.trim();
  const fechaIngreso = _ctx.container.querySelector("#ven-edit-fecha-ingreso")?.value || null;

  if (!nombre) return notify("Ingrese el nombre del vendedor.");
  if (!fechaIngreso) return notify("Ingrese la fecha de ingreso.");
  if (fechaIngreso > todayIso()) return notify("La fecha de ingreso no puede ser futura.");

  const ventasPosteriores = await validarVentasPosteriores(v.id_vendedor, fechaIngreso);
  if (ventasPosteriores.length && fechaIngreso > todayIso()) {
    return notify("La fecha de ingreso no es válida para el historial del vendedor.");
  }

  const { error } = await supabase
    .from("vendedores")
    .update({
      nombre,
      fecha_ingreso: fechaIngreso,
    })
    .eq("id_vendedor", v.id_vendedor);

  if (error) throw error;

  notify("✅ Datos del vendedor actualizados correctamente.");
  closeModal();
  await loadAll();
}

async function cambiarEquipo() {
  const v = _ctx.selected;
  const nuevoEquipo = _ctx.container.querySelector("#ven-edit-equipo")?.value;
  const fechaFin = _ctx.container.querySelector("#ven-edit-equipo-fin")?.value;
  const fechaInicio = _ctx.container.querySelector("#ven-edit-equipo-inicio")?.value;

  if (!nuevoEquipo) return notify("Seleccione el nuevo equipo.");
  if (!fechaFin) return notify("Ingrese la fecha de fin del equipo actual.");
  if (!fechaInicio) return notify("Ingrese la fecha de inicio del nuevo equipo.");
  if (fechaInicio > todayIso()) return notify("La fecha de inicio del nuevo equipo no puede ser futura.");
  if (fechaFin > fechaInicio) return notify("La fecha fin del equipo actual no puede ser posterior a la fecha inicio del nuevo equipo.");
  if (v.fecha_ingreso && fechaInicio < v.fecha_ingreso) return notify(`La fecha inicio del nuevo equipo no puede ser anterior a la fecha de ingreso (${v.fecha_ingreso}).`);
  if (String(nuevoEquipo) === String(v.id_equipo)) return notify("El nuevo equipo es el mismo equipo vigente.");

  const ventasPosteriores = await validarVentasPosteriores(v.id_vendedor, fechaFin);
  if (ventasPosteriores.length) return notify("No se puede cambiar el equipo con esa fecha de fin porque existen ventas posteriores.");

  const { error: errClose } = await supabase
    .from("equipo_vendedor")
    .update({ fecha_fin: fechaFin, estado: false })
    .eq("id_vendedor", v.id_vendedor)
    .eq("id_equipo", v.id_equipo)
    .is("fecha_fin", null);

  if (errClose) throw errClose;

  const { error: errInsert } = await supabase
    .from("equipo_vendedor")
    .insert({ id_vendedor: v.id_vendedor, id_equipo: nuevoEquipo, fecha_inicio: fechaInicio, fecha_fin: null, estado: true });

  if (errInsert) throw errInsert;

  notify("✅ Cambio de equipo aplicado correctamente.");
  closeModal();
  await loadAll();
}

async function cambiarContrato() {
  const v = _ctx.selected;
  const nuevoContrato = _ctx.container.querySelector("#ven-edit-contrato")?.value;
  const fechaInicio = _ctx.container.querySelector("#ven-edit-contrato-inicio")?.value;

  if (!nuevoContrato) return notify("Seleccione el nuevo contrato.");
  if (!fechaInicio) return notify("Ingrese la fecha de inicio del nuevo contrato.");
  if (fechaInicio > todayIso()) return notify("La fecha de inicio del contrato no puede ser futura.");
  if (String(nuevoContrato) === String(v.id_contrato)) return notify("El nuevo contrato es el mismo contrato vigente.");
  if (v.fecha_ingreso && fechaInicio < v.fecha_ingreso) return notify(`La fecha de inicio del contrato no puede ser anterior a la fecha de ingreso (${v.fecha_ingreso}).`);

  const fechaFinContratoAnterior = addDays(fechaInicio, -1);

  const { error: errClose } = await supabase
    .from("vendedor_contrato")
    .update({ fecha_fin: fechaFinContratoAnterior })
    .eq("id_vendedor", v.id_vendedor)
    .is("fecha_fin", null);

  if (errClose) throw errClose;

  const { error: errInsert } = await supabase
    .from("vendedor_contrato")
    .insert({ id_vendedor: v.id_vendedor, id_contrato: Number(nuevoContrato), fecha_inicio: fechaInicio, fecha_fin: null });

  if (errInsert) throw errInsert;

  notify("✅ Cambio de contrato aplicado correctamente.");
  closeModal();
  await loadAll();
}

async function darBaja() {
  const v = _ctx.selected;
  const fechaBaja = _ctx.container.querySelector("#ven-edit-fecha-baja")?.value;

  if (!fechaBaja) return notify("Ingrese la fecha de baja.");
  if (v.fecha_ingreso && fechaBaja < v.fecha_ingreso) return notify(`La fecha de baja no puede ser anterior a la fecha de ingreso (${v.fecha_ingreso}).`);

  const ventasPosteriores = await validarVentasPosteriores(v.id_vendedor, fechaBaja);
  if (ventasPosteriores.length) return notify("No se puede dar de baja al vendedor porque existen ventas posteriores a la fecha seleccionada.");

  const ok = window.confirm(`¿Confirmas la baja del vendedor ${v.nombre} con fecha ${fechaBaja}?`);
  if (!ok) return;

  const { error: errEquipo } = await supabase
    .from("equipo_vendedor")
    .update({ fecha_fin: fechaBaja, estado: false })
    .eq("id_vendedor", v.id_vendedor)
    .eq("id_equipo", v.id_equipo)
    .is("fecha_fin", null);
  if (errEquipo) throw errEquipo;

  const { error: errContrato } = await supabase
    .from("vendedor_contrato")
    .update({ fecha_fin: fechaBaja })
    .eq("id_vendedor", v.id_vendedor)
    .is("fecha_fin", null);
  if (errContrato) throw errContrato;

  const { error: errVend } = await supabase
    .from("vendedores")
    .update({ fecha_egreso: fechaBaja, estado: "DESVINCULADO" })
    .eq("id_vendedor", v.id_vendedor);
  if (errVend) throw errVend;

  notify("✅ Vendedor dado de baja correctamente.");
  closeModal();
  await loadAll();
}

function bindModalEvents() {
  _ctx.container.querySelector("#ven-edit-zona-actual")?.addEventListener("change", () => {
    filtrarEquiposModalPorZona();
  });

  _ctx.container.querySelector("#ven-btn-guardar-datos")?.addEventListener("click", async () => {
    try { await guardarDatosVendedor(); } catch (e) { console.error(e); notify(e?.message || "No fue posible guardar los datos del vendedor."); }
  });

  _ctx.container.querySelector("#ven-btn-cambiar-equipo")?.addEventListener("click", async () => {
    try { await cambiarEquipo(); } catch (e) { console.error(e); notify(e?.message || "No fue posible cambiar el equipo."); }
  });
  _ctx.container.querySelector("#ven-btn-cambiar-contrato")?.addEventListener("click", async () => {
    try { await cambiarContrato(); } catch (e) { console.error(e); notify(e?.message || "No fue posible cambiar el contrato."); }
  });
  _ctx.container.querySelector("#ven-btn-baja")?.addEventListener("click", async () => {
    try { await darBaja(); } catch (e) { console.error(e); notify(e?.message || "No fue posible dar de baja al vendedor."); }
  });
}

function bindEvents() {
  const zona = _ctx.container.querySelector("#ven-filtro-zona");
  const equipo = _ctx.container.querySelector("#ven-filtro-equipo");
  const nombre = _ctx.container.querySelector("#ven-filtro-nombre");
  const rut = _ctx.container.querySelector("#ven-filtro-rut");

  zona?.addEventListener("change", () => {
    _ctx.filters.idZona = zona.value;
    _ctx.filters.idEquipo = "";
    fillEquipoFilter();
    applyFilters();
  });

  equipo?.addEventListener("change", () => {
    _ctx.filters.idEquipo = equipo.value;
    applyFilters();
  });

  nombre?.addEventListener("input", () => {
    _ctx.filters.nombre = nombre.value;
    applyFilters();
  });

  rut?.addEventListener("input", () => {
    rut.value = onlyRut(rut.value);
    _ctx.filters.rut = rut.value;
    applyFilters();
  });

  _ctx.container.querySelector("#ven-buscar")?.addEventListener("click", applyFilters);

  _ctx.container.querySelector("#ven-limpiar")?.addEventListener("click", () => {
    _ctx.filters = { idZona: "", idEquipo: "", nombre: "", rut: "" };
    zona.value = "";
    nombre.value = "";
    rut.value = "";
    fillEquipoFilter();
    applyFilters();
  });

  _ctx.container.querySelector("#ven-recargar")?.addEventListener("click", async () => {
    try { await loadAll(); } catch (e) { console.error(e); setStatus(e?.message || "No fue posible recargar vendedores.", true); }
  });

  _ctx.container.querySelector("#ven-modal-close")?.addEventListener("click", closeModal);

  _ctx.container.querySelector("#ven-tbody")?.addEventListener("dblclick", (e) => {
    const row = e.target.closest(".ven-row");
    if (!row) return;
    const v = _ctx.vendedoresView.find((item) => String(item.id_vendedor) === String(row.dataset.id));
    if (v) openModal(v);
  });
}

export async function renderVendedor(container) {
  _ctx.container = container;
  container.innerHTML = shell();
  bindEvents();

  try {
    await loadAll();
  } catch (e) {
    console.error("Error cargando módulo vendedor:", e);
    setStatus(e?.message || "No fue posible cargar el módulo vendedor.", true);
  }
}
