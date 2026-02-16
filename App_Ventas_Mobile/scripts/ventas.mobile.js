(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const elLogout = $("#btn-logout");
  const elVolver = $("#btn-volver");
  const elDia = $("#dt-dia");
  const elBuscar = $("#txt-buscar");
  const elAbc = $("#abcBar");
  const elLista = $("#lista-vendedores");
  if (!elLista) return;

  const TEAM_KEYS = ["av_mobile_equipo_id", "av_equipo_id", "equipo_id", "id_equipo"];

  const TIPOS = [
    { key: "tope",  label: "Tope"  },
    { key: "sobre", label: "Sobre" },
    { key: "bajo",  label: "Bajo"  },
    { key: "plan",  label: "Plan"  },
    { key: "pv",    label: "PV"    } // campo moneda (formato $ con puntos)
  ];

  // PV/DPB se formatea como CLP
  const TIPO_MONEDA_SET = new Set(["pv", "dpb"]);

  const TIPO_TO_DB = {
    tope: "TOPE",
    sobre: "SOBRE",
    bajo: "BAJO",
    plan: "PLAN",
    pv: "PV",
    dpb: "DPB"
  };

  const DB_TO_TIPO = {
    TOPE: "tope",
    SOBRE: "sobre",
    BAJO: "bajo",
    PLAN: "plan",
    PV: "pv",
    DPB: "dpb"
  };

  const getEquipoId = () => {
    for (const k of TEAM_KEYS) {
      const v = localStorage.getItem(k);
      if (v && String(v).trim()) return String(v).trim();
    }
    return null;
  };

  const setDefaultDateToday = () => {
    if (!elDia) return;
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    elDia.value = `${yyyy}-${mm}-${dd}`;
  };

  const getSelectedDate = () => elDia?.value || null;

  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));

  function getFirstLetter(nombre) {
    const n = norm(nombre);
    if (!n) return "#";
    const L = n.charAt(0).toUpperCase();
    return (L >= "A" && L <= "Z") ? L : "#";
  }

  // ---------- Formato CLP ($ con punto miles) ----------
  const onlyDigits = (s) => String(s ?? "").replace(/[^\d]/g, "");
  const formatCLP = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return "";
    const int = Math.floor(v);
    const miles = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `$ ${miles}`;
  };

  const parseNonNegInt = (v) => {
    if (v === "" || v == null) return 0;
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  };

  const parseNonNegIntFromAny = (v) => {
    const d = onlyDigits(v);
    if (!d) return 0;
    const n = parseInt(d, 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  };

  const displayValForTipo = (tipo, n) => {
    const v = Number(n) || 0;
    if (v <= 0) return "";
    if (TIPO_MONEDA_SET.has(tipo)) return formatCLP(v);
    return String(parseNonNegInt(v));
  };

  // ---------------------------
  // Supabase
  // ---------------------------
  function requireSupabase() {
  // Fuente única: el cliente creado en config.js
  const sb = window.sb || window.supabaseClient || null;
  if (!sb) throw new Error("Supabase client no inicializado. Falta cargar config.js.");
  return sb;
}

  let sb;
  try {
    sb = requireSupabase();
  } catch {
    elLista.innerHTML = `<div class="m-muted">Error Supabase</div>`;
    return;
  }

  // ---------------------------
  // Estado UI
  // ---------------------------
  let vendedores = [];
  let vendedoresFiltrados = [];
  let expandedId = null;

  const ventasUI = Object.create(null);
  function ensureVentasBucket(fecha, idVendedor) {
    if (!ventasUI[fecha]) ventasUI[fecha] = Object.create(null);
    if (!ventasUI[fecha][idVendedor]) {
      ventasUI[fecha][idVendedor] = Object.create(null);
      TIPOS.forEach(t => (ventasUI[fecha][idVendedor][t.key] = 0));
    }
    return ventasUI[fecha][idVendedor];
  }

  // ---------------------------
  // Scroll: asegurar card expandido visible completo
  // ---------------------------
  function getScrollContainer() {
    return document.querySelector(".ventas-scroll")
      || elLista.closest(".ventas-scroll")
      || document.scrollingElement
      || document.documentElement;
  }

  function ensureExpandedFullyVisible(card) {
    if (!card) return;
    const sc = getScrollContainer();
    if (!sc) return;

    const scRect = sc.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const visibleTop = scRect.top;
    const visibleBottom = scRect.bottom;

    const available = Math.max(0, visibleBottom - visibleTop);
    const cardH = cardRect.height;

    let newScrollTop = sc.scrollTop;

    if (cardH > available) {
      const delta = cardRect.top - visibleTop;
      newScrollTop = sc.scrollTop + delta;
    } else {
      if (cardRect.top < visibleTop) {
        const delta = visibleTop - cardRect.top;
        newScrollTop = sc.scrollTop - delta;
      } else if (cardRect.bottom > visibleBottom) {
        const delta = cardRect.bottom - visibleBottom;
        newScrollTop = sc.scrollTop + delta;
      }
    }

    newScrollTop = Math.max(0, newScrollTop);
    sc.scrollTo({ top: newScrollTop, behavior: "smooth" });
  }

  // ---------------------------
  // Auth / Nav
  // ---------------------------
  let isInitRunning = false;
  let isLoggingOut = false;

  function hardRedirectToSupervisor() {
    // replace evita "volver" al estado previo
    window.location.replace(`/views/supervisor.mobile.html?t=${Date.now()}`);
  }

  // ✅ NUEVO: redirect a index SOLO para logout / sin sesión
  function hardRedirectToIndex() {
    window.location.replace(`/index.html?t=${Date.now()}`);
  }

  function nukeAuthTokens() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }

      // Borra tokens típicos Supabase + keys de navegación que suelen provocar redirecciones
      for (const k of keys) {
        const lk = k.toLowerCase();
        if (
          lk.includes("supabase") && lk.includes("auth") ||
          lk.startsWith("sb-") && lk.endsWith("-auth-token") ||
          lk.includes("auth-token") ||
          lk.includes("access_token") ||
          lk.includes("refresh_token")
        ) {
          localStorage.removeItem(k);
        }
      }

      // (Opcional) claves propias típicas
      ["av_mobile_last_page", "av_last_page"].forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  async function ensureSessionOrRedirect() {
    const { data } = await sb.auth.getSession();
    if (!data?.session) {
      // ✅ CAMBIO MÍNIMO: si estamos deslogueando, NO rebotar a supervisor (evita loop)
      if (isLoggingOut) {
        hardRedirectToIndex();
        return false;
      }
      hardRedirectToSupervisor();
      return false;
    }
    return true;
  }

  async function doLogout() {
    if (isLoggingOut) return;
    isLoggingOut = true;

    try { elLogout && (elLogout.disabled = true); } catch {}

    try {
      // intenta cerrar sesión formal
      await sb.auth.signOut({ scope: "global" });
    } catch {
      // aunque falle, hacemos limpieza dura
    }

    nukeAuthTokens();

    // ✅ CAMBIO MÍNIMO: logout va a index.html (no a supervisor)
    hardRedirectToIndex();
  }

  function goBack() {
    // navegación directa y robusta
    hardRedirectToSupervisor();
  }

  // ---------------------------
  // Data
  // ---------------------------
  async function refineByEquipoIfPossible(rows, equipoId) {
    try {
      const { data, error } = await sb
        .from("equipo_vendedor")
        .select("id_vendedor, estado, fecha_fin")
        .eq("id_equipo", equipoId);

      if (error) return rows;

      const ids = new Set(
        (data || [])
          .filter(r => r?.id_vendedor)
          .filter(r => (typeof r.estado === "boolean" ? r.estado === true : true))
          .filter(r => ("fecha_fin" in r ? r.fecha_fin == null : true))
          .map(r => String(r.id_vendedor))
      );

      if (ids.size === 0) return rows;
      return rows.filter(v => ids.has(String(v.id_vendedor)));
    } catch {
      return rows;
    }
  }

  async function fetchVendedores() {
    const equipoId = getEquipoId();

    let q = sb
      .from("vendedores")
      .select("id_vendedor, nombre, fecha_egreso")
      .order("nombre", { ascending: true });

    try {
      const { data, error } = await q.is("fecha_egreso", null);
      if (!error) {
        let rows = Array.isArray(data) ? data : [];
        if (equipoId) rows = await refineByEquipoIfPossible(rows, equipoId);
        return rows;
      }
    } catch {}

    const { data, error } = await q;
    if (error) throw new Error("No se pudo cargar vendedores.");
    let rows = Array.isArray(data) ? data : [];
    if (equipoId) rows = await refineByEquipoIfPossible(rows, equipoId);
    return rows;
  }

  // ---------------------------
  // BBDD: leer ventas por tipo (public.ventas)
  // ---------------------------
  async function loadVentasFromDB(idVendedor) {
    const fecha = getSelectedDate();
    if (!fecha) return;

    const bucket = ensureVentasBucket(fecha, idVendedor);
    TIPOS.forEach(t => (bucket[t.key] = 0));

    const { data, error } = await sb
      .from("ventas")
      .select("tipo_venta, monto")
      .eq("id_vendedor", idVendedor)
      .eq("fecha_venta", fecha);

    if (error) {
      console.error("[Ventas][READ] Error leyendo ventas:", error);
      return;
    }

    for (const r of (data || [])) {
      const dbTipo = String(r.tipo_venta || "").toUpperCase();
      const tipo = DB_TO_TIPO[dbTipo] || null;
      if (!tipo) continue;

      const qty = parseNonNegIntFromAny(r.monto);
      bucket[tipo] = parseNonNegInt(bucket[tipo] + qty);
    }
  }

