import { supabase } from "../../config.js";

let _ctx = {
  container: null,
  mode: "crear", // listado | crear | editar | reset
  selected: null,
  search: "",
  perfilFilter: "todos",
  rows: [],
  embed: {
    enabled: false,
    onlyTipo: null,
    hideListado: false,
    hideReset: false,
    hideEditar: false,
    lockTipo: false,
  }
};

export function setAccesosMode(mode) {
  _ctx.mode = mode;
  if (!_ctx.container) return;
  if ((mode === "editar" || mode === "reset") && !_ctx.selected) {
    _ctx.mode = "listado";
    renderAccesos(_ctx.container, { mode: "listado", message: "Debe seleccionar una cuenta desde Listado." });
    return;
  }
  renderAccesos(_ctx.container, { mode });
}

export async function renderAccesosVendedorEnModal(container, options = {}) {
  _ctx.embed = {
    enabled: true,
    onlyTipo: "vendedor",
    hideListado: true,
    hideReset: true,
    hideEditar: true,
    lockTipo: true,
    ...options
  };

  _ctx.mode = "crear";
  _ctx.selected = { tipoCuenta: "vendedor" };

  await renderAccesos(container, { mode: "crear" });
}

function sortNatural(items, key = "nombre") {
  return [...items].sort((a, b) =>
    String(a?.[key] ?? "").localeCompare(String(b?.[key] ?? ""), "es", {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function onlyRutNumbersAndDv(value) {
  return String(value || "").replace(/[^0-9kK]/g, "");
}

function onlyRutNumbers(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatRutVisual(value) {
  const clean = onlyRutNumbersAndDv(value);
  if (!clean) return "";
  if (clean.length === 1) return clean;

  let body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  let out = "";

  while (body.length > 3) {
    out = "." + body.slice(-3) + out;
    body = body.slice(0, -3);
  }

  out = body + out;
  return `${out}-${dv}`;
}

// =======================================
// VALIDADOR DE RUT BLINDADO (APP VENTAS)
// =======================================

function calculateDv(rut) {
  let suma = 0;
  let multiplo = 2;

  for (let i = rut.length - 1; i >= 0; i--) {
    suma += parseInt(rut.charAt(i), 10) * multiplo;
    multiplo++;
    if (multiplo > 7) multiplo = 2;
  }

  const dv = 11 - (suma % 11);

  if (dv === 11) return "0";
  if (dv === 10) return "K";

  return dv.toString();
}

function isValidRut(rutCompleto) {
  if (!rutCompleto) return false;

  const clean = String(rutCompleto)
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim()
    .toUpperCase();

  if (clean.length < 2) return false;

  const rut = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (!/^\d+$/.test(rut)) return false;

  return calculateDv(rut) === dv;
}

function titleCaseName(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trimStart()
    .replace(/\b([a-záéíóúñü])/g, (m) => m.toUpperCase());
}

function lowerNoSpaces(v) {
  return String(v || "").toLowerCase().replace(/\s+/g, "");
}

function initialPassword(rut) {
  const clean = onlyRutNumbers(rut);
  if (clean.length < 4) return "Habitat----";
  return `Habitat${clean.slice(-4)}`;
}

async function getPerfilId(nombrePerfil) {
  const { data, error } = await supabase
    .from("perfiles")
    .select("id_perfil")
    .eq("perfil", nombrePerfil)
    .limit(1);

  if (error) throw error;
  if (!data?.length) throw new Error(`No se encontró id_perfil para ${nombrePerfil}.`);

  return data[0].id_perfil;
}

async function loadZonas() {
  const { data, error } = await supabase
    .from("zonas")
    .select("id_zona, nombre")
    .order("nombre", { ascending: true });

  if (error) throw error;

  return sortNatural(
    (data || []).map((z) => ({
      id: z.id_zona,
      nombre: z.nombre || "Zona sin nombre",
    }))
  );
}

async function loadEquiposByZona(idZona) {
  const { data: rels, error: relErr } = await supabase
    .from("zona_equipo")
    .select("id_equipo")
    .eq("id_zona", idZona)
    .is("fecha_fin", null);

  if (relErr) throw relErr;

  const ids = (rels || []).map((r) => r.id_equipo).filter(Boolean);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("equipos")
    .select("id_equipo, nombre_equipo")
    .in("id_equipo", ids)
    .order("nombre_equipo", { ascending: true });

  if (error) throw error;

  return sortNatural(
    (data || []).map((e) => ({
      id: e.id_equipo,
      nombre: e.nombre_equipo || "Equipo sin nombre",
    }))
  );
}

async function loadContratosVigentes() {
  const { data, error } = await supabase.rpc("get_contratos_vigentes");

  if (error) throw error;

  return sortNatural(
    (data || [])
      .map((c) => ({
        descripcion: c.descripcion || "",
      }))
      .filter((c) => c.descripcion),
    "descripcion"
  );
}

async function getContratoIdByDescripcion(descripcion) {
  const desc = String(descripcion || "").trim();
  if (!desc) return null;

  const { data, error } = await supabase
    .from("contratos")
    .select("id_contrato, descripcion")
    .eq("descripcion", desc)
    .eq("vigente", true)
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id_contrato ?? null;
}

async function validateProfileUniqueness({ rut, email, usuario, currentId = null }) {
  const rutNum = onlyRutNumbers(rut);
  const emailLc = String(email || "").trim().toLowerCase();
  const userLc = String(usuario || "").trim().toLowerCase();

  const { data: rutRows, error: rutErr } = await supabase
    .from("profiles")
    .select("id, fecha_fin")
    .eq("rut", rutNum);

  if (rutErr) throw rutErr;

  const currentIdStr = currentId ? String(currentId) : null;
  const othersRut = (rutRows || []).filter((r) => String(r.id) !== currentIdStr);
  const activeRut = othersRut.find((r) => !r.fecha_fin);

  if (activeRut) throw new Error("El RUT ya existe con registro vigente en profiles.");

  const { data: emailRows, error: emailErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", emailLc)
    .limit(5);

  if (emailErr) throw emailErr;
  if ((emailRows || []).some((r) => String(r.id) !== currentIdStr)) {
    throw new Error("El email ya existe previamente.");
  }

  const { data: userRows, error: userErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("usuario", userLc)
    .limit(5);

  if (userErr) throw userErr;
  if ((userRows || []).some((r) => String(r.id) !== currentIdStr)) {
    throw new Error("El nombre de usuario ya existe previamente.");
  }
}

async function loadListado() {
  const { data: profilesRows, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, usuario, nombre, rut, dv, email, activo, genero, fecha_inicio, fecha_fin")
    .order("nombre", { ascending: true });

  if (profilesErr) throw profilesErr;

  const { data: rolesRows, error: rolesErr } = await supabase
    .from("user_roles")
    .select("user_id, id_perfil, fecha_fin");

  if (rolesErr) throw rolesErr;

  const { data: perfilesRows, error: perfilesErr } = await supabase
    .from("perfiles")
    .select("id_perfil, perfil");

  if (perfilesErr) throw perfilesErr;

  const perfilById = new Map((perfilesRows || []).map((p) => [String(p.id_perfil), p.perfil]));
  const perfilByUser = new Map();

  (rolesRows || []).forEach((r) => {
    if (!r || !r.user_id || r.fecha_fin) return;
    if (!perfilByUser.has(String(r.user_id))) {
      perfilByUser.set(String(r.user_id), perfilById.get(String(r.id_perfil)) || "sin_perfil");
    }
  });

  _ctx.rows = sortNatural(
    (profilesRows || []).map((r) => ({
      ...r,
      perfil: perfilByUser.get(String(r.id)) || "sin_perfil",
    })),
    "nombre"
  );

  return _ctx.rows;
}

function styles() {
  return `
  <style>
    .acc-shell{display:grid;gap:16px}
    .acc-card{background:#fff;border:1px solid #dbe7f3;border-radius:20px;box-shadow:0 8px 22px rgba(7,46,94,.06);padding:24px}
    .acc-title{margin:0 0 6px 0;font-size:18px;font-weight:800;color:#0b3f79}
    .acc-sub{margin:0;color:#5b6b7c;font-size:14px}
    .acc-tools{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
    .acc-tool{min-height:42px;padding:0 16px;border-radius:999px;border:1px solid #bfd3e8;background:#fff;color:#0b3f79;font-weight:800;cursor:pointer}
    .acc-tool.active{background:#eaf3ff;border-color:#84b8ff}
    .acc-tool[disabled]{opacity:.45;cursor:not-allowed}
    .acc-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(300px,1fr);gap:20px;align-items:start}
    .acc-form{display:grid;gap:18px}
    .acc-block{border:1px solid #dbe7f3;border-radius:16px;padding:18px;background:#fbfdff}
    .acc-block h3{margin:0 0 14px 0;font-size:15px;color:#0b3f79}
    .acc-radio-group{display:flex;flex-wrap:wrap;gap:12px 18px}
    .acc-radio{display:flex;align-items:center;gap:8px;font-weight:600;color:#203040}
    .acc-radio input{accent-color:#0b56a5}
    .acc-radio--disabled{opacity:.45}
    .acc-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px}
    .acc-field{display:flex;flex-direction:column;gap:6px}
    .acc-field--full{grid-column:1/-1}
    .acc-label{font-size:13px;font-weight:700;color:#33485c}
    .acc-input,.acc-select{width:100%;min-height:42px;border:1px solid #bfd3e8;border-radius:12px;padding:10px 12px;font-size:14px;color:#1e2f3f;background:#fff;box-sizing:border-box}
    .acc-input:focus,.acc-select:focus{outline:none;border-color:#0b56a5;box-shadow:0 0 0 3px rgba(11,86,165,.12)}
    .acc-input[readonly],.acc-input[disabled],.acc-select[disabled]{background:#f2f6fa}
    .acc-check{display:flex;align-items:center;gap:10px;font-weight:600;color:#203040;padding-top:6px}
    .acc-check input{accent-color:#0b56a5}
    .acc-note{border:1px solid #cfe0f1;background:#f7fbff;border-radius:16px;padding:18px}
    .acc-note h3{margin:0 0 12px 0;font-size:15px;color:#0b3f79}
    .acc-note p{margin:0 0 10px 0;line-height:1.45;color:#304457}
    .acc-password-preview{display:inline-block;margin-top:6px;padding:10px 12px;border-radius:12px;background:#eef5fc;border:1px solid #d6e4f3;font-weight:800;color:#0b3f79}
    .acc-help{font-size:13px;color:#5b6b7c}
    .acc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
    .acc-btn{min-height:42px;padding:0 16px;border-radius:12px;border:1px solid #0b56a5;background:#0b56a5;color:#fff;font-weight:800;cursor:pointer}
    .acc-btn--secondary{background:#fff;color:#0b56a5}
    .acc-btn[disabled]{opacity:.45;cursor:not-allowed}
    #acc-copiar{min-width:210px;height:auto;white-space:normal;line-height:1.15;padding:10px 14px;text-align:center;display:flex;align-items:center;justify-content:center}
    .acc-status{min-height:24px;font-size:13px;font-weight:700;color:#1f6f43}
    .acc-status--error{color:#b42318}
    .acc-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #d6e4f3;border-radius:12px;background:#eef5fc;color:#0b3f79;font-weight:700}
    .acc-warning{margin-top:8px;padding:12px;border:1px solid #f3d7a2;background:#fff8e8;border-radius:12px;color:#8a5b00;font-size:13px}
    .acc-hidden{display:none!important}
    .acc-search{display:flex;gap:10px;align-items:center;margin-bottom:14px}
    .acc-table-wrap{border:1px solid #dbe7f3;border-radius:16px;overflow:hidden;background:#fff}
    .acc-table{width:100%;border-collapse:collapse}
    .acc-table th,.acc-table td{padding:12px 14px;border-bottom:1px solid #eef3f8;text-align:left;font-size:14px}
    .acc-table th{background:#f7fbff;color:#38516a;font-size:13px}
    .acc-row{cursor:pointer}
    .acc-row:hover{background:#f9fbfe}
    .acc-row.selected{background:#eaf3ff}
    .acc-pill{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}
    .acc-pill.ok{background:#eafaf1;color:#1f6f43}
    .acc-pill.off{background:#fff1f1;color:#b42318}
    @media (max-width:1100px){.acc-grid{grid-template-columns:1fr}}
    @media (max-width:700px){.acc-fields{grid-template-columns:1fr}}
  </style>`;
}

function renderListadoView(message = "") {
  const rows = _ctx.rows.filter((r) => {
    const q = _ctx.search.trim().toLowerCase();
    const pasaBusqueda = !q || [r.nombre, r.email, r.usuario, r.rut, r.dv, r.perfil].join(" ").toLowerCase().includes(q);
    const pasaPerfil = _ctx.perfilFilter === "todos" || r.perfil === _ctx.perfilFilter;
    return pasaBusqueda && pasaPerfil;
  });

  return `
    ${styles()}
    <div class="acc-shell">
      <section class="acc-card">
        <h2 class="acc-title">Usuarios y cuentas</h2>
        <p class="acc-sub">Seleccione una cuenta desde el listado para habilitar Editar cuenta o Reset password.</p>

        <div class="acc-search">
          <input id="acc-busqueda" class="acc-input" style="max-width:320px" placeholder="Buscar por nombre, usuario, rut o email" value="${_ctx.search}">
          <button id="acc-ir-editar" class="acc-tool" ${_ctx.selected ? "" : "disabled"}>Editar cuenta</button>
          <button id="acc-ir-reset" class="acc-tool" ${_ctx.selected ? "" : "disabled"}>Reset password</button>
        </div>

        <div class="acc-block" style="margin-bottom:14px;padding:14px 18px">
          <h3 style="margin-bottom:10px">Filtro por perfil</h3>
          <div class="acc-radio-group">
            <label class="acc-radio"><input type="radio" name="perfilFiltro" value="todos" ${_ctx.perfilFilter==="todos"?"checked":""}> Todos</label>
            <label class="acc-radio"><input type="radio" name="perfilFiltro" value="vendedor" ${_ctx.perfilFilter==="vendedor"?"checked":""}> Vendedores</label>
            <label class="acc-radio"><input type="radio" name="perfilFiltro" value="supervisor" ${_ctx.perfilFilter==="supervisor"?"checked":""}> Supervisor</label>
            <label class="acc-radio"><input type="radio" name="perfilFiltro" value="zonal" ${_ctx.perfilFilter==="zonal"?"checked":""}> Zonal</label>
            <label class="acc-radio"><input type="radio" name="perfilFiltro" value="subgerente" ${_ctx.perfilFilter==="subgerente"?"checked":""}> Subgerente</label>
            <label class="acc-radio"><input type="radio" name="perfilFiltro" value="admin" ${_ctx.perfilFilter==="admin"?"checked":""}> Admin</label>
          </div>
        </div>

        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead>
              <tr>
                <th>Nombre</th><th>Usuario</th><th>Email</th><th>Perfil</th><th>RUT</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((r) => `
                <tr class="acc-row ${_ctx.selected && String(_ctx.selected.id) === String(r.id) ? "selected" : ""}" data-id="${r.id}">
                  <td>${r.nombre || "-"}</td>
                  <td>${r.usuario || "-"}</td>
                  <td>${r.email || "-"}</td>
                  <td>${r.perfil || "-"}</td>
                  <td>${r.rut || ""}${r.dv ? "-" + r.dv : ""}</td>
                  <td>${r.activo ? '<span class="acc-pill ok">Activo</span>' : '<span class="acc-pill off">Inactivo</span>'}</td>
                </tr>`).join("") : `<tr><td colspan="6">No hay registros.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div id="acc-status" class="acc-status ${message ? "" : "acc-hidden"}">${message || ""}</div>
      </section>
    </div>
  `;
}

function radioMarkup(tipoActual) {
  const onlyVendedor = _ctx.embed?.enabled && _ctx.embed?.onlyTipo === "vendedor";
  const lockTipo = !!_ctx.embed?.lockTipo;

  if (onlyVendedor) {
    return `
      <div class="acc-radio-group">
        <label class="acc-radio">
          <input type="radio" name="tipoCuenta" value="vendedor" checked ${lockTipo ? "disabled" : ""}>
          Vendedor
        </label>
        <label class="acc-radio acc-radio--disabled">
          <input type="radio" name="tipoCuenta" value="supervisor" disabled>
          Supervisor
        </label>
        <label class="acc-radio acc-radio--disabled">
          <input type="radio" name="tipoCuenta" value="zonal" disabled>
          Zonal
        </label>
        <label class="acc-radio acc-radio--disabled">
          <input type="radio" name="tipoCuenta" value="admin" disabled>
          Admin
        </label>
        <label class="acc-radio acc-radio--disabled">
          <input type="radio" name="tipoCuenta" value="subgerente" disabled>
          Subgerente
        </label>
      </div>`;
  }

  return `
    <div class="acc-radio-group">
      <label class="acc-radio"><input type="radio" name="tipoCuenta" value="vendedor" ${tipoActual === "vendedor" ? "checked" : ""}> Vendedor</label>
      <label class="acc-radio"><input type="radio" name="tipoCuenta" value="supervisor" ${tipoActual === "supervisor" ? "checked" : ""}> Supervisor</label>
      <label class="acc-radio"><input type="radio" name="tipoCuenta" value="zonal" ${tipoActual === "zonal" ? "checked" : ""}> Zonal</label>
      <label class="acc-radio"><input type="radio" name="tipoCuenta" value="admin" ${tipoActual === "admin" ? "checked" : ""}> Admin</label>
      <label class="acc-radio acc-radio--disabled"><input type="radio" name="tipoCuenta" value="subgerente" disabled> Subgerente</label>
    </div>`;
}

function formView(mode, statusText = "", isError = false) {
  const editing = mode === "editar";
  const reset = mode === "reset";
  const selected = _ctx.selected || {};
  const tipo = (_ctx.embed?.onlyTipo || selected.tipoCuenta || "vendedor");
  const title = mode === "crear" ? "Crear nueva cuenta" : mode === "editar" ? "Editar cuenta" : "Reset password";
  const subtitle = mode === "crear"
    ? "Módulo Accesos. Cree cuentas para Vendedor, Supervisor, Zonal o Admin."
    : mode === "editar"
      ? "Edite una cuenta existente. El email no puede modificarse."
      : "Reset de contraseña disponible solo para la cuenta seleccionada desde Listado.";

  const showZona = tipo !== "admin";
  const showEquipo = tipo !== "admin" && tipo !== "zonal";
  const showFecha = tipo !== "admin";

  return `
    ${styles()}
    <div class="acc-shell">
      <section class="acc-card">
        ${mode === "listado" ? `
        <div class="acc-tools">
          <button class="acc-tool active" id="acc-tab-listado">Listado</button>
          <button class="acc-tool" id="acc-tab-editar" ${_ctx.selected ? "" : "disabled"}>Editar cuenta</button>
          <button class="acc-tool" id="acc-tab-reset" ${_ctx.selected ? "" : "disabled"}>Reset password</button>
        </div>
        ` : ``}

        <div class="acc-grid">
          <form id="acc-form" class="acc-form" autocomplete="off">
            <div>
              <h2 class="acc-title">${title}</h2>
              <p class="acc-sub">${subtitle}</p>
            </div>

            <div class="acc-block ${reset ? "acc-hidden" : ""}">
              <h3>Tipo de cuenta</h3>
              ${radioMarkup(tipo)}
            </div>

            <div class="acc-block ${reset ? "acc-hidden" : ""}">
              <h3>Datos base</h3>
              <div class="acc-fields">
                <div class="acc-field acc-field--full">
                  <label class="acc-label">Nombre completo</label>
                  <input class="acc-input" id="acc-nombre" value="${selected.nombre || ""}" placeholder="Nombre y apellido">
                </div>

                <div class="acc-field">
                  <label class="acc-label">RUT</label>
                  <input class="acc-input" id="acc-rut" value="${selected.rut ? `${selected.rut}-${selected.dv || ""}` : ""}" placeholder="12.345.678-9">
                </div>

                <div class="acc-field">
                  <label class="acc-label">Género</label>
                  <select class="acc-select" id="acc-genero">
                    <option value="">Seleccione</option>
                    <option value="F" ${selected.genero === "F" ? "selected" : ""}>F</option>
                    <option value="M" ${selected.genero === "M" ? "selected" : ""}>M</option>
                  </select>
                </div>

                <div class="acc-field">
                  <label class="acc-label">Email</label>
                  <input class="acc-input" id="acc-email" value="${selected.email || ""}" ${editing ? "disabled" : ""} placeholder="usuario@empresa.cl">
                </div>

                <div class="acc-field">
                  <label class="acc-label">Nombre de usuario</label>
                  <input class="acc-input" id="acc-username" value="${selected.usuario || ""}" placeholder="usuario">
                </div>

                <div class="acc-field">
                  <label class="acc-label">Estado</label>
                  <div class="acc-fields" style="grid-template-columns:1fr 1fr;gap:10px">
                    <select class="acc-select" id="acc-estado">
                      <option value="activo" ${selected.activo !== false ? "selected" : ""}>Activo</option>
                      <option value="inactivo" ${selected.activo === false ? "selected" : ""}>Inactivo</option>
                    </select>
                    <div id="acc-fecha-fin-wrap" class="${selected.activo === false ? "" : "acc-hidden"}">
                      <label class="acc-label">Fecha de termino</label>
                      <input class="acc-input" id="acc-fecha-fin" type="date" value="${selected.fecha_fin ? String(selected.fecha_fin).slice(0, 10) : ""}">
                    </div>
                  </div>
                </div>

                <label class="acc-check acc-field--full">
                  <input type="checkbox" id="acc-forzar" ${selected.must_change_password === false ? "" : "checked"}>
                  Forzar cambio de contraseña en primer ingreso
                </label>
              </div>
            </div>

            <div class="acc-block ${reset || (!showZona && !showEquipo && !showFecha) ? "acc-hidden" : ""}">
              <h3 id="acc-datos-especificos-title">${
                tipo === "supervisor" ? "Datos del supervisor" :
                tipo === "zonal" ? "Datos del zonal" :
                tipo === "admin" ? "Datos del admin" : "Datos del vendedor"
              }</h3>

              <div class="acc-fields">
                <div class="acc-field ${showZona ? "" : "acc-hidden"}" id="acc-zona-field">
                  <label class="acc-label">Zona</label>
                  <select class="acc-select" id="acc-zona"><option value="">Cargando zonas...</option></select>
                </div>

                <div class="acc-field ${showEquipo ? "" : "acc-hidden"}" id="acc-equipo-field">
                  <label class="acc-label">Equipo</label>
                  <select class="acc-select" id="acc-equipo" disabled><option value="">Seleccione una zona primero</option></select>
                </div>

                <div class="acc-field ${showFecha ? "" : "acc-hidden"}" id="acc-fecha-field">
                  <label class="acc-label">${tipo === "vendedor" ? "Fecha de ingreso" : "Fecha de inicio"}</label>
                  <input class="acc-input" id="acc-fecha-inicio" type="date" value="${selected.fecha_inicio ? String(selected.fecha_inicio).slice(0, 10) : ""}">
                </div>
                <div class="acc-field ${tipo === "vendedor" ? "" : "acc-hidden"}" id="acc-contrato-field">
                  <label class="acc-label">Contrato</label>
                  <select class="acc-select" id="acc-contrato"><option value="">Cargando contratos...</option></select>
                </div>

                <div class="acc-field ${tipo === "vendedor" ? "" : "acc-hidden"}" id="acc-fecha-contrato-field">
                  <label class="acc-label">Fecha inicio contrato</label>
                  <input class="acc-input" id="acc-fecha-inicio-contrato" type="date" value="${selected.fecha_inicio_contrato ? String(selected.fecha_inicio_contrato).slice(0, 10) : (selected.fecha_inicio ? String(selected.fecha_inicio).slice(0, 10) : "")}">
                </div>
              </div>

              <div id="acc-warning" class="acc-warning acc-hidden"></div>

              <label id="acc-reemplazar-wrap" class="acc-check acc-hidden">
                <input type="checkbox" id="acc-reemplazar">
                <span id="acc-reemplazar-text">Reemplazar principal vigente</span>
              </label>
            </div>

            <div class="acc-block ${reset ? "" : "acc-hidden"}">
              <h3>Reset password</h3>
              <p>La nueva contraseña temporal se calculará con la regla definida por el sistema:</p>
              <div class="acc-password-preview">Password inicial: ${initialPassword(selected.rut ? `${selected.rut}-${selected.dv || ""}` : "")}</div>
              <p class="acc-help">El usuario deberá cambiar su contraseña en el primer ingreso.</p>
            </div>

            <div class="acc-actions">
              <button type="button" class="acc-btn" id="acc-guardar">${mode === "editar" ? "Actualizar" : mode === "reset" ? "Preparar reset" : "Guardar"}</button>
              <button type="button" class="acc-btn acc-btn--secondary" id="acc-copiar" disabled>Copiar correo de acceso</button>
              <button type="button" class="acc-btn acc-btn--secondary" id="acc-cancelar">Cancelar</button>
            </div>

            <div id="acc-status" class="acc-status ${statusText ? (isError ? "acc-status--error" : "") : ""}">${statusText || ""}</div>
          </form>

          <aside class="acc-note">
            <h3>Contraseña inicial</h3>
            <p>La contraseña inicial del usuario se genera automáticamente con la siguiente regla:</p>
            <p><strong>Habitat + últimos 4 dígitos del RUT</strong></p>
            <div id="acc-password-preview" class="acc-password-preview">Password inicial: ${initialPassword(selected.rut ? `${selected.rut}-${selected.dv || ""}` : "")}</div>
            <p class="acc-help">El usuario deberá cambiar su contraseña en el primer ingreso.</p>
            <p class="acc-help">El botón <strong>Copiar correo de acceso</strong> se habilita solo cuando el guardado termina correctamente.</p>
          </aside>
        </div>
      </section>
    </div>
  `.replace("false", "false");
}

function attachListadoEvents(container) {
  const search = container.querySelector("#acc-busqueda");
  const rows = container.querySelectorAll(".acc-row");
  const btnEditar = container.querySelector("#acc-ir-editar");
  const btnReset = container.querySelector("#acc-ir-reset");
  const radiosFiltro = container.querySelectorAll('input[name="perfilFiltro"]');

  search?.addEventListener("input", (e) => {
    _ctx.search = e.target.value;
    renderAccesos(_ctx.container, { mode: "listado" });
  });

  rows.forEach((row) => {
    row.addEventListener("click", () => {
      const item = _ctx.rows.find((r) => String(r.id) === row.dataset.id);
      _ctx.selected = item || null;
      renderAccesos(_ctx.container, { mode: "listado", message: `Cuenta seleccionada: ${item?.nombre || "-"}` });
    });
  });

  radiosFiltro.forEach((radio) => {
    radio.addEventListener("change", () => {
      _ctx.perfilFilter = radio.value;
      _ctx.selected = null;
      renderAccesos(_ctx.container, { mode: "listado" });
    });
  });

  btnEditar?.addEventListener("click", () => setAccesosMode("editar"));
  btnReset?.addEventListener("click", () => setAccesosMode("reset"));
}

async function maybeLoadCombos(container) {
  const tipo = (container.querySelector('input[name="tipoCuenta"]:checked')?.value) || "vendedor";

  if (tipo === "vendedor") {
    await fillContratos(container);
  }

  if (tipo === "admin") return;

  const zonaSel = container.querySelector("#acc-zona");
  if (!zonaSel) return;

  const zonas = await loadZonas();
  zonaSel.innerHTML = `<option value="">Seleccione una zona</option>` + zonas.map((z) => `<option value="${z.id}">${z.nombre}</option>`).join("");

  if (_ctx.selected?.idZona) {
    zonaSel.value = _ctx.selected.idZona;
  }

  if (tipo !== "zonal" && zonaSel.value) {
    await fillEquipos(container, zonaSel.value);
  }
}

async function fillContratos(container) {
  const contratoSel = container.querySelector("#acc-contrato");
  if (!contratoSel) return;

  const contratos = await loadContratosVigentes();

  contratoSel.innerHTML = `<option value="">Seleccione un contrato</option>` +
    contratos.map((c) => `<option value="${c.descripcion}">${c.descripcion}</option>`).join("");

  if (_ctx.selected?.contrato) {
    contratoSel.value = _ctx.selected.contrato;
  }
}

async function fillEquipos(container, idZona) {
  const equipoSel = container.querySelector("#acc-equipo");
  if (!equipoSel) return;

  const equipos = await loadEquiposByZona(idZona);
  equipoSel.innerHTML = `<option value="">Seleccione un equipo</option>` + equipos.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join("");
  equipoSel.disabled = !equipos.length;

  if (_ctx.selected?.idEquipo) {
    equipoSel.value = _ctx.selected.idEquipo;
  }
}

async function checkPrincipal(container) {
  const tipo = container.querySelector('input[name="tipoCuenta"]:checked')?.value;
  const warning = container.querySelector("#acc-warning");
  const wrap = container.querySelector("#acc-reemplazar-wrap");
  const txt = container.querySelector("#acc-reemplazar-text");

  if (!warning || !wrap) return;

  warning.classList.add("acc-hidden");
  warning.textContent = "";
  wrap.classList.add("acc-hidden");

  if (tipo === "supervisor") {
    const idEquipo = container.querySelector("#acc-equipo")?.value;
    if (!idEquipo) return;

    const { data, error } = await supabase
      .from("equipo_supervisor")
      .select("id_supervisor")
      .eq("id_equipo", idEquipo)
      .eq("es_principal", true)
      .is("fecha_fin", null)
      .limit(1);

    if (error) return;

    if (data?.length) {
      _ctx.principalVigente = data[0];
      let nombre = "otro usuario";

      const { data: prof } = await supabase
        .from("profiles")
        .select("nombre")
        .eq("id", data[0].id_supervisor)
        .limit(1);

      if (prof?.length && prof[0].nombre) nombre = prof[0].nombre;

      warning.textContent = `El equipo ya tiene como supervisor principal a ${nombre}.`;
      txt.textContent = "Reemplazar supervisor principal vigente";
      warning.classList.remove("acc-hidden");
      wrap.classList.remove("acc-hidden");
    }
  }

  if (tipo === "zonal") {
    const idZona = container.querySelector("#acc-zona")?.value;
    if (!idZona) return;

    const { data, error } = await supabase
      .from("zona_zonal")
      .select("id_zonal")
      .eq("id_zona", idZona)
      .eq("es_principal", true)
      .is("fecha_fin", null)
      .limit(1);

    if (error) return;

    if (data?.length) {
      _ctx.principalVigente = data[0];
      let nombre = "otro usuario";

      const { data: prof } = await supabase
        .from("profiles")
        .select("nombre")
        .eq("id", data[0].id_zonal)
        .limit(1);

      if (prof?.length && prof[0].nombre) nombre = prof[0].nombre;

      warning.textContent = `La zona ya tiene como zonal principal a ${nombre}.`;
      txt.textContent = "Reemplazar zonal principal vigente";
      warning.classList.remove("acc-hidden");
      wrap.classList.remove("acc-hidden");
    }
  }
}

async function prepareCreatePayload(container) {
  const tipo = container.querySelector('input[name="tipoCuenta"]:checked')?.value || "vendedor";
  const nombre = titleCaseName(container.querySelector("#acc-nombre").value);
  const rutVisual = formatRutVisual(container.querySelector("#acc-rut").value);
  const rutLimpio = onlyRutNumbersAndDv(rutVisual).toUpperCase();
  const rut = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);
  const genero = container.querySelector("#acc-genero").value;
  const email = String(container.querySelector("#acc-email").value || "").trim().toLowerCase();
  const usuario = lowerNoSpaces(container.querySelector("#acc-username").value);
  const estado = container.querySelector("#acc-estado").value;
  const fechaFin = container.querySelector("#acc-fecha-fin")?.value || null;
  const fechaInicio = container.querySelector("#acc-fecha-inicio")?.value || null;
  const contrato = container.querySelector("#acc-contrato")?.value || null;
  const fechaInicioContrato = container.querySelector("#acc-fecha-inicio-contrato")?.value || null;
  const idZona = container.querySelector("#acc-zona")?.value || null;
  const idEquipo = container.querySelector("#acc-equipo")?.value || null;

  if (!nombre) throw new Error("Ingrese el nombre completo.");
  if (!isValidRut(rutVisual)) throw new Error("Ingrese un RUT válido.");
  if (!genero) throw new Error("Seleccione el género.");
  if (!email) throw new Error("Ingrese el email.");
  if (!usuario) throw new Error("Ingrese el nombre de usuario.");

  if (tipo !== "admin") {
    if (!idZona) throw new Error("Seleccione la zona.");
    if (tipo !== "zonal" && !idEquipo) throw new Error("Seleccione el equipo.");
    if (!fechaInicio) throw new Error("Seleccione la fecha.");

    if (tipo === "vendedor") {
      if (!contrato) throw new Error("Seleccione el contrato del vendedor.");
      if (!fechaInicioContrato) throw new Error("Seleccione la fecha de inicio del contrato.");
    }

    const today = new Date().toISOString().slice(0, 10);
    if (fechaInicio > today) throw new Error("La fecha no puede ser futura.");
    if (tipo === "vendedor" && fechaInicioContrato > today) {
      throw new Error("La fecha de inicio del contrato no puede ser futura.");
    }
  }

  if (estado === "inactivo" && !fechaFin) {
    throw new Error("Ingrese la fecha de termino para dejar la cuenta inactiva.");
  }

  await validateProfileUniqueness({
    rut: rutVisual,
    email,
    usuario,
    currentId: _ctx.mode === "editar" ? _ctx.selected?.id : null
  });

  const profile = {
    usuario,
    nombre,
    rut,
    dv,
    email,
    activo: estado === "activo",
    genero,
    fecha_inicio: tipo === "admin" ? new Date().toISOString() : fechaInicio,
    fecha_fin: estado === "inactivo" ? fechaFin : null,
    must_change_password: !!container.querySelector("#acc-forzar").checked,
  };

  const payload = {
    tipo,
    nombre,
    rut,
    dv,
    genero,
    email,
    username: usuario,
    passwordTemporal: initialPassword(rutVisual),
    profile,
    user_role: {
      id_perfil: await getPerfilId(tipo),
      activo: true,
      fecha_inicio: tipo === "admin" ? new Date().toISOString().slice(0, 10) : fechaInicio,
      fecha_fin: null,
    }
  };

  if (tipo === "vendedor") {
    const idContrato = await getContratoIdByDescripcion(contrato);

    if (!idContrato) {
      throw new Error("El contrato seleccionado no existe o no está vigente.");
    }

    payload.equipo_vendedor = {
      id_equipo: idEquipo,
      fecha_inicio: fechaInicio,
      fecha_fin: null,
      estado: true,
    };

    payload.vendedor_contrato = {
      id_contrato: idContrato,
      contrato,
      fecha_inicio: fechaInicioContrato,
      fecha_fin: null,
    };
  }

  if (tipo === "supervisor") {
    payload.equipo_supervisor = {
      id_equipo: idEquipo,
      es_principal: true,
      fecha_inicio: fechaInicio,
      fecha_fin: null,
      reemplazar_principal_vigente: !!container.querySelector("#acc-reemplazar")?.checked,
      id_supervisor_vigente: _ctx.principalVigente?.id_supervisor || null,
    };
  }

  if (tipo === "zonal") {
    payload.zona_zonal = {
      id_zona: idZona,
      es_principal: true,
      fecha_inicio: fechaInicio,
      fecha_fin: null,
      reemplazar_principal_vigente: !!container.querySelector("#acc-reemplazar")?.checked,
      id_zonal_vigente: _ctx.principalVigente?.id_zonal || null,
    };
  }

  return payload;
}

async function handleSaveCreateOrEdit(container) {
  try {
    const payload = await prepareCreatePayload(container);
    _ctx.lastPayload = payload;

    if (_ctx.mode === "editar") {
      const { error } = await supabase
        .from("profiles")
        .update({
          nombre: payload.profile.nombre,
          genero: payload.profile.genero,
          activo: payload.profile.activo,
          fecha_fin: payload.profile.fecha_fin,
          must_change_password: payload.profile.must_change_password,
        })
        .eq("id", _ctx.selected.id);

      if (error) throw error;

      renderAccesos(_ctx.container, {
        mode: "editar",
        message: "Cuenta actualizada correctamente."
      });
      return;
    }

    let data = null;
    let error = null;

    if (payload.tipo === "vendedor") {
      ({ data, error } = await supabase.rpc("admin_crear_vendedor", {
        p_nombre: payload.profile.nombre,
        p_usuario: payload.profile.usuario,
        p_rut: payload.profile.rut,
        p_dv: payload.profile.dv,
        p_email: payload.profile.email,
        p_activo: payload.profile.activo,
        p_genero: payload.profile.genero,
        p_fecha_inicio: payload.user_role.fecha_inicio,
        p_fecha_fin: payload.profile.fecha_fin,
        p_must_change_password: payload.profile.must_change_password,
        p_id_perfil: payload.user_role.id_perfil,
        p_id_equipo: payload.equipo_vendedor.id_equipo,
        p_id_contrato: payload.vendedor_contrato.id_contrato,
        p_fecha_inicio_contrato: payload.vendedor_contrato.fecha_inicio
      }));
    }

    if (payload.tipo === "supervisor") {
      ({ data, error } = await supabase.rpc("admin_crear_supervisor", {
        p_nombre: payload.profile.nombre,
        p_usuario: payload.profile.usuario,
        p_rut: payload.profile.rut,
        p_dv: payload.profile.dv,
        p_email: payload.profile.email,
        p_activo: payload.profile.activo,
        p_genero: payload.profile.genero,
        p_fecha_inicio: payload.user_role.fecha_inicio,
        p_fecha_fin: payload.profile.fecha_fin,
        p_must_change_password: payload.profile.must_change_password,
        p_id_perfil: payload.user_role.id_perfil,
        p_id_equipo: payload.equipo_supervisor.id_equipo,
        p_reemplazar_principal_vigente: payload.equipo_supervisor.reemplazar_principal_vigente,
        p_id_supervisor_vigente: payload.equipo_supervisor.id_supervisor_vigente
      }));
    }

    if (payload.tipo === "zonal") {
      ({ data, error } = await supabase.rpc("admin_crear_zonal", {
        p_nombre: payload.profile.nombre,
        p_usuario: payload.profile.usuario,
        p_rut: payload.profile.rut,
        p_dv: payload.profile.dv,
        p_email: payload.profile.email,
        p_activo: payload.profile.activo,
        p_genero: payload.profile.genero,
        p_fecha_inicio: payload.user_role.fecha_inicio,
        p_fecha_fin: payload.profile.fecha_fin,
        p_must_change_password: payload.profile.must_change_password,
        p_id_perfil: payload.user_role.id_perfil,
        p_id_zona: payload.zona_zonal.id_zona,
        p_reemplazar_principal_vigente: payload.zona_zonal.reemplazar_principal_vigente,
        p_id_zonal_vigente: payload.zona_zonal.id_zonal_vigente
      }));
    }

    if (payload.tipo === "admin") {
      ({ data, error } = await supabase.rpc("admin_crear_admin", {
        p_nombre: payload.profile.nombre,
        p_usuario: payload.profile.usuario,
        p_rut: payload.profile.rut,
        p_dv: payload.profile.dv,
        p_email: payload.profile.email,
        p_activo: payload.profile.activo,
        p_genero: payload.profile.genero,
        p_must_change_password: payload.profile.must_change_password,
        p_id_perfil: payload.user_role.id_perfil
      }));
    }

    if (error) {
      console.error("❌ Error RPC:", error);
      throw error;
    }

    if (!data?.ok) {
      throw new Error(data?.message || "No fue posible crear la cuenta.");
    }

    const copiar = container.querySelector("#acc-copiar");
    if (copiar) copiar.disabled = false;

    const status = container.querySelector("#acc-status");
    status.textContent = data.message || `Cuenta de tipo ${payload.tipo} creada correctamente.`;
    status.classList.remove("acc-status--error");

    await loadListado();
  } catch (e) {
    console.error("❌ handleSaveCreateOrEdit:", e);

    const status = container.querySelector("#acc-status");
    status.textContent =
      e?.message ||
      e?.error_description ||
      "No fue posible procesar la solicitud.";
    status.classList.add("acc-status--error");
  }
}

function attachFormEvents(container) {
  container.querySelector("#acc-tab-listado")?.addEventListener("click", () => setAccesosMode("listado"));
  container.querySelector("#acc-tab-crear")?.addEventListener("click", () => setAccesosMode("crear"));
  container.querySelector("#acc-tab-editar")?.addEventListener("click", () => setAccesosMode("editar"));
  container.querySelector("#acc-tab-reset")?.addEventListener("click", () => setAccesosMode("reset"));

  const nombre = container.querySelector("#acc-nombre");
  const rut = container.querySelector("#acc-rut");
  const email = container.querySelector("#acc-email");
  const user = container.querySelector("#acc-username");
  const estado = container.querySelector("#acc-estado");
  const fechaFinWrap = container.querySelector("#acc-fecha-fin-wrap");
  const radios = container.querySelectorAll('input[name="tipoCuenta"]');
  const zona = container.querySelector("#acc-zona");
  const equipo = container.querySelector("#acc-equipo");
  const fechaInicio = container.querySelector("#acc-fecha-inicio");
  const fechaInicioContrato = container.querySelector("#acc-fecha-inicio-contrato");
  const copiar = container.querySelector("#acc-copiar");
  const guardar = container.querySelector("#acc-guardar");
  const cancelar = container.querySelector("#acc-cancelar");
  const preview = container.querySelector("#acc-password-preview");

  nombre?.addEventListener("input", () => {
    nombre.value = titleCaseName(nombre.value);
  });

  rut?.addEventListener("input", () => {
    rut.value = formatRutVisual(rut.value);
    if (preview) preview.textContent = `Password inicial: ${initialPassword(rut.value)}`;
  });

  email?.addEventListener("input", () => {
    email.value = String(email.value).toLowerCase();
  });

  user?.addEventListener("input", () => {
    user.value = lowerNoSpaces(user.value);
  });

  estado?.addEventListener("change", () => {
    if (fechaFinWrap) fechaFinWrap.classList.toggle("acc-hidden", estado.value !== "inactivo");
  });

  if (!_ctx.embed?.lockTipo) {
    radios.forEach((r) => r.addEventListener("change", async () => {
      const nuevo = container.querySelector('input[name="tipoCuenta"]:checked')?.value || "vendedor";
      _ctx.selected = { ...(_ctx.selected || {}), tipoCuenta: nuevo };
      renderAccesos(_ctx.container, { mode: _ctx.mode });
    }));
  }

  zona?.addEventListener("change", async () => {
    if (_ctx.mode !== "reset") {
      const tipo = container.querySelector('input[name="tipoCuenta"]:checked')?.value;
      if (tipo !== "zonal" && tipo !== "admin" && zona.value) {
        await fillEquipos(container, zona.value);
      }
      await checkPrincipal(container);
    }
  });

  equipo?.addEventListener("change", async () => {
    await checkPrincipal(container);
  });

  fechaInicio?.addEventListener("change", () => {
    if (fechaInicioContrato && !fechaInicioContrato.value) {
      fechaInicioContrato.value = fechaInicio.value;
    }
  });

  guardar?.addEventListener("click", async () => {
    if (_ctx.mode === "reset") {
      const status = container.querySelector("#acc-status");
      _ctx.lastPayload = {
        passwordTemporal: initialPassword(`${_ctx.selected.rut}-${_ctx.selected.dv || ""}`),
        ..._ctx.selected
      };
      if (copiar) copiar.disabled = false;
      status.textContent = "Reset preparado correctamente. Ya puede copiar el correo de acceso.";
      status.classList.remove("acc-status--error");
      return;
    }

    await handleSaveCreateOrEdit(container);
  });

  copiar?.addEventListener("click", async () => {
    const p = _ctx.lastPayload || _ctx.selected;
    if (!p) return;

    const txt = `Asunto: Acceso a APP Ventas

Estimado/a ${p.nombre},

Se informa que su cuenta de acceso a la APP de Ventas ya se encuentra disponible.

URL de acceso:
https://ventas-afp-mobile.pages.dev/

Datos de acceso:
Usuario: ${p.username || p.usuario}
Mail registrado: ${p.email}
Password temporal: ${p.passwordTemporal || initialPassword(`${p.rut}-${p.dv || ""}`)}

Por razones de seguridad, deberá cambiar su contraseña en el primer acceso.

Saludos.`;

    await navigator.clipboard.writeText(txt);

    const status = container.querySelector("#acc-status");
    status.textContent = "Correo de acceso copiado al portapapeles.";
    status.classList.remove("acc-status--error");
  });

  cancelar?.addEventListener("click", () => {
    if (_ctx.mode === "editar" || _ctx.mode === "reset") {
      setAccesosMode("listado");
    } else {
      renderAccesos(_ctx.container, { mode: "crear" });
    }
  });
}

export async function renderAccesos(container, options = {}) {
  _ctx.container = container;

  if (options.embed) {
    _ctx.embed = {
      ..._ctx.embed,
      ...options.embed
    };
  }

  if (!_ctx.embed) {
    _ctx.embed = {
      enabled: false,
      onlyTipo: null,
      hideListado: false,
      hideReset: false,
      hideEditar: false,
      lockTipo: false
    };
  }

  if (options.mode) _ctx.mode = options.mode;
  const mode = _ctx.mode;

  if (mode === "listado") {
    await loadListado();
    container.innerHTML = renderListadoView(options.message || "");
    attachListadoEvents(container);
    return;
  }

  if ((mode === "editar" || mode === "reset") && !_ctx.selected) {
    _ctx.mode = "listado";
    await loadListado();
    container.innerHTML = renderListadoView("Debe seleccionar una cuenta desde Listado.");
    attachListadoEvents(container);
    return;
  }

  container.innerHTML = formView(mode, options.message || "", !!options.error);
  attachFormEvents(container);

  try {
    await maybeLoadCombos(container);
    await checkPrincipal(container);
  } catch (e) {
    const status = container.querySelector("#acc-status");
    if (status) {
      status.textContent = "No fue posible cargar los combos.";
      status.classList.add("acc-status--error");
    }
  }
}