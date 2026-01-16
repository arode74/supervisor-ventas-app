(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const elBuscar = $("#txt-buscar");
  const elDia = $("#dt-dia");
  const elLista = $("#lista-vendedores");
  const btnLogout = $("#btn-logout");

  let supabase = null;
  let session = null;

  let idEquipo = null;
  let vendedores = []; // [{id, nombre}]
  let ventasByVendedor = new Map(); // id -> {tope,sobre,bajo,plan,pv}

  // ---------------------------
  // Helpers
  // ---------------------------
  function n0(x) {
    const v = Number(x || 0);
    return Number.isFinite(v) ? v : 0;
  }

  function calcTotal(v) {
    return n0(v.tope) + n0(v.sobre) + n0(v.bajo) + n0(v.plan) + n0(v.pv);
  }

  function renderValue(num) {
    // ventas en tu UX móvil se ven como números (sin $)
    return String(n0(num));
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

  // ---------------------------
  // Data fetch
  // ---------------------------
  async function fetchVendedoresEquipo() {
    if (!idEquipo) return [];

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

    const list = (data || [])
      .filter((r) => r?.vendedores?.id_vendedor)
      .map((r) => ({
        id: r.vendedores.id_vendedor,
        nombre: r.vendedores.nombre || "",
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return list;
  }

  function normalizarTipoVenta(tipoRaw) {
    const t = String(tipoRaw || "").trim().toUpperCase();
    if (t === "PRODUCTO_VOLUNTARIO") return "PV";
    if (t === "TOPE" || t === "SOBRE" || t === "BAJO" || t === "PLAN" || t === "PV") return t;
    return null;
  }

  async function fetchVentasDia(vendorIds, fechaISO) {
    if (!vendorIds.length) return [];

    const { data, error } = await supabase
      .from("ventas")
      .select("id_vendedor, fecha_venta, monto, tipo_venta")
      .in("id_vendedor", vendorIds)
      .eq("fecha_venta", fechaISO);

    if (error) throw error;
    return data || [];
  }

  async function cargarDia() {
    ventasByVendedor = new Map();

    const ids = vendedores.map((v) => v.id);
    const fechaISO = elDia.value;

    const rows = await fetchVentasDia(ids, fechaISO);

    // init a cero
    vendedores.forEach((v) => {
      ventasByVendedor.set(v.id, { tope: 0, sobre: 0, bajo: 0, plan: 0, pv: 0 });
    });

    rows.forEach((r) => {
      const entry = ventasByVendedor.get(r.id_vendedor);
      if (!entry) return;

      const tipo = normalizarTipoVenta(r.tipo_venta);
      const monto = n0(r.monto);

      if (tipo === "TOPE") entry.tope += monto;
      if (tipo === "SOBRE") entry.sobre += monto;
      if (tipo === "BAJO") entry.bajo += monto;
      if (tipo === "PLAN") entry.plan += monto;
      if (tipo === "PV") entry.pv += monto;
    });
  }

  // ---------------------------
  // UI render
  // ---------------------------
  function closeAllExpands(exceptId) {
    Mobile.closeAllExpands(elLista, exceptId, ".v-card", "data-id");
  }

  function renderList() {
    const q = normalize(elBuscar.value);
    const items = vendedores.filter((v) => normalize(v.nombre).includes(q));

    elLista.innerHTML = "";

    items.forEach((v) => {
      const avatar = normalize(v.nombre).slice(0, 1).toUpperCase() || "V";
      const sale = ventasByVendedor.get(v.id) || { tope: 0, sobre: 0, bajo: 0, plan: 0, pv: 0 };
      const total = calcTotal(sale);

      const card = document.createElement("div");
      card.className = "v-card";
      card.setAttribute("data-id", v.id);

      card.innerHTML = `
        <div class="v-head">
          <div class="v-left">
            <div class="v-avatar">${avatar}</div>
            <button class="v-namebtn" type="button" data-action="open-modal">
              <div class="v-name">${v.nombre}</div>
            </button>
          </div>
          <button class="v-plus" type="button" data-action="toggle">+</button>
        </div>

        <div class="expand" hidden>
          <div class="type-block">
            <div class="type-row" style="grid-template-columns:1fr; gap:8px;">
              <div class="type-col"><span>Tope</span><span>${renderValue(sale.tope)}</span></div>
              <div class="type-col"><span>Sobre</span><span>${renderValue(sale.sobre)}</span></div>
              <div class="type-col"><span>Bajo</span><span>${renderValue(sale.bajo)}</span></div>
              <div class="type-col"><span>Plan</span><span>${renderValue(sale.plan)}</span></div>
              <div class="type-col"><span>Producto Vol.</span><span>${renderValue(sale.pv)}</span></div>
              <div class="type-col"><span>Total</span><span>${renderValue(total)}</span></div>
            </div>
          </div>
        </div>
      `;

      elLista.appendChild(card);
    });
  }

  // ---------------------------
  // Modal (creado dinámico)
  // ---------------------------
  function ensureModal() {
    let dlg = document.getElementById("m-modal-ventas");
    if (dlg) return dlg;

    dlg = document.createElement("dialog");
    dlg.id = "m-modal-ventas";
    dlg.className = "m-dialog";

    dlg.innerHTML = `
      <form method="dialog" class="m-dialog__card" id="m-form-ventas">
        <div class="m-dialog__head">
          <div class="m-dialog__title">Registrar Ventas</div>
          <button class="m-iconbtn" type="button" id="m-close-ventas" aria-label="Cerrar">✕</button>
        </div>

        <div class="m-dialog__sub" id="m-ventas-sub">—</div>

        <div class="m-dialog__grid">
          <label class="m-lbl">Tope<input id="m-v-tope" type="number" inputmode="numeric" min="0" step="1"/></label>
          <label class="m-lbl">Sobre<input id="m-v-sobre" type="number" inputmode="numeric" min="0" step="1"/></label>
          <label class="m-lbl">Bajo<input id="m-v-bajo" type="number" inputmode="numeric" min="0" step="1"/></label>
          <label class="m-lbl">Plan<input id="m-v-plan" type="number" inputmode="numeric" min="0" step="1"/></label>
          <label class="m-lbl">Producto Vol.<input id="m-v-pv" type="number" inputmode="numeric" min="0" step="1"/></label>
        </div>

        <div class="m-dialog__actions">
          <button type="button" class="btn" id="m-cancel-ventas">Cancelar</button>
          <button type="button" class="btn btn-primary" id="m-save-ventas">Guardar</button>
        </div>
      </form>
    `;

    document.body.appendChild(dlg);

    // wire close
    dlg.querySelector("#m-close-ventas").addEventListener("click", () => dlg.close());
    dlg.querySelector("#m-cancel-ventas").addEventListener("click", () => dlg.close());

    return dlg;
  }

  async function cargarVentasDiaParaModal(idVendedor, fechaISO) {
    const { data, error } = await supabase
      .from("ventas")
      .select("monto, tipo_venta")
      .eq("id_vendedor", idVendedor)
      .eq("fecha_venta", fechaISO);

    if (error) throw error;

    let tope = 0, sobre = 0, bajo = 0, plan = 0, pv = 0;

    (data || []).forEach((r) => {
      const tipo = normalizarTipoVenta(r.tipo_venta);
      const monto = n0(r.monto);
      if (tipo === "TOPE") tope += monto;
      if (tipo === "SOBRE") sobre += monto;
      if (tipo === "BAJO") bajo += monto;
      if (tipo === "PLAN") plan += monto;
      if (tipo === "PV") pv += monto;
    });

    return { tope, sobre, bajo, plan, pv };
  }

  async function openModalVentas(vendedorId, vendedorNombre) {
    const dlg = ensureModal();
    const fechaISO = elDia.value;

    dlg.querySelector("#m-ventas-sub").textContent = `${vendedorNombre} — ${fechaISO}`;

    // precarga
    const current = await cargarVentasDiaParaModal(vendedorId, fechaISO);

    const iTope = dlg.querySelector("#m-v-tope");
    const iSobre = dlg.querySelector("#m-v-sobre");
    const iBajo = dlg.querySelector("#m-v-bajo");
    const iPlan = dlg.querySelector("#m-v-plan");
    const iPv = dlg.querySelector("#m-v-pv");

    iTope.value = current.tope ? String(current.tope) : "";
    iSobre.value = current.sobre ? String(current.sobre) : "";
    iBajo.value = current.bajo ? String(current.bajo) : "";
    iPlan.value = current.plan ? String(current.plan) : "";
    iPv.value = current.pv ? String(current.pv) : "";

    // save
    const btnSave = dlg.querySelector("#m-save-ventas");
    btnSave.onclick = async () => {
      const tope = n0(iTope.value);
      const sobre = n0(iSobre.value);
      const bajo = n0(iBajo.value);
      const plan = n0(iPlan.value);
      const pv = n0(iPv.value);

      const registros = [];
      if (tope > 0) registros.push({ id_vendedor: vendedorId, fecha_venta: fechaISO, monto: tope, descripcion: "", tipo_venta: "TOPE" });
      if (sobre > 0) registros.push({ id_vendedor: vendedorId, fecha_venta: fechaISO, monto: sobre, descripcion: "", tipo_venta: "SOBRE" });
      if (bajo > 0) registros.push({ id_vendedor: vendedorId, fecha_venta: fechaISO, monto: bajo, descripcion: "", tipo_venta: "BAJO" });
      if (plan > 0) registros.push({ id_vendedor: vendedorId, fecha_venta: fechaISO, monto: plan, descripcion: "", tipo_venta: "PLAN" });
      if (pv > 0) registros.push({ id_vendedor: vendedorId, fecha_venta: fechaISO, monto: pv, descripcion: "", tipo_venta: "PV" });

      try {
        // RPC pro: deja el día exactamente como lo ingresaste (si viene vacío => deja el día en 0)
        const { error } = await supabase.rpc("editar_ventas_dia", {
          p_id_vendedor: vendedorId,
          p_fecha_venta: fechaISO,
          p_registros: registros,
        });

        if (error) {
          console.error("RPC editar_ventas_dia error:", error);
          alert("Error al guardar ventas.");
          return;
        }

        dlg.close();

        // refresh
        await cargarDia();
        renderList();
      } catch (err) {
        console.error("Guardar ventas (mobile) error:", err);
        alert("Error inesperado al guardar.");
      }
    };

    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "open");
  }

  // ---------------------------
  // Init
  // ---------------------------
  async function init() {
    supabase = Mobile.getSupabase();
    if (!supabase) return (window.location.href = "../views/login.html");

    session = await Mobile.ensureSessionOrRedirect("../views/login.html");
    if (!session) return;

    idEquipo = getEquipoId();
    if (!idEquipo) {
      alert("Falta idEquipoActivo en el dispositivo.");
      window.location.href = "../views/supervisor.mobile.html";
      return;
    }

    if (btnLogout) btnLogout.addEventListener("click", () => Mobile.logoutAndRedirect("../views/login.html"));

    // fecha default: hoy
    const todayISO = Mobile.toISODate(new Date());
    if (elDia && !elDia.value) elDia.value = todayISO;

    // cargar vendedores y día
    vendedores = await fetchVendedoresEquipo();
    await cargarDia();
    renderList();

    // buscador en vivo
    elBuscar.addEventListener("input", renderList);

    // cambio de día
    elDia.addEventListener("change", async () => {
      await cargarDia();
      renderList();
    });

    // eventos lista
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
        return;
      }

      if (action === "open-modal") {
        const vend = vendedores.find((x) => x.id === vendedorId);
        await openModalVentas(vendedorId, vend?.nombre || "Vendedor");
        return;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error("Init ventas.mobile.js error:", err);
      alert("Error cargando Ventas (mobile). Revisa consola.");
    });
  });
})();
