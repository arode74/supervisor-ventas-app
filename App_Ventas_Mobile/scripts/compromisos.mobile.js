(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const dtDia = $("dtDia");
  const lblSemana = $("lblSemana");
  const txtEquipo = $("txtEquipo");
  const txtBuscar = $("txtBuscar");
  const listaVendedores = $("listaVendedores");

  const btnVolver = $("btnVolver");
  const btnSalir = $("btnSalir");

  const sheet = $("sheet");
  const sheetTitulo = $("sheetTitulo");
  const sheetSub = $("sheetSub");
  const sheetContenido = $("sheetContenido");
  const tabSemanal = $("tabSemanal");
  const tabMensual = $("tabMensual");
  const btnCancelar = $("btnCancelar");
  const btnGuardar = $("btnGuardar");

  // ---------- Supabase ----------
  function createSbClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase SDK no está cargado.");
    }
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      throw new Error("Faltan SUPABASE_URL / SUPABASE_ANON_KEY (env.js).");
    }
    return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
  const sb = createSbClient();

  // ---------- Estado ----------
  const STATE = {
    userId: "",
    equipoId: "",
    equipoNombre: "",
    vendedores: [],
    progreso: new Map(), // id_vendedor -> {actual, meta, pct}
    tipos: [],
    tiposSemanal: [],
    tiposMensual: [],
    sheetMode: "semanal", // semanal | mensual
    sheetVendedor: null,  // {id_vendedor, vendedor_nombre}
    valuesSemanal: new Map(), // id_tipo -> value
    valuesMensual: new Map(), // id_tipo -> value
  };

  // ---------- Helpers fecha ----------
  function pad2(n) { return String(n).padStart(2, "0"); }
  function toISODate(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  }
  function parseISODate(s) {
    // s: YYYY-MM-DD
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  function startOfWeekMonday(d) {
    const x = new Date(d);
    const day = x.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day);
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function endOfWeekSunday(d) {
    const s = startOfWeekMonday(d);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return e;
  }
  function firstOfMonth(d) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function weekLabel(d) {
    const s = startOfWeekMonday(d);
    const e = endOfWeekSunday(d);
    return `Semana: ${pad2(s.getDate())}-${pad2(s.getMonth()+1)} al ${pad2(e.getDate())}-${pad2(e.getMonth()+1)}`;
  }

  // ---------- Equipo activo (alineado con supervisor.mobile.js) ----------
  function getEquipoActivo() {
    try { return localStorage.getItem("av_mobile_equipo_id") || ""; } catch { return ""; }
  }

  // ---------- UI ----------
  function setTabs(mode) {
    STATE.sheetMode = mode;
    if (mode === "semanal") {
      tabSemanal.classList.add("is-active");
      tabMensual.classList.remove("is-active");
    } else {
      tabMensual.classList.add("is-active");
      tabSemanal.classList.remove("is-active");
    }
    renderSheetBody();
  }

  function openSheet(vendedor) {
    STATE.sheetVendedor = vendedor;
    sheetTitulo.textContent = "Editar Compromiso";
    sheetSub.textContent = `${vendedor.vendedor_nombre}`;
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    STATE.sheetVendedor = null;
    STATE.valuesSemanal.clear();
    STATE.valuesMensual.clear();
    sheetContenido.innerHTML = "";
    btnGuardar.disabled = false;
  }

  function formatNumber(n) {
    if (n === null || typeof n === "undefined") return "";
    const x = Number(n);
    if (!Number.isFinite(x)) return "";
    // sin separador de miles para evitar teclado raro en móvil
    return String(x);
  }

  function renderVendedorCard(v) {
    const prog = STATE.progreso.get(v.id_vendedor) || { actual: 0, meta: 0, pct: 0 };
    const pct = Math.max(0, Math.min(100, Number(prog.pct || 0)));

    const card = document.createElement("div");
    card.className = "cmp-card";
    card.dataset.vid = v.id_vendedor;
    card.dataset.name = (v.vendedor_nombre || "").toLowerCase();

    const top = document.createElement("div");
    top.className = "cmp-card-top";

    const left = document.createElement("div");
    const nm = document.createElement("div");
    nm.className = "cmp-name";
    nm.textContent = v.vendedor_nombre || "(Sin nombre)";
    left.appendChild(nm);

    const sub = document.createElement("div");
    sub.className = "cmp-sub";
    sub.textContent = "Compromiso semanal vs ventas (semana seleccionada)";
    left.appendChild(sub);

    const rightWrap = document.createElement("div");
    rightWrap.style.display = "flex";
    rightWrap.style.alignItems = "center";
    rightWrap.style.gap = "10px";

    const kpi = document.createElement("div");
    kpi.className = "cmp-kpi";
    kpi.textContent = `${formatNumber(prog.actual)}/${formatNumber(prog.meta)} Ventas`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cmp-btn";
    btn.textContent = "Editar";
    btn.addEventListener("click", async () => {
      await loadSheetValues(v.id_vendedor);
      openSheet(v);
    });

    rightWrap.appendChild(kpi);
    rightWrap.appendChild(btn);

    top.appendChild(left);
    top.appendChild(rightWrap);

    const bar = document.createElement("div");
    bar.className = "cmp-bar";
    const fill = document.createElement("div");
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    card.appendChild(top);
    card.appendChild(bar);

    return card;
  }

  function renderLista() {
    listaVendedores.innerHTML = "";
    for (const v of STATE.vendedores) {
      listaVendedores.appendChild(renderVendedorCard(v));
    }
    applyFilter();
  }

  function applyFilter() {
    const q = (txtBuscar.value || "").trim().toLowerCase();
    const cards = listaVendedores.querySelectorAll(".cmp-card");
    for (const el of cards) {
      const name = el.dataset.name || "";
      el.style.display = !q || name.includes(q) ? "" : "none";
    }
  }

  function renderSheetBody() {
    const vendor = STATE.sheetVendedor;
    if (!vendor) return;

    const mode = STATE.sheetMode;

    const tipos = mode === "semanal" ? STATE.tiposSemanal : STATE.tiposMensual;
    const values = mode === "semanal" ? STATE.valuesSemanal : STATE.valuesMensual;

    sheetContenido.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "cmp-sheet-grid";

    for (const t of tipos) {
      const lbl = document.createElement("div");
      lbl.textContent = t.nombre;

      const inp = document.createElement("input");
      inp.className = "cmp-input";
      inp.type = "number";
      inp.inputMode = "numeric";
      inp.min = "0";
      inp.step = "1";
      inp.value = formatNumber(values.get(t.id) ?? "");

      inp.addEventListener("input", () => {
        const val = inp.value === "" ? "" : Number(inp.value);
        if (inp.value === "") values.set(t.id, "");
        else values.set(t.id, Number.isFinite(val) ? val : "");
      });

      grid.appendChild(lbl);
      grid.appendChild(inp);
    }

    sheetContenido.appendChild(grid);

    const hint = document.createElement("div");
    hint.className = "cmp-hint";
    hint.style.marginTop = "10px";
    hint.textContent = mode === "semanal"
      ? "Semanal: guarda anclado al lunes de la semana seleccionada."
      : "Mensual: guarda anclado al día 1 del mes de la fecha seleccionada.";
    sheetContenido.appendChild(hint);
  }

  // ---------- Data load ----------
  async function requireSession() {
    const { data, error } = await sb.auth.getSession();
    if (error) console.warn("[Compromisos] getSession error:", error);
    const session = data?.session;
    if (!session) throw new Error("Sin sesión");
    STATE.userId = session.user.id;
    return session;
  }

  async function loadEquipoNombre() {
    if (!STATE.equipoId) {
      txtEquipo.value = "";
      return;
    }
    const { data, error } = await sb
      .from("equipos")
      .select("nombre_equipo")
      .eq("id_equipo", STATE.equipoId)
      .maybeSingle();
    if (error) {
      console.warn("[Compromisos] equipos error:", error);
      txtEquipo.value = STATE.equipoId;
      return;
    }
    txtEquipo.value = data?.nombre_equipo || STATE.equipoId;
    STATE.equipoNombre = txtEquipo.value;
  }

  async function loadVendedoresEquipo() {
    const hoy = toISODate(new Date());
    const { data, error } = await sb
      .from("vista_supervisor_equipo_vendedor_full")
      .select("id_vendedor, vendedor_nombre, vendedor_estado, vendedor_fecha_inicio, vendedor_fecha_fin, id_supervisor, id_equipo")
      .eq("id_equipo", STATE.equipoId)
      .eq("id_supervisor", STATE.userId);

    if (error) throw error;

    const rows = (data || []).filter(r => {
      const okEstado = (r.vendedor_estado === null || r.vendedor_estado === true);
      const fi = r.vendedor_fecha_inicio ? String(r.vendedor_fecha_inicio) : null;
      const ff = r.vendedor_fecha_fin ? String(r.vendedor_fecha_fin) : null;
      const okFi = !fi || fi <= hoy;
      const okFf = !ff || ff >= hoy;
      return okEstado && okFi && okFf;
    });

    // dedupe por id_vendedor
    const seen = new Set();
    STATE.vendedores = [];
    for (const r of rows) {
      const id = String(r.id_vendedor || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      STATE.vendedores.push({ id_vendedor: r.id_vendedor, vendedor_nombre: r.vendedor_nombre || "" });
    }

    // orden alfabético
    STATE.vendedores.sort((a, b) => String(a.vendedor_nombre).localeCompare(String(b.vendedor_nombre), "es"));
  }

  async function loadTipos() {
    const { data, error } = await sb
      .from("tipos_compromisos")
      .select("id, nombre, orden, activo, supervisor_id, visible_para_todos, es_obligatorio")
      .eq("activo", true);
    if (error) throw error;

    const tipos = (data || []).map(x => ({
      id: x.id,
      nombre: String(x.nombre || "").trim(),
      orden: x.orden,
      es_obligatorio: x.es_obligatorio,
      visible_para_todos: x.visible_para_todos,
      supervisor_id: x.supervisor_id,
    }));

    // Semanal: nombres exactos TOPE/SOBRE/BAJO/PLAN (los globales)
    const WEEK_SET = new Set(["TOPE", "SOBRE", "BAJO", "PLAN"]);
    const MONTH_SET = new Set(["TF mes", "TOPE mes", "SOBRE mes", "BAJO mes", "PLAN mes"]);

    STATE.tiposSemanal = tipos
      .filter(t => WEEK_SET.has(t.nombre))
      .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));

    STATE.tiposMensual = tipos
      .filter(t => MONTH_SET.has(t.nombre))
      .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
  }

  async function computeProgresoSemana() {
    const baseDate = parseISODate(dtDia.value);
    const s = startOfWeekMonday(baseDate);
    const e = endOfWeekSunday(baseDate);

    const sISO = toISODate(s);
    const eISO = toISODate(e);

    // Meta: suma compromisos semanales por vendedor en esa semana (anclados al lunes) o por rango?
    // Para no asumir: en mobile guardamos semanal anclado al lunes.
    // Para lectura, traemos la fecha del lunes de esa semana.
    const anchorISO = sISO;

    const weeklyTipoIds = STATE.tiposSemanal.map(t => t.id);
    const vendorIds = STATE.vendedores.map(v => v.id_vendedor);

    STATE.progreso = new Map();

    // 1) metas (compromisos)
    if (vendorIds.length > 0 && weeklyTipoIds.length > 0) {
      const { data: metas, error: eMeta } = await sb
        .from("compromisos")
        .select("id_vendedor, monto_comprometido")
        .eq("id_equipo", STATE.equipoId)
        .eq("id_supervisor", STATE.userId)
        .eq("fecha_compromiso", anchorISO)
        .in("id_vendedor", vendorIds)
        .in("id_tipo", weeklyTipoIds);

      if (eMeta) throw eMeta;

      const metaByVend = new Map();
      for (const r of metas || []) {
        const k = String(r.id_vendedor);
        metaByVend.set(k, (metaByVend.get(k) || 0) + Number(r.monto_comprometido || 0));
      }

      // 2) actual (ventas): suma de monto dentro de la semana, por vendedor, para tipos TOPE/SOBRE/BAJO/PLAN
      const { data: acts, error: eAct } = await sb
        .from("ventas")
        .select("id_vendedor, monto, tipo_venta, fecha_venta")
        .gte("fecha_venta", sISO)
        .lte("fecha_venta", eISO)
        .in("id_vendedor", vendorIds)
        .in("tipo_venta", ["TOPE", "SOBRE", "BAJO", "PLAN"]);

      if (eAct) throw eAct;

      const actByVend = new Map();
      for (const r of acts || []) {
        const k = String(r.id_vendedor);
        actByVend.set(k, (actByVend.get(k) || 0) + Number(r.monto || 0));
      }

      for (const v of STATE.vendedores) {
        const k = String(v.id_vendedor);
        const meta = Number(metaByVend.get(k) || 0);
        const actual = Number(actByVend.get(k) || 0);
        const pct = meta > 0 ? (actual / meta) * 100 : 0;
        STATE.progreso.set(k, { meta, actual, pct });
      }
    } else {
      for (const v of STATE.vendedores) STATE.progreso.set(String(v.id_vendedor), { meta: 0, actual: 0, pct: 0 });
    }
  }

  async function loadSheetValues(vendedorId) {
    const baseDate = parseISODate(dtDia.value);
    const weekAnchor = toISODate(startOfWeekMonday(baseDate));
    const monthAnchor = toISODate(firstOfMonth(baseDate));

    const vend = String(vendedorId);

    // semanal: TOPE/SOBRE/BAJO/PLAN en fecha_compromiso = lunes
    if (STATE.tiposSemanal.length) {
      const { data, error } = await sb
        .from("compromisos")
        .select("id_tipo, monto_comprometido")
        .eq("id_equipo", STATE.equipoId)
        .eq("id_supervisor", STATE.userId)
        .eq("id_vendedor", vend)
        .eq("fecha_compromiso", weekAnchor)
        .in("id_tipo", STATE.tiposSemanal.map(t => t.id));

      if (error) throw error;

      STATE.valuesSemanal.clear();
      for (const r of data || []) STATE.valuesSemanal.set(r.id_tipo, Number(r.monto_comprometido || 0));
    }

    // mensual: TF mes, TOPE mes, SOBRE mes, BAJO mes, PLAN mes en fecha_compromiso = día 1
    if (STATE.tiposMensual.length) {
      const { data, error } = await sb
        .from("compromisos")
        .select("id_tipo, monto_comprometido")
        .eq("id_equipo", STATE.equipoId)
        .eq("id_supervisor", STATE.userId)
        .eq("id_vendedor", vend)
        .eq("fecha_compromiso", monthAnchor)
        .in("id_tipo", STATE.tiposMensual.map(t => t.id));

      if (error) throw error;

      STATE.valuesMensual.clear();
      for (const r of data || []) STATE.valuesMensual.set(r.id_tipo, Number(r.monto_comprometido || 0));
    }

    renderSheetBody();
  }

  async function saveSheet() {
    const vendor = STATE.sheetVendedor;
    if (!vendor) return;

    btnGuardar.disabled = true;

    const baseDate = parseISODate(dtDia.value);
    const weekAnchor = toISODate(startOfWeekMonday(baseDate));
    const monthAnchor = toISODate(firstOfMonth(baseDate));

    const mode = STATE.sheetMode;
    const tipos = mode === "semanal" ? STATE.tiposSemanal : STATE.tiposMensual;
    const values = mode === "semanal" ? STATE.valuesSemanal : STATE.valuesMensual;
    const anchor = mode === "semanal" ? weekAnchor : monthAnchor;

    // Guardado sin suponer UNIQUE: buscamos si existe fila con (id_equipo,id_supervisor,id_vendedor,id_tipo,fecha_compromiso)
    // Si existe -> update por id_compromiso. Si no -> insert.
    for (const t of tipos) {
      const raw = values.get(t.id);
      const val = raw === "" || raw === null || typeof raw === "undefined" ? null : Number(raw);

      // si viene null, se guarda como 0 (evita NOT NULL numeric)
      const monto = Number.isFinite(val) ? val : 0;

      const { data: existing, error: eSel } = await sb
        .from("compromisos")
        .select("id_compromiso")
        .eq("id_equipo", STATE.equipoId)
        .eq("id_supervisor", STATE.userId)
        .eq("id_vendedor", vendor.id_vendedor)
        .eq("id_tipo", t.id)
        .eq("fecha_compromiso", anchor)
        .limit(1);

      if (eSel) {
        console.error("[Compromisos] select existing error:", eSel);
        continue;
      }

      if (existing && existing.length > 0) {
        const id_compromiso = existing[0].id_compromiso;
        const { error: eUpd } = await sb
          .from("compromisos")
          .update({ monto_comprometido: monto })
          .eq("id_compromiso", id_compromiso);
        if (eUpd) console.error("[Compromisos] update error:", eUpd);
      } else {
        const payload = {
          id_tipo: t.id,
          id_supervisor: STATE.userId,
          id_equipo: STATE.equipoId,
          id_vendedor: vendor.id_vendedor,
          fecha_compromiso: anchor,
          monto_comprometido: monto,
        };
        const { error: eIns } = await sb.from("compromisos").insert(payload);
        if (eIns) console.error("[Compromisos] insert error:", eIns);
      }
    }

    // refresca KPI
    await computeProgresoSemana();
    renderLista();

    btnGuardar.disabled = false;
    closeSheet();
  }

  // ---------- Bindings ----------
  function bindUI() {
    txtBuscar?.addEventListener("input", applyFilter);

    tabSemanal?.addEventListener("click", () => setTabs("semanal"));
    tabMensual?.addEventListener("click", () => setTabs("mensual"));

    sheet?.addEventListener("click", (e) => {
      const el = e.target;
      if (el && el.hasAttribute("data-close")) closeSheet();
    });

    btnCancelar?.addEventListener("click", closeSheet);
    btnGuardar?.addEventListener("click", saveSheet);

    btnVolver?.addEventListener("click", () => {
      window.location.href = "/views/supervisor.mobile.html";
    });

    btnSalir?.addEventListener("click", async () => {
      try { await sb.auth.signOut({ scope: "global" }); } catch {}
      window.location.replace("/index.html");
    });

    dtDia?.addEventListener("change", async () => {
      lblSemana.textContent = weekLabel(parseISODate(dtDia.value));
      await computeProgresoSemana();
      renderLista();
    });
  }

  // ---------- Bootstrap ----------
  async function bootstrap() {
    await requireSession();

    // fecha default hoy
    const todayISO = toISODate(new Date());
    dtDia.value = todayISO;
    lblSemana.textContent = weekLabel(new Date());

    STATE.equipoId = getEquipoActivo();
    await loadEquipoNombre();

    if (!STATE.equipoId) {
      listaVendedores.innerHTML = '<div class="cmp-hint">No hay equipo seleccionado. Vuelve a Supervisor y selecciona un equipo.</div>';
      return;
    }

    await loadTipos();
    await loadVendedoresEquipo();
    await computeProgresoSemana();
    renderLista();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindUI();
    try {
      await bootstrap();
    } catch (e) {
      console.error("[Compromisos] bootstrap error:", e);
      listaVendedores.innerHTML = `<div class="cmp-hint">Error: ${String(e && e.message ? e.message : e)}</div>`;
    }
  });
})();