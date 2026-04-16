import { supabase } from "../config.js";

const TZ = "America/Santiago";
let usuarioActivo = null;
let contextoActual = {
  perfil: "SUPERVISOR",   // se deriva por asignaciones; fallback supervisor
  items: [],
  seleccionado: null
};
let solicitudes = [];
let motivos = [];
let candidatos = [];

function hoyISO() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function esVigente(fechaInicio, fechaFin, fechaRef = hoyISO()) {
  if (!fechaInicio) return false;
  if (fechaInicio > fechaRef) return false;
  if (fechaFin && fechaFin < fechaRef) return false;
  return true;
}

function dedupeById(rows, key = "id") {
  const map = new Map();
  (rows || []).forEach((r) => {
    if (r && r[key] && !map.has(r[key])) map.set(r[key], r);
  });
  return Array.from(map.values());
}

function obtenerAccionSolicitante(sol, fechaRef = hoyISO()) {
  if (!sol || sol.id_usuario_solicitante !== usuarioActivo?.id) return null;

  if (sol.estado === "pendiente") {
    return "cancelar";
  }

  if (sol.estado === "aceptada") {
    if (sol.fecha_inicio && sol.fecha_inicio > fechaRef) {
      return "cancelar";
    }

    if (
      sol.fecha_inicio &&
      sol.fecha_inicio <= fechaRef &&
      (!sol.fecha_fin || sol.fecha_fin >= fechaRef)
    ) {
      return "terminar";
    }
  }

  return null;
}

async function esperarSesion(maxMs = 4000) {
  const inicio = Date.now();

  while (Date.now() - inicio < maxMs) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) {
      return data.session;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error("No se encontró sesión activa para cargar suplencias.");
}

async function obtenerUsuarioActivo() {
  if (typeof window.obtenerUsuarioActivo === "function") {
    const u = await window.obtenerUsuarioActivo();
    if (u?.id) return u;
  }

  try {
    const w = window.top || window.parent;
    if (w && typeof w.obtenerUsuarioActivo === "function") {
      const u = await w.obtenerUsuarioActivo();
      if (u?.id) return u;
    }
  } catch (_) {}

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const authUser = data?.user;
  if (!authUser?.id) throw new Error("No se pudo resolver el usuario autenticado.");

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, nombre, email")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileErr) throw profileErr;

  return profile || { id: authUser.id, nombre: authUser.email || "Usuario", email: authUser.email || "" };
}

async function cargarContextoActual() {
  const hoy = hoyISO();

  // SUPERVISOR: por asignación de equipos vigente
  const { data: relEquipo, error: relEquipoErr } = await supabase
    .from("equipo_supervisor")
    .select("id_equipo, es_principal, fecha_inicio, fecha_fin")
    .eq("id_supervisor", usuarioActivo.id);

  if (relEquipoErr) throw relEquipoErr;

  const relEquipoVigente = (relEquipo || []).filter(r => esVigente(r.fecha_inicio, r.fecha_fin, hoy));
  const equipoIds = [...new Set(relEquipoVigente.map(r => r.id_equipo).filter(Boolean))];

  let equipos = [];
  if (equipoIds.length) {
    const { data: eqs, error: eqErr } = await supabase
      .from("equipos")
      .select("id_equipo, nombre_equipo")
      .in("id_equipo", equipoIds);

    if (eqErr) throw eqErr;

    const principalById = new Map(relEquipoVigente.map(r => [r.id_equipo, !!r.es_principal]));
    equipos = (eqs || [])
      .map(e => ({
        id: e.id_equipo,
        nombre: e.nombre_equipo,
        es_principal: principalById.get(e.id_equipo) || false,
        tipo: "SUPERVISOR"
      }))
      .sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || a.nombre.localeCompare(b.nombre));
  }

  // ZONAL: best effort; si la tabla no existe o falla, no rompe el módulo
  let zonas = [];
  try {
    const { data: relZona, error: relZonaErr } = await supabase
      .from("zona_zonal")
      .select("id_zona, fecha_inicio, fecha_fin, estado")
      .eq("id_zonal", usuarioActivo.id);

    if (!relZonaErr) {
      const relZonaVigente = (relZona || []).filter(r => (r.estado ?? true) && esVigente(r.fecha_inicio, r.fecha_fin, hoy));
      const zonaIds = [...new Set(relZonaVigente.map(r => r.id_zona).filter(Boolean))];

      if (zonaIds.length) {
        const { data: zs, error: zErr } = await supabase
          .from("zonas")
          .select("id_zona, nombre")
          .in("id_zona", zonaIds);

        if (!zErr) {
          zonas = (zs || []).map(z => ({
            id: z.id_zona,
            nombre: z.nombre,
            tipo: "ZONAL"
          }));
        }
      }
    }
  } catch (_) {}

  if (zonas.length && !equipos.length) {
    contextoActual.perfil = "ZONAL";
    contextoActual.items = zonas;
  } else {
    contextoActual.perfil = "SUPERVISOR";
    contextoActual.items = equipos;
  }

  if (!contextoActual.items.length) {
    throw new Error("El usuario no tiene equipos o zonas vigentes asignadas.");
  }

  const idPersistido = contextoActual.perfil === "SUPERVISOR"
    ? localStorage.getItem("idEquipoActivo")
    : localStorage.getItem("idZonaActiva");

  contextoActual.seleccionado =
    contextoActual.items.find(i => i.id === idPersistido) ||
    contextoActual.items.find(i => i.es_principal) ||
    contextoActual.items[0];
}

