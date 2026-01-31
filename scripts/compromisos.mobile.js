(() => {
  "use strict";

  // =========================
  // DOM
  // =========================
  const $ = (sel) => document.querySelector(sel);

  const elBuscar = $("#txt-buscar");
  const elDia = $("#dt-dia");
  const elSemana = $("#lbl-semana");
  const elLista = $("#lista-vendedores");
  const btnLogout = $("#btn-logout");

  // =========================
  // Estado
  // =========================
  let supabase = null;
  let session = null;

  let idEquipo = null;
  let idSupervisor = null;

  let vendedores = []; // [{id,nombre}]
  let tiposObligatorios = []; // 4 tipos: Tope/Sobre/Bajo/Plan (globales)
  let tiposSupervisor = []; // tipos del supervisor (visita terreno, llamados, etc.)

  let semanaInicioISO = null; // lunes
  let semanaFinISO = null; // domingo

  // semanales por vendedor: {tope,sobre,bajo,plan}
  let obligatoriosSemana = new Map();

  // diarios actual: vendedorId -> Map(tipoId -> {ayer:number, hoy:number})
  let diarios = new Map();

  // cursor "ayer" por vendedor
  let ayerCursorISOByVendedor = new Map(); // vendedorId -> yyyy-mm-dd (hábil)

  // =========================
  // Helpers
  // =========================
  function n0(x) {
    const v = Number(x || 0);
    return Number.isFinite(v) ? v : 0;
  }

  function normalize(s) {
    return Mobile.normalizeStr(s);
  }

  function getEquipoId() {
    return (
      localStorage.getItem("idEquipoActivo") ||
      localStorage.getItem("equipo_id") ||
      localStorage.getItem("id_equipo") ||
      null
    );
  }

  function isTipoName(t, target) {
    const name = normalize(t?.nombre || t?.descripcion || "");
    return name === normalize(target);
  }

  function pickObligatorios4(allTipos) {
    // Blindado: EXACTAMENTE Tope/Sobre/Bajo/Plan (una sola vez Plan)
    const find = (label) =>
      allTipos.find((t) => t.es_obligatorio === true && isTipoName(t, label));

    const tope = find("tope");
    const sobre = find("sobre");
    const bajo = find("bajo");
    const plan = find("plan");

    return [tope, sobre, bajo, plan].filter(Boolean);
  }

  function setSemanaDesdeFecha(fechaISO) {
    const base = Mobile.parseISODate(fechaISO);
    const lunes = Mobile.startOfWeekMonday(base);
    const domingo = Mobile.endOfWeekSunday(base);

    semanaInicioISO = Mobile.toISODate(lunes);
    semanaFinISO = Mobile.toISODate(domingo);

    if (elSemana) elSemana.textContent = Mobile.humanWeekRange(base);
  }

  function closeAllExpands(exceptId) {
    Mobile.closeAllExpands(elLista, exceptId, ".v-card", "data-id");
  }

  // =========================
  // Data
  // =========================
  async function fetchVendedoresEquipo() {
    const { data, error } = await supabase
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

    if (error) throw error;

    return (data || [])
      .filter((r) => r?.vendedores?.id_vendedor)
      .map((r) => ({
        id: r.vendedores.id_vendedor,
        nombre: r.vendedores.nombre || "",
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  async function fetchTipos() {
    const { data, error } = await supabase
      .from("tipos_compromisos")
      .select("id, nombre, descripcion, supervisor_id, activo, es_obligatorio, orden");

    if (error) throw error;

    const activos = (data || []).filter((t) => t && t.activo === true);

    // Obligatorios globales (sin supervisor)
    tiposObligatorios = pickObligatorios4(activos);

    // Tipos del supervisor (dinámicos)
    tiposSupervisor = activos
      .filter(
        (t) =>
          t.es_obligatorio === false &&
          String(t.supervisor_id || "") === String(idSupervisor || "")
      )
      .sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));

    // fallback por texto si no hay orden / viene null
    if (!tiposSupervisor.length) {
      tiposSupervisor = activos
        .filter(
          (t) =>
            t.es_obligatorio === false &&
            String(t.supervisor_id || "") === String(idSupervisor || "")
        )
        .sort((a, b) =>
          (a.descripcion || a.nombre || "").localeCompare(
            b.descripcion || b.nombre || "",
            "es"
          )
        );
    }
  }

  async function fetchCompromisosRango(vendorIds, desdeISO, hastaISO, tipoIds) {
    if (!vendorIds.length || !tipoIds.length) return [];

    const { data, error } = await supabase
      .from("compromisos")
      .select("id_vendedor, id_tipo, fecha_compromiso, monto_comprometido")
      .eq("id_equipo", idEquipo)
      .eq("id_supervisor", idSupervisor)
      .in("id_vendedor", vendorIds)
      .in("id_tipo", tipoIds)
      .gte("fecha_compromiso", desdeISO)
      .lte("fecha_compromiso", hastaISO);

    if (error) throw error;
    return data || [];
  }

  async function fetchCompromisosFechas(vendedorId, fechasISO, tipoIds) {
    if (!vendedorId || !fechasISO.length || !tipoIds.length) return [];

    const { data, error } = await supabase
      .from("compromisos")
      .select("id_vendedor, id_tipo, fecha_compromiso, monto_comprometido")
      .eq("id_equipo", idEquipo)
      .eq("id_supervisor", idSupervisor)
      .eq("id_vendedor", vendedorId)
      .in("id_tipo", tipoIds)
      .in("fecha_compromiso", fechasISO);

    if (error) throw error;
    return data || [];
  }

  async function cargarSemana() {
    obligatoriosSemana = new Map();

    // init a cero
    vendedores.forEach((v) => {
      obligatoriosSemana.set(v.id, { tope: 0, sobre: 0, bajo: 0, plan: 0 });
    });

    const obligIds = tiposObligatorios.map((t) => t.id);
    const rows = await fetchCompromisosRango(
      vendedores.map((v) => v.id),
      semanaInicioISO,
      semanaFinISO,
      obligIds
    );

    const idTope = tiposObligatorios.find((t) => isTipoName(t, "tope"))?.id;
    const idSobre = tiposObligatorios.find((t) => isTipoName(t, "sobre"))?.id;
    const idBajo = tiposObligatorios.find((t) => isTipoName(t, "bajo"))?.id;
    const idPlan = tiposObligatorios.find((t) => isTipoName(t, "plan"))?.id;

    rows.forEach((r) => {
      const o = obligatoriosSemana.get(r.id_vendedor);
      if (!o) return;

      const monto = n0(r.monto_comprometido);

      if (r.id_tipo === idTope) o.tope += monto;
      if (r.id_tipo === idSobre) o.sobre += monto;
      if (r.id_tipo === idBajo) o.bajo += monto;
      if (r.id_tipo === idPlan) o.plan += monto;
    });
  }

  async function cargarDiariosParaVendedor(vendedorId) {
    const hoyISO = elDia.value;
    const hoy = Mobile.parseISODate(hoyISO);

    const ayerISO =
      ayerCursorISOByVendedor.get(vendedorId) ||
      Mobile.toISODate(Mobile.prevBusinessDay(hoy));

    ayerCursorISOByVendedor.set(vendedorId, ayerISO);

    const tipoIds = tiposSupervisor.map((t) => t.id);
    const rows = await fetchCompromisosFechas(vendedorId, [ayerISO, hoyISO], tipoIds);

    const mapTipo = new Map();
    tipoIds.forEach((id) => mapTipo.set(id, { ayer: 0, hoy: 0 }));

    rows.forEach((r) => {
      const row = mapTipo.get(r.id_tipo);
      if (!row) return;

      const monto = n0(r.monto_comprometido);

      if (String(r.fecha_compromiso) === ayerISO) row.ayer += monto;
      if (String(r.fecha_compromiso) === hoyISO) row.hoy += monto;
    });

    diarios.set(vendedorId, mapTipo);
  }

  // =========================
  // Render
  // =========================
  function renderList() {
    const q = normalize(elBuscar.value);
    const items = vendedores.filter((v) => normalize(v.nombre).includes(q));

    elLista.innerHTML = "";

    items.forEach((v) => {
      const avatar = normalize(v.nombre).slice(0, 1).toUpperCase() || "V";
      const ob = obligatoriosSemana.get(v.id) || { tope: 0, sobre: 0, bajo: 0, plan: 0 };

      const card = document.createElement("div");
      card.className = "v-card";
      card.setAttribute("data-id", v.id);

      card.innerHTML = `
        <div class="v-head">
          <div class="v-left">
            <div class="v-avatar">${avatar}</div>
            <button class="v-namebtn" type="button" data-action="open-modal-semana">
              <div class="v-name">${v.nombre}</div>
            </button>
          </div>
          <button class="v-plus" type="button" data-action="toggle">+</button>
        </div>

        <!-- Obligatorios semana SIEMPRE visibles -->
        <div class="m-grid4" aria-label="Compromisos semanales">
          <div class="cell"><div class="label">Tope</div><div class="val">${n0(ob.tope)}</div></div>
          <div class="cell"><div class="label">Sobre</div><div class="val">${n0(ob.sobre)}</div></div>
          <div class="cell"><div class="label">Bajo</div><div class="val">${n0(ob.bajo)}</div></div>
          <div class="cell"><div class="label">Plan</div><div class="val">${n0(ob.plan)}</div></div>
        </div>

        <!-- Expand: tipos supervisor + ayer/hoy + guardar/cancelar -->
        <div class="expand" hidden>
          <div class="expand__header">
            <div class="pill">
              <div>
                <div style="font-weight:900;">Ayer</div>
                <small id="lbl-ayer-${v.id}">—</small>
              </div>
              <div class="nav-arrows">
                <button type="button" data-action="ayer-prev" aria-label="Día hábil anterior">‹</button>
                <button type="button" data-action="ayer-next" aria-label="Día hábil siguiente">›</button>
              </div>
            </div>

            <div class="pill">
              <div>
                <div style="font-weight:900;">Hoy</div>
                <small id="lbl-hoy-${v.id}">—</small>
              </div>
              <div style="opacity:.5; font-weight:900;">Fijo</div>
            </div>
          </div>

          <div data-zone="types"></div>

          <div class="actions">
            <button class="btn" type="button" data-action="cancel">Cancelar</button>
            <button class="btn btn-primary" type="button" data-action="save">Guardar</button>
          </div>
        </div>
      `;

      elLista.appendChild(card);
    });
  }

  function setHeaderDates(vendedorId) {
    const hoyISO = elDia.value;
    const hoy = Mobile.parseISODate(hoyISO);

    const curAyerISO =
      ayerCursorISOByVendedor.get(vendedorId) ||
      Mobile.toISODate(Mobile.prevBusinessDay(hoy));
    const ayer = Mobile.parseISODate(curAyerISO);

    ayerCursorISOByVendedor.set(vendedorId, Mobile.toISODate(ayer));

    const lblAyer = document.getElementById(`lbl-ayer-${vendedorId}`);
    const lblHoy = document.getElementById(`lbl-hoy-${vendedorId}`);

    if (lblAyer)
      lblAyer.textContent = ayer.toLocaleDateString("es-CL", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
    if (lblHoy)
      lblHoy.textContent = hoy.toLocaleDateString("es-CL", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
  }

  function renderTypes(vendedorId) {
    const card = document.querySelector(`.v-card[data-id="${vendedorId}"]`);
    if (!card) return;

    const zone = card.querySelector('[data-zone="types"]');
    if (!zone) return;

    const m = diarios.get(vendedorId) || new Map();

    zone.innerHTML = "";

    tiposSupervisor.forEach((t) => {
      const label = t.descripcion || t.nombre || "Compromiso";
      const row = m.get(t.id) || { ayer: 0, hoy: 0 };

      const block = document.createElement("div");
      block.className = "type-block";
      block.innerHTML = `
        <div class="type-title">${label}</div>
        <div class="type-row">
          <div class="type-col">
            <span>${n0(row.ayer)}</span>
            <span style="color:var(--muted); font-weight:900;">(ayer)</span>
          </div>
          <div class="type-col">
            <span>Hoy</span>
            <input type="number" inputmode="numeric" min="0" step="1"
              value="${n0(row.hoy)}"
              data-action="edit-hoy"
              data-type-id="${t.id}"/>
          </div>
        </div>
      `;
      zone.appendChild(block);
    });
  }

  // =========================
  // Guardado (diario supervisor)
  // =========================
  async function guardarHoy(vendedorId) {
    const m = diarios.get(vendedorId);
    if (!m) return;

    const hoyISO = elDia.value;

    try {
      // Guardado por tipo (RPC)
      for (const [tipoId, row] of m.entries()) {
        const monto = n0(row.hoy);
        const { error } = await supabase.rpc("upsert_compromiso", {
          p_id_equipo: idEquipo,
          p_id_vendedor: vendedorId,
          p_id_tipo: tipoId,
          p_fecha: hoyISO,
          p_monto: monto,
          p_comentario: null,
        });
        if (error) throw error;
      }

      await cargarSemana();
      renderList();
    } catch (err) {
      console.error("Guardar compromisos hoy error:", err);
      alert("Error al guardar compromisos.");
    }
  }

  function cancelarHoy(vendedorId) {
    renderTypes(vendedorId);
  }

  // =========================
  // Modal semanal (Tope/Sobre/Bajo/Plan)
  // =========================
  function ensureModalSemana() {
    let dlg = document.getElementById("m-modal-semana");
    if (dlg) return dlg;

    dlg = document.createElement("dialog");
    dlg.id = "m-modal-semana";
    dlg.className = "m-dialog";

    dlg.innerHTML = `
      <form method="dialog" class="m-dialog__card" id="m-form-semana">
        <div class="m-dialog__head">
          <div class="m-dialog__title">Compromisos</div>
          <button class="m-iconbtn" type="button" id="m-close-semana" aria-label="Cerrar">✕</button>
        </div>

        <div class="m-dialog__sub" id="m-semana-sub">—</div>

        <div class="m-dialog__grid">
          <label class="m-lbl">Tope<input id="m-c-tope" type="number" inputmode="numeric" min="0" step="1"/></label>
          <label class="m-lbl">Sobre<input id="m-c-sobre" type="number" inputmode="numeric" min="0" step="1"/></label>
          <label class="m-lbl">Bajo<input id="m-c-bajo" type="number" inputmode="numeric" min="0" step="1"/></label>
          <label class="m-lbl">Plan<input id="m-c-plan" type="number" inputmode="numeric" min="0" step="1"/></label>
        </div>

        <div class="m-dialog__actions">
          <button type="button" class="btn" id="m-cancel-semana">Cancelar</button>
          <button type="button" class="btn btn-primary" id="m-save-semana">Guardar</button>
        </div>
      </form>
    `;

    document.body.appendChild(dlg);

    dlg.querySelector("#m-close-semana").addEventListener("click", () => dlg.close());
    dlg.querySelector("#m-cancel-semana").addEventListener("click", () => dlg.close());

    return dlg;
  }

  async function fetchObligatoriosSemanaVendedor(vendedorId) {
    const ids = tiposObligatorios.map((t) => t.id);
    const rows = await fetchCompromisosRango([vendedorId], semanaInicioISO, semanaFinISO, ids);

    const out = { tope: 0, sobre: 0, bajo: 0, plan: 0 };

    const idTope = tiposObligatorios.find((t) => isTipoName(t, "tope"))?.id;
    const idSobre = tiposObligatorios.find((t) => isTipoName(t, "sobre"))?.id;
    const idBajo = tiposObligatorios.find((t) => isTipoName(t, "bajo"))?.id;
    const idPlan = tiposObligatorios.find((t) => isTipoName(t, "plan"))?.id;

    rows.forEach((r) => {
      const monto = n0(r.monto_comprometido);
      if (r.id_tipo === idTope) out.tope += monto;
      if (r.id_tipo === idSobre) out.sobre += monto;
      if (r.id_tipo === idBajo) out.bajo += monto;
      if (r.id_tipo === idPlan) out.plan += monto;
    });

    return out;
  }

  async function openModalSemana(vendedorId, vendedorNombre) {
    const dlg = ensureModalSemana();

    dlg.querySelector("#m-semana-sub").textContent = `${vendedorNombre} — Semana ${semanaInicioISO} a ${semanaFinISO}`;

    const current = await fetchObligatoriosSemanaVendedor(vendedorId);

    const iTope = dlg.querySelector("#m-c-tope");
    const iSobre = dlg.querySelector("#m-c-sobre");
    const iBajo = dlg.querySelector("#m-c-bajo");
    const iPlan = dlg.querySelector("#m-c-plan");

    iTope.value = current.tope ? String(current.tope) : "";
    iSobre.value = current.sobre ? String(current.sobre) : "";
    iBajo.value = current.bajo ? String(current.bajo) : "";
    iPlan.value = current.plan ? String(current.plan) : "";

    const btnSave = dlg.querySelector("#m-save-semana");
    btnSave.onclick = async () => {
      const tope = n0(iTope.value);
      const sobre = n0(iSobre.value);
      const bajo = n0(iBajo.value);
      const plan = n0(iPlan.value);

      try {
        // Semana: guardamos en el LUNES (referencia estable)
        const fechaRefISO = semanaInicioISO;

        const idTope = tiposObligatorios.find((t) => isTipoName(t, "tope"))?.id;
        const idSobre = tiposObligatorios.find((t) => isTipoName(t, "sobre"))?.id;
        const idBajo = tiposObligatorios.find((t) => isTipoName(t, "bajo"))?.id;
        const idPlan = tiposObligatorios.find((t) => isTipoName(t, "plan"))?.id;

        const items = [
          { id: idTope, monto: tope },
          { id: idSobre, monto: sobre },
          { id: idBajo, monto: bajo },
          { id: idPlan, monto: plan },
        ].filter((x) => x.id);

        for (const it of items) {
          const { error } = await supabase.rpc("upsert_compromiso", {
            p_id_equipo: idEquipo,
            p_id_vendedor: vendedorId,
            p_id_tipo: it.id,
            p_fecha: fechaRefISO,
            p_monto: n0(it.monto),
            p_comentario: null,
          });
          if (error) throw error;
        }

        dlg.close();

        await cargarSemana();
        renderList();
      } catch (err) {
        console.error("Guardar compromisos semanales error:", err);
        alert("Error al guardar compromisos semanales.");
      }
    };

    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "open");
  }

  // =========================
  // Init
  // =========================
  async function init() {
    supabase = Mobile.getSupabase();
    if (!supabase) return (window.location.href = "../views/login.html");

    session = await Mobile.ensureSessionOrRedirect("../views/login.html");
    if (!session) return;

    idEquipo = getEquipoId();
    idSupervisor =
      localStorage.getItem("idSupervisorActivo") ||
      localStorage.getItem("supervisor_id") ||
      localStorage.getItem("id_supervisor") ||
      session.user?.id ||
      null;

    if (!idEquipo) {
      alert("Falta idEquipoActivo en el dispositivo.");
      window.location.href = "../views/supervisor.mobile.html";
      return;
    }
    if (!idSupervisor) {
      alert("Falta idSupervisorActivo (o sesión inválida).");
      window.location.href = "../views/supervisor.mobile.html";
      return;
    }

    if (btnLogout) {
      btnLogout.addEventListener("click", () =>
        Mobile.logoutAndRedirect("../views/login.html")
      );
    }

    // fecha default: hoy
    const todayISO = Mobile.toISODate(new Date());
    if (elDia && !elDia.value) elDia.value = todayISO;

    // semana
    setSemanaDesdeFecha(elDia.value);

    // maestros
    await fetchTipos();
    vendedores = await fetchVendedoresEquipo();

    // semana (obligatorios)
    await cargarSemana();
    renderList();

    // buscar
    elBuscar.addEventListener("input", renderList);

    // cambio de fecha (impacta semana)
    elDia.addEventListener("change", async () => {
      setSemanaDesdeFecha(elDia.value);
      await cargarSemana();
      renderList();
    });

    // click lista
    elLista.addEventListener("click", async (e) => {
      const card = e.target.closest(".v-card");
      if (!card) return;

      const vendedorId = card.getAttribute("data-id");
      const action = e.target.closest("[data-action]")?.getAttribute("data-action");
      if (!action) return;

      if (action === "toggle") {
        const exp = card.querySelector(".expand");
        const btn = card.querySelector('[data-action="toggle"]');
        const isOpen = exp && !exp.hidden;

        closeAllExpands(vendedorId);
        if (exp) exp.hidden = isOpen ? true : false;
        if (btn) btn.textContent = isOpen ? "+" : "−";

        if (!isOpen) {
          const hoy = Mobile.parseISODate(elDia.value);
          if (!ayerCursorISOByVendedor.get(vendedorId)) {
            ayerCursorISOByVendedor.set(
              vendedorId,
              Mobile.toISODate(Mobile.prevBusinessDay(hoy))
            );
          }

          setHeaderDates(vendedorId);
          await cargarDiariosParaVendedor(vendedorId);
          renderTypes(vendedorId);
        }
        return;
      }

      if (action === "ayer-prev" || action === "ayer-next") {
        const hoyISO = elDia.value;
        const hoy = Mobile.parseISODate(hoyISO);

        const curISO =
          ayerCursorISOByVendedor.get(vendedorId) ||
          Mobile.toISODate(Mobile.prevBusinessDay(hoy));
        const cur = Mobile.parseISODate(curISO);

        const next =
          action === "ayer-prev"
            ? Mobile.prevBusinessDay(cur)
            : Mobile.nextBusinessDay(cur);

        // regla: hoy siempre fijo, solo se mueve la columna "ayer"
        ayerCursorISOByVendedor.set(vendedorId, Mobile.toISODate(next));

        setHeaderDates(vendedorId);
        await cargarDiariosParaVendedor(vendedorId);
        renderTypes(vendedorId);
        return;
      }

      if (action === "save") {
        await guardarHoy(vendedorId);
        // mantener expandido y refrescar
        await cargarDiariosParaVendedor(vendedorId);
        renderTypes(vendedorId);
        return;
      }

      if (action === "cancel") {
        cancelarHoy(vendedorId);
        return;
      }

      if (action === "open-modal-semana") {
        const vend = vendedores.find((x) => x.id === vendedorId);
        await openModalSemana(vendedorId, vend?.nombre || "Vendedor");
        return;
      }
    });

    // input hoy editable
    elLista.addEventListener("input", (e) => {
      const inp = e.target.closest('input[data-action="edit-hoy"]');
      if (!inp) return;

      const card = e.target.closest(".v-card");
      if (!card) return;

      const vendedorId = card.getAttribute("data-id");
      const typeId = inp.getAttribute("data-type-id");
      const val = Math.max(0, n0(inp.value));

      const m = diarios.get(vendedorId) || new Map();
      const row = m.get(typeId) || { ayer: 0, hoy: 0 };
      row.hoy = val;
      m.set(typeId, row);
      diarios.set(vendedorId, m);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error("Init compromisos.mobile.js error:", err);
      alert("Error cargando Compromisos (mobile). Revisa consola.");
    });
  });
})();