// ---------------------------
// Guardar: RPC editar_ventas_dia (misma lógica que ventas normal)
// ---------------------------
async function saveVentasToDB(idVendedor) {
  const fecha = getSelectedDate();
  if (!fecha) return;

  const bucket = ensureVentasBucket(fecha, idVendedor);

  // Arma p_registros con el mismo formato que usa ventas.js
  const registros = [];
  for (const t of TIPOS) {
    const qty = parseNonNegInt(bucket[t.key]);
    if (qty <= 0) continue;

    registros.push({
      id_vendedor: idVendedor,
      fecha_venta: fecha,
      tipo_venta: TIPO_TO_DB[t.key], // TOPE/SOBRE/BAJO/PLAN/PV
      monto: qty,
      descripcion: ""
    });
  }

  const { error } = await sb.rpc("editar_ventas_dia", {
    p_id_vendedor: idVendedor,
    p_fecha_venta: fecha,
    p_registros: registros
  });

  if (error) {
    console.error("[Ventas][WRITE] Error grabando (RPC editar_ventas_dia):", error);
  }
}
  // ---------------------------
  // ABC
  // ---------------------------
  function getLetterSet(list) {
    const set = new Set();
    for (const v of list || []) set.add(getFirstLetter(v?.nombre));
    return set;
  }

  function buildAbcBar(list) {
    if (!elAbc) return;

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const available = getLetterSet(list);

    elAbc.innerHTML =
      letters.map(L => {
        const off = !available.has(L);
        return `<button type="button" data-letter="${L}" class="${off ? "is-off" : ""}" ${off ? "disabled" : ""}>${L}</button>`;
      }).join("")
      + `<button type="button" data-letter="#" class="${available.has("#") ? "" : "is-off"}" ${available.has("#") ? "" : "disabled"}>#</button>`;
  }

  function scrollToLetter(letter) {
    const card = elLista.querySelector(`.v-card[data-letter="${CSS.escape(letter)}"]`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------------------------
  // Render
  // ---------------------------
  function renderExpandedBlock(v) {
    const idVendedor = String(v?.id_vendedor ?? "");
    const fecha = getSelectedDate() || "";
    const bucket = fecha ? ensureVentasBucket(fecha, idVendedor) : null;

    return `
      <div class="v-inputs">
        ${TIPOS.map(t => {
          const val = bucket ? (bucket[t.key] ?? 0) : 0;
          const isMoney = TIPO_MONEDA_SET.has(t.key);

          return `
            <div class="v-sale-row" data-tipo="${t.key}">
              <div class="v-sale-label">${t.label}</div>

              <div class="v-ctrl">
                <button class="v-minus" type="button" data-action="minus">−</button>

                <input
                  class="v-in"
                  ${isMoney ? 'type="text"' : 'type="number"'}
                  inputmode="numeric"
                  ${isMoney ? 'data-format="clp"' : ""}
                  min="0"
                  step="1"
                  value="${escapeHtml(displayValForTipo(t.key, val))}"
                />

                <button class="v-plus2" type="button" data-action="plus">+</button>
              </div>
            </div>
          `;
        }).join("")}

        <div class="v-actions">
          <button class="v-act v-act--secondary" type="button" data-action="cancelar">Cancelar</button>
          <button class="v-act v-act--primary" type="button" data-action="guardar">Guardar</button>
        </div>
      </div>
    `;
  }

  function renderList(list) {
    const arr = Array.isArray(list) ? list : [];

    buildAbcBar(arr);

    if (arr.length === 0) {
      elLista.innerHTML = `<div class="m-muted">Sin vendedores para mostrar.</div>`;
      return;
    }

    elLista.innerHTML = arr.map(v => {
      const id = String(v.id_vendedor ?? "");
      const nombre = String(v.nombre ?? "—");
      const initials = nombre.trim() ? nombre.trim().slice(0, 1).toUpperCase() : "—";
      const isOpen = expandedId === id;
      const letter = getFirstLetter(nombre);

      return `
        <article class="v-card" data-id="${escapeHtml(id)}" data-letter="${escapeHtml(letter)}">
          <div class="v-row">
            <div class="v-avatar" aria-hidden="true">${escapeHtml(initials)}</div>

            <button class="v-namebtn" type="button" data-action="toggle">
              ${escapeHtml(nombre)}
            </button>

            <button class="v-plus" type="button" data-action="toggle" aria-label="Expandir">
              ${isOpen ? "−" : "+"}
            </button>
          </div>

          ${isOpen ? renderExpandedBlock(v) : ""}
        </article>
      `;
    }).join("");
  }

  function applySearch() {
    const q = norm(elBuscar?.value || "");
    expandedId = null;
    vendedoresFiltrados = !q ? [...vendedores] : vendedores.filter(v => norm(v?.nombre).includes(q));
    renderList(vendedoresFiltrados);
  }

  function handleVentaChange(card, tipo, delta) {
    const fecha = getSelectedDate();
    if (!fecha) return;

    const idVendedor = card.getAttribute("data-id");
    if (!idVendedor) return;

    const bucket = ensureVentasBucket(fecha, idVendedor);
    const row = card.querySelector(`.v-sale-row[data-tipo="${CSS.escape(tipo)}"]`);
    if (!row) return;

    const input = row.querySelector(".v-in");
    if (!input) return;

    const current = TIPO_MONEDA_SET.has(tipo)
      ? parseNonNegIntFromAny(input.value)
      : parseNonNegInt(input.value);

    const next = Math.max(0, current + delta);

    bucket[tipo] = next;
    input.value = displayValForTipo(tipo, next);
  }

  function syncFromInput(card, row, input) {
    const fecha = getSelectedDate();
    if (!fecha) return;

    const idVendedor = card.getAttribute("data-id");
    if (!idVendedor) return;

    const tipo = row.getAttribute("data-tipo");
    const bucket = ensureVentasBucket(fecha, idVendedor);

    if (TIPO_MONEDA_SET.has(tipo)) {
      const n = parseNonNegIntFromAny(input.value);
      bucket[tipo] = n;
      input.value = displayValForTipo(tipo, n);
      try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
      return;
    }

    const v = parseNonNegInt(input.value);
    bucket[tipo] = v;
    input.value = displayValForTipo(tipo, v);
  }

  async function guardarCambios(idVendedor) {
    await saveVentasToDB(String(idVendedor));
    expandedId = null;
    renderList(vendedoresFiltrados.length ? vendedoresFiltrados : vendedores);
  }

  function cancelarCambios() {
    expandedId = null;
    renderList(vendedoresFiltrados.length ? vendedoresFiltrados : vendedores);
  }

  function bindEvents() {
    // Volver robusto (aunque exista handler en HTML)
    elVolver?.addEventListener("click", goBack);

    elLogout?.addEventListener("click", doLogout);
    elBuscar?.addEventListener("input", applySearch);

    elDia?.addEventListener("change", () => {
      expandedId = null;
      renderList(vendedoresFiltrados.length ? vendedoresFiltrados : vendedores);
    });

    elAbc?.addEventListener("click", (ev) => {
      const b = ev.target?.closest?.("button[data-letter]");
      if (!b || b.disabled) return;
      scrollToLetter(b.getAttribute("data-letter"));
    });

    elLista.addEventListener("click", async (ev) => {
      const card = ev.target.closest(".v-card");
      if (!card) return;

      const id = card.getAttribute("data-id");

      const actionBtn = ev.target.closest("[data-action]");
      const action = actionBtn?.dataset?.action;

      if (action === "plus" || action === "minus") {
        const row = ev.target.closest(".v-sale-row");
        if (!row) return;
        const tipo = row.getAttribute("data-tipo");
        handleVentaChange(card, tipo, action === "plus" ? 1 : -1);
        return;
      }

      if (action === "cancelar") {
        cancelarCambios();
        return;
      }

      if (action === "guardar") {
        await guardarCambios(id);
        return;
      }

      if (action === "toggle") {
        const willOpen = expandedId !== id;
        expandedId = willOpen ? id : null;

        if (willOpen) await loadVentasFromDB(String(id));

        renderList(vendedoresFiltrados.length ? vendedoresFiltrados : vendedores);

        if (willOpen) {
          requestAnimationFrame(() => {
            const expandedCard = elLista.querySelector(`.v-card[data-id="${CSS.escape(id)}"]`);
            ensureExpandedFullyVisible(expandedCard);
          });
        }
      }
    });

    elLista.addEventListener("input", (ev) => {
      const input = ev.target;
      if (!input.classList?.contains("v-in")) return;
      const card = input.closest(".v-card");
      const row = input.closest(".v-sale-row");
      if (!card || !row) return;
      syncFromInput(card, row, input);
    });

    elLista.addEventListener("blur", (ev) => {
      const input = ev.target;
      if (!input.classList?.contains("v-in")) return;
      const card = input.closest(".v-card");
      const row = input.closest(".v-sale-row");
      if (!card || !row) return;
      syncFromInput(card, row, input);
    }, true);
  }

  async function init() {
    if (isInitRunning) return;
    isInitRunning = true;

    setDefaultDateToday();
    bindEvents();

    const ok = await ensureSessionOrRedirect();
    if (!ok) return;

    vendedores = await fetchVendedores();
    vendedoresFiltrados = [...vendedores];
    expandedId = null;
    renderList(vendedoresFiltrados);
  }

  document.addEventListener("DOMContentLoaded", init);
})();