function pintarAmbitos() {
  const filtro = document.getElementById("filtroAmbito");
  const select = document.getElementById("selectAmbito");
  const labelAmbito = document.getElementById("labelAmbito");
  const labelPropuesto = document.getElementById("labelPropuesto");

  const etiqueta = contextoActual.perfil === "ZONAL" ? "Zona" : "Equipo";
  if (labelAmbito) labelAmbito.textContent = etiqueta;
  if (labelPropuesto) {
    labelPropuesto.textContent = contextoActual.perfil === "ZONAL" ? "Zonal propuesto" : "Supervisor propuesto";
  }

  const options = contextoActual.items.map(item => {
    const selected = item.id === contextoActual.seleccionado?.id ? "selected" : "";
    return `<option value="${item.id}" ${selected}>${item.nombre}</option>`;
  }).join("");

  if (filtro) {
    filtro.innerHTML = options;
    filtro.disabled = contextoActual.items.length === 1;
    filtro.addEventListener("change", async (e) => {
      contextoActual.seleccionado = contextoActual.items.find(i => i.id === e.target.value) || contextoActual.items[0];
      persistirAmbitoActivo();
      await cargarPropuestos();
      await cargarSolicitudes();
    });
  }

  if (select) {
    select.innerHTML = options;
    select.disabled = contextoActual.items.length === 1;
  }
}

function persistirAmbitoActivo() {
  if (!contextoActual.seleccionado?.id) return;
  if (contextoActual.perfil === "SUPERVISOR") {
    localStorage.setItem("idEquipoActivo", contextoActual.seleccionado.id);
  } else {
    localStorage.setItem("idZonaActiva", contextoActual.seleccionado.id);
  }
}

async function cargarMotivos() {
  const select = document.getElementById("selectMotivo");
  if (!select) return;

  select.innerHTML = '<option value="">Cargando...</option>';

  let data = null;
  let error = null;

  ({ data, error } = await supabase
    .from("motivo_suplencia")
    .select("id, nombre_motivo, activo, orden")
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("nombre_motivo", { ascending: true }));

  if (error) {
    console.warn("Fallback lectura motivo_suplencia:", error);

    ({ data, error } = await supabase
      .from("motivo_suplencia")
      .select("id, nombre_motivo")
      .order("nombre_motivo", { ascending: true }));
  }

  if (error) {
    console.error("Error cargando motivos:", error);
    select.innerHTML = '<option value="">Error cargando motivos</option>';
    throw error;
  }

  motivos = data || [];

  select.innerHTML =
    '<option value="">Seleccione motivo...</option>' +
    motivos.map(m => `<option value="${m.id}">${m.nombre_motivo}</option>`).join("");
}

async function cargarPropuestos() {
  const select = document.getElementById("selectPropuesto");
  if (!select || !contextoActual.seleccionado?.id) return;

  select.innerHTML = '<option value="">Cargando...</option>';
  candidatos = [];

  if (contextoActual.perfil === "SUPERVISOR") {
    await cargarSupervisoresMismaZona();
  } else {
    await cargarZonalesMismaZona();
  }

  select.innerHTML = '<option value="">Seleccione...</option>' + candidatos
    .map(p => `<option value="${p.id}">${p.nombre}</option>`)
    .join("");
}

async function cargarSupervisoresMismaZona() {
  const select = document.getElementById("selectPropuesto");
  if (!select || !contextoActual.seleccionado?.id) return;

  select.innerHTML = '<option value="">Cargando...</option>';

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;

  const usuarioId = authData?.user?.id || null;
  const hoy = hoyISO();
  const equipoId = contextoActual.seleccionado.id;

  // 1) zona vigente del equipo seleccionado
  const { data: zonaRows, error: zonaErr } = await supabase
    .from("zona_equipo")
    .select("id_zona, fecha_inicio, fecha_fin, estado")
    .eq("id_equipo", equipoId);

  if (zonaErr) throw zonaErr;

  const zonasVigentes = (zonaRows || []).filter(r =>
    (r.estado ?? true) === true &&
    esVigente(r.fecha_inicio, r.fecha_fin, hoy)
  );

  const zonaIds = [...new Set(zonasVigentes.map(r => r.id_zona).filter(Boolean))];

  if (!zonaIds.length) {
    candidatos = [];
    select.innerHTML = '<option value="">Sin supervisores disponibles</option>';
    return;
  }

  // 2) equipos vigentes de esa zona
  const { data: zonaEquipoRows, error: zonaEquipoErr } = await supabase
    .from("zona_equipo")
    .select("id_equipo, id_zona, fecha_inicio, fecha_fin, estado")
    .in("id_zona", zonaIds);

  if (zonaEquipoErr) throw zonaEquipoErr;

  const equiposZonaIds = [...new Set(
    (zonaEquipoRows || [])
      .filter(r =>
        (r.estado ?? true) === true &&
        esVigente(r.fecha_inicio, r.fecha_fin, hoy)
      )
      .map(r => r.id_equipo)
      .filter(Boolean)
  )];

  if (!equiposZonaIds.length) {
    candidatos = [];
    select.innerHTML = '<option value="">Sin supervisores disponibles</option>';
    return;
  }

  // 3) supervisores vigentes de esos equipos
  const { data: supervisorRows, error: supervisorErr } = await supabase
    .from("equipo_supervisor")
    .select("id_supervisor, id_equipo, fecha_inicio, fecha_fin")
    .in("id_equipo", equiposZonaIds);

  if (supervisorErr) throw supervisorErr;

  const supervisorIds = [...new Set(
    (supervisorRows || [])
      .filter(r => esVigente(r.fecha_inicio, r.fecha_fin, hoy))
      .map(r => r.id_supervisor)
      .filter(id => id && id !== usuarioId)
  )];

  if (!supervisorIds.length) {
    candidatos = [];
    select.innerHTML = '<option value="">Sin supervisores disponibles</option>';
    return;
  }

  // 4) perfiles activos
  const { data: profilesRows, error: profilesErr } = await supabase
    .from("v_profiles_lookup")
    .select("id, nombre, activo")
    .in("id", supervisorIds);

  if (profilesErr) throw profilesErr;

  candidatos = (profilesRows || [])
    .filter(p => (p.activo ?? true) === true)
    .map(p => ({
      id: p.id,
      nombre: p.nombre
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  select.innerHTML =
    '<option value="">Seleccione...</option>' +
    candidatos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join("");

  console.log("Supervisores misma zona:", candidatos);
}

async function cargarZonalesMismaZona() {
  // Best effort. Si no existe zona_zonal o la estructura difiere, deja vacío sin romper.
  try {
    const zonaId = contextoActual.seleccionado.id;
    const { data: rows, error } = await supabase
      .from("zona_zonal")
      .select("id_zonal, fecha_inicio, fecha_fin, estado")
      .eq("id_zona", zonaId);

    if (error) {
      candidatos = [];
      return;
    }

    const hoy = hoyISO();
    const zonalIds = [...new Set((rows || [])
      .filter(r => (r.estado ?? true) && esVigente(r.fecha_inicio, r.fecha_fin, hoy))
      .map(r => r.id_zonal)
      .filter(id => id && id !== usuarioActivo.id))];

    if (!zonalIds.length) {
      candidatos = [];
      return;
    }

    const { data: profilesRows, error: profilesErr } = await supabase
      .from("v_profiles_lookup")
      .select("id, nombre, activo")
      .in("id", zonalIds)
      .eq("activo", true);

    if (profilesErr) {
      candidatos = [];
      return;
    }

    candidatos = dedupeById((profilesRows || []).map(p => ({ id: p.id, nombre: p.nombre }))).sort((a, b) => a.nombre.localeCompare(b.nombre));
  } catch (_) {
    candidatos = [];
  }
}

async function cargarSolicitudes() {
  const params = {
    p_tipo_suplencia: contextoActual.perfil,
    p_estado: document.getElementById("filtroEstado")?.value || null,
    p_id_equipo: null,
    p_id_zona: null,
    p_id_usuario: usuarioActivo.id
  };

  const { data, error } = await supabase.rpc("listar_solicitudes_suplencia", params);
  if (error) throw error;

  solicitudes = data || [];
  renderTabla();
}

function renderTabla() {
  const tbody = document.querySelector("#tablaSuplencias tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!solicitudes.length) {
    tbody.innerHTML = `
      <tr class="fila-placeholder">
        <td colspan="8" style="text-align:center;">No hay registros</td>
      </tr>
    `;
    return;
  }

  const fechaRef = hoyISO();

  solicitudes.forEach((s) => {
    const nombreAmbito = s.nombre_equipo || s.nombre_zona || "";
    const puedeAceptar = s.estado === "pendiente" && s.id_usuario_propuesto === usuarioActivo.id;
    const puedeRechazar = s.estado === "pendiente" && s.id_usuario_propuesto === usuarioActivo.id;
    const accionSolicitante = obtenerAccionSolicitante(s, fechaRef);

    const acciones = [
      puedeAceptar ? `<button type="button" class="btn btn-mini" data-action="aceptar" data-id="${s.id_solicitud}">Aceptar</button>` : "",
      puedeRechazar ? `<button type="button" class="btn btn-mini" data-action="rechazar" data-id="${s.id_solicitud}">Rechazar</button>` : "",
      accionSolicitante === "cancelar"
        ? `<button type="button" class="btn btn-mini" data-action="cancelar" data-id="${s.id_solicitud}">Cancelar</button>`
        : "",
      accionSolicitante === "terminar"
        ? `<button type="button" class="btn btn-mini btn-warning" data-action="terminar" data-id="${s.id_solicitud}">Terminar</button>`
        : ""
    ].filter(Boolean).join(" ");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${nombreAmbito}</td>
      <td>${s.nombre_solicitante || ""}</td>
      <td>${s.nombre_propuesto || ""}</td>
      <td>${s.nombre_motivo || ""}</td>
      <td>${s.fecha_inicio || ""}</td>
      <td>${s.fecha_fin || ""}</td>
      <td>${s.estado || ""}</td>
      <td>${acciones || '<span style="opacity:.6;">—</span>'}</td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-action="aceptar"]').forEach((btn) => {
    btn.addEventListener("click", () => aceptarSolicitud(btn.dataset.id));
  });

  tbody.querySelectorAll('[data-action="rechazar"]').forEach((btn) => {
    btn.addEventListener("click", () => rechazarSolicitud(btn.dataset.id));
  });

  tbody.querySelectorAll('[data-action="cancelar"]').forEach((btn) => {
    btn.addEventListener("click", () => cancelarSolicitud(btn.dataset.id));
  });

  tbody.querySelectorAll('[data-action="terminar"]').forEach((btn) => {
    btn.addEventListener("click", () => terminarSolicitud(btn.dataset.id));
  });
}

async function abrirModal() {
  const select = document.getElementById("selectAmbito");
  if (select && contextoActual.seleccionado?.id) {
    select.value = contextoActual.seleccionado.id;
  }

  const fechaInicio = document.getElementById("fechaInicio");
  if (fechaInicio) fechaInicio.value = hoyISO();

  await cargarMotivos();
  await cargarPropuestos();

  document.getElementById("modalSolicitud")?.showModal();
}

function cerrarModal() {
  document.getElementById("modalSolicitud")?.close();
}

function volverASupervisor() {
  const panelBotones = document.getElementById("panel-botones");
  const contenedorModulos = document.getElementById("contenedor-modulos");

  if (contenedorModulos) {
    contenedorModulos.innerHTML = "";
    contenedorModulos.style.display = "none";
  }
  if (panelBotones) {
    panelBotones.style.display = "";
  }
}

async function guardarSolicitud(ev) {
  ev.preventDefault();

  const ambitoId = document.getElementById("selectAmbito")?.value || contextoActual.seleccionado?.id || null;
  const idPropuesto = document.getElementById("selectPropuesto")?.value || null;
  const idMotivo = document.getElementById("selectMotivo")?.value || null;
  const fechaInicio = document.getElementById("fechaInicio")?.value || null;
  const fechaFin = document.getElementById("fechaFin")?.value || null;
  const observacion = document.getElementById("observacion")?.value?.trim() || null;

  if (!ambitoId) {
    alert(`No se pudo determinar el ${contextoActual.perfil === "ZONAL" ? "zona" : "equipo"} de la solicitud.`);
    return;
  }
  if (!idPropuesto) {
    alert(`Debes seleccionar un ${contextoActual.perfil === "ZONAL" ? "zonal" : "supervisor"} propuesto.`);
    return;
  }
  if (!idMotivo) {
    alert("Debes seleccionar un motivo.");
    return;
  }
  if (!fechaInicio) {
    alert("Debes ingresar la fecha de inicio.");
    return;
  }
  if (fechaFin && fechaFin < fechaInicio) {
    alert("La fecha fin no puede ser menor que la fecha inicio.");
    return;
  }

  const payload = {
    p_tipo_suplencia: contextoActual.perfil,
    p_id_equipo: contextoActual.perfil === "SUPERVISOR" ? ambitoId : null,
    p_id_zona: contextoActual.perfil === "ZONAL" ? ambitoId : null,
    p_id_usuario_solicitante: usuarioActivo.id,
    p_id_usuario_propuesto: idPropuesto,
    p_fecha_inicio: fechaInicio,
    p_fecha_fin: fechaFin || null,
    p_id_motivo: idMotivo,
    p_observacion: observacion
  };

  const { data, error } = await supabase.rpc("crear_solicitud_suplencia", payload);
  if (error) {
    alert(error.message || "No se pudo guardar la solicitud.");
    return;
  }

  console.log("Solicitud creada:", data);
  cerrarModal();
  ev.target.reset();
  if (document.getElementById("selectAmbito")) {
    document.getElementById("selectAmbito").value = contextoActual.seleccionado.id;
  }
  await cargarSolicitudes();
  alert("Solicitud creada correctamente.");
}

async function aceptarSolicitud(idSolicitud) {
  const { error } = await supabase.rpc("aceptar_solicitud_suplencia", {
    p_id_solicitud: idSolicitud
  });

  if (error) {
    alert(error.message || "No se pudo aceptar la solicitud.");
    return;
  }

  await cargarContextoActual();
  persistirAmbitoActivo();
  pintarAmbitos();
  await cargarSolicitudes();

  window.dispatchEvent(new CustomEvent("suplencia-aceptada"));

  alert("Solicitud aceptada correctamente.");
}

async function rechazarSolicitud(idSolicitud) {
  const motivo = prompt("Observación de rechazo (opcional):") || null;
  const { error } = await supabase.rpc("rechazar_solicitud_suplencia", {
    p_id_solicitud: idSolicitud,
    p_observacion_respuesta: motivo
  });

  if (error) {
    alert(error.message || "No se pudo rechazar la solicitud.");
    return;
  }

  await cargarSolicitudes();
  alert("Solicitud rechazada correctamente.");
}

async function cancelarSolicitud(idSolicitud) {
  const ok = window.confirm("¿Seguro que deseas cancelar esta solicitud de suplencia?");
  if (!ok) return;

  const { error } = await supabase.rpc("cancelar_solicitud_suplencia", {
    p_id_solicitud: idSolicitud
  });

  if (error) {
    alert(error.message || "No se pudo cancelar la solicitud.");
    return;
  }

  await cargarSolicitudes();
  alert("Solicitud cancelada correctamente.");
}

async function terminarSolicitud(idSolicitud) {
  const ok = window.confirm("¿Seguro que deseas terminar anticipadamente esta suplencia?");
  if (!ok) return;

  const { error } = await supabase.rpc("terminar_solicitud_suplencia", {
    p_id_solicitud: idSolicitud
  });

  if (error) {
    alert(error.message || "No se pudo terminar la suplencia.");
    return;
  }

  await cargarContextoActual();
  persistirAmbitoActivo();
  pintarAmbitos();
  await cargarSolicitudes();

  window.dispatchEvent(new CustomEvent("suplencia-terminada"));

  alert("Suplencia terminada correctamente.");
}

async function init() {
  try {
    await esperarSesion();
    usuarioActivo = await obtenerUsuarioActivo();
    await cargarContextoActual();
    persistirAmbitoActivo();
    pintarAmbitos();
    await cargarSolicitudes();

    document.getElementById("btnNuevaSolicitud")?.addEventListener("click", abrirModal);
    document.getElementById("btnCerrarModal")?.addEventListener("click", cerrarModal);
    document.getElementById("btnVolver")?.addEventListener("click", volverASupervisor);
    document.getElementById("formSolicitud")?.addEventListener("submit", guardarSolicitud);
    document.getElementById("filtroEstado")?.addEventListener("change", cargarSolicitudes);

    document.getElementById("selectAmbito")?.addEventListener("change", async (e) => {
      contextoActual.seleccionado = contextoActual.items.find(i => i.id === e.target.value) || contextoActual.seleccionado;
      const filtro = document.getElementById("filtroAmbito");
      if (filtro) filtro.value = e.target.value;
      persistirAmbitoActivo();
      await cargarPropuestos();
    });
  } catch (err) {
    console.error("❌ Error inicializando suplencias:", err);
    alert(err.message || "No se pudo inicializar el módulo de suplencias.");
  }
}

init();
