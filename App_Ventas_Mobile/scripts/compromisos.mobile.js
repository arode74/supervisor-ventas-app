// Compromisos Mobile (solo 2 archivos) — consistente con Ventas Mobile
// - Lista todos los vendedores vigentes del equipo (aunque tengan 0 compromisos)
// - ABC pegado a la izquierda y letras deshabilitadas si no existen vendedores
// - Nombre vendedor 14px, KPIs 12px, botón Editar alineado a la derecha
// - Home: Mes (ventas total), TS (TOPE+SOBRE), Comp (TOPE+SOBRE mensual), barra %
// - Modal: Mensual (TF/SOBRE/TOPE/PLAN), Semanal (TOPE/SOBRE/BAJO/PLAN), Diario (tipos DIARIO)
// - Diario permite fecha futura (navegación por día), comentario hasta 1000 chars, dictado si existe

(async () => {
  "use strict";

  const COMMENT_MAX = 1000;

  const TEAM_KEYS = ["av_mobile_equipo_id", "av_equipo_id", "equipo_id", "id_equipo"];
  const TEAM_NAME_FALLBACK = "Los Leones 5";

  const TABLES = {
    EQUIPOS: "equipos",
    EQ_VEND: "equipo_vendedor",
    VEND: "vendedores",
    VENTAS: "ventas",
    COMP: "compromisos",
    TIPOS: "tipos_compromisos",
  };

  const $ = (s) => document.querySelector(s);

  const elLogout = $("#btn-logout");
  const elVolver = $("#btn-volver");
  const elDia = $("#dt-dia");
  const elBuscar = $("#txt-buscar");
  const elAbc = $("#abcBar");
  const elLista = $("#lista-vendedores");
  const elToast = $("#toast");

  const overlay = $("#overlay");
  const sheet = $("#sheet");
  const modalSub = $("#modalSub");

  const tabMensual = $("#tabMensual");
  const tabSemanal = $("#tabSemanal");
  const tabDiario = $("#tabDiario");

  const formMensual = $("#formMensual");
  const formSemanal = $("#formSemanal");
  const formDiario = $("#formDiario");

  const tblMensual = $("#tblMensual");
  const tblSemanal = $("#tblSemanal");
  const diarioLista = $("#diarioLista");
  const diarioAdd = $("#diarioAdd");

  const diaPrev = $("#diaPrev");
  const diaNext = $("#diaNext");
  const diaLabel = $("#diaLabel");
  const lblSemana = $("#lblSemana");

  const diarioPicker = $("#diarioPicker");
  const diarioTipoSelect = $("#diarioTipoSelect");
  const diarioTipoOk = $("#diarioTipoOk");
  const diarioTipoCancel = $("#diarioTipoCancel");

  const btnCancelar = $("#btnCancelar");

  const state = {
    sb: null,
    user: null,
    id_supervisor: null,
    id_equipo: null,
    baseDate: new Date(),

    vendedores: [],
    filtered: [],

    tipos: {
      mensual: new Map(), // nameUpper -> row
      semanal: new Map(),
      diario: [],
    },

    // aggregates
    ventasMesTotal: new Map(),   // id_vendedor -> total mes
    ventasMesByTipo: new Map(),  // id_vendedor -> {tf,tope,sobre,bajo,plan}
    ventasSemByTipo: new Map(),
    compMesByTipo: new Map(),
    compTF40Mes: new Map(), // id_vendedor -> compromiso mensual TF40 (TOPE MES + SOBRE MES)
    compSemByTipo: new Map(),

    // modal context
    modalOpen: false,
    modalVendedorId: null,
    modalVendedorNombre: "",
    activeTab: "mensual",
  };

  const MENSUAL_ROWS = [
    { key: "tf",    label: "TF",    saleTipos: ["TF"] },
    { key: "sobre", label: "SOBRE", saleTipos: ["SOBRE"] },
    { key: "tope",  label: "TOPE",  saleTipos: ["TOPE"] },
    { key: "plan",  label: "PLAN",  saleTipos: ["PLAN"] },
  ];

  const SEMANAL_ROWS = [
    { key: "tope",  label: "TOPE",  saleTipos: ["TOPE"] },
    { key: "sobre", label: "SOBRE", saleTipos: ["SOBRE"] },
    { key: "bajo",  label: "BAJO",  saleTipos: ["BAJO"] },
    { key: "plan",  label: "PLAN",  saleTipos: ["PLAN"] },
  ];

  function showToast(msg) {
    if (!elToast) return;
    elToast.textContent = msg;
    elToast.style.opacity = "1";
    setTimeout(() => (elToast.style.opacity = "0"), 1700);
  }

  function isoDate(d) {
    const x = new Date(d.getTime());
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function fmtShortDate(d) {
    const x = new Date(d.getTime());
    const dd = String(x.getDate()).padStart(2, "0");
    const mm = String(x.getMonth() + 1).padStart(2, "0");
    return `${dd}-${mm}`;
  }

  function fmtNum(n) {
    const x = Number(n || 0);
    if (!isFinite(x)) return "0";
    const isInt = Math.abs(x - Math.round(x)) < 1e-9;
    return isInt ? String(Math.round(x)) : x.toFixed(2);
  }

  function blankAgg() {
    return { tf: 0, tope: 0, sobre: 0, bajo: 0, plan: 0 };
  }

  function clampComment(s) {
    s = (s ?? "").toString();
    return s.length > COMMENT_MAX ? s.slice(0, COMMENT_MAX) : s;
  }

  function computeMonthBounds(d) {
    const dt = new Date(d.getTime());
    const monthStart = new Date(dt.getFullYear(), dt.getMonth(), 1);
    const nextMonthStart = new Date(dt.getFullYear(), dt.getMonth() + 1, 1);
    return { monthStart, nextMonthStart };
  }

  function computeWeekBoundsMon(d) {
    const dt = new Date(d.getTime());
    const day = dt.getDay(); // Sun=0..Sat=6
    const diffToMon = day === 0 ? -6 : (1 - day);
    const weekStart = new Date(dt);
    weekStart.setDate(dt.getDate() + diffToMon);
    weekStart.setHours(0, 0, 0, 0);
    const weekEndExcl = new Date(weekStart);
    weekEndExcl.setDate(weekStart.getDate() + 7);
    return { weekStart, weekEndExcl };
  }

  function getSupabase() {
    if (state.sb) return state.sb;

    const url = window.SUPABASE_URL || window.__SUPABASE_URL__ || window.env?.SUPABASE_URL;
    const key =
      window.SUPABASE_ANON_KEY ||
      window.SUPABASE_KEY ||
      window.__SUPABASE_ANON_KEY__ ||
      window.env?.SUPABASE_ANON_KEY;

    if (!url || !key || !window.supabase) {
      console.error("Supabase env no disponible (SUPABASE_URL / SUPABASE_ANON_KEY).");
      showToast("Falta configuración Supabase");
      return null;
    }

    state.sb = window.supabase.createClient(url, key);
    return state.sb;
  }

  async function requireUser(sb) {
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    state.user = data.user;
    state.id_supervisor = data.user?.id || null;
    if (!state.id_supervisor) throw new Error("No hay usuario autenticado.");
  }

  function resolveEquipoIdFromStorage() {
    for (const k of TEAM_KEYS) {
      const v = localStorage.getItem(k);
      if (v && String(v).length >= 10) return v;
    }
    return null;
  }

  async function resolveEquipoIdFallback(sb) {
    const { data, error } = await sb
      .from(TABLES.EQUIPOS)
      .select("id_equipo,nombre_equipo")
      .eq("nombre_equipo", TEAM_NAME_FALLBACK)
      .limit(1);

    if (error) throw error;
    return data?.[0]?.id_equipo || null;
  }

  async function loadVendedoresDelEquipo(sb) {
    // 1) resolve equipo_id: localStorage -> fallback por nombre_equipo "Los Leones 5"
    state.id_equipo = resolveEquipoIdFromStorage();
    if (!state.id_equipo) {
      state.id_equipo = await resolveEquipoIdFallback(sb);
    }
    if (!state.id_equipo) throw new Error("No se pudo resolver id_equipo.");

    // 2) Traer TODOS los vendedores vigentes del equipo (aunque no tengan compromisos)
    //    Vigencia: estado true + fecha_inicio <= baseDate + (fecha_fin is null OR fecha_fin >= baseDate)
    const d = isoDate(state.baseDate);

    const { data, error } = await sb
      .from(TABLES.EQ_VEND)
      .select("id_vendedor, vendedores (id_vendedor,nombre,estado)")
      .eq("id_equipo", state.id_equipo)
      .eq("estado", true)
      .lte("fecha_inicio", d)
      .or(`fecha_fin.is.null,fecha_fin.gte.${d}`);

    if (error) throw error;

    const rows = data || [];
    const mapped = rows
      .map((r) => {
        const vend = r.vendedores || {};
        return {
          id_vendedor: r.id_vendedor,
          vendedor_nombre: vend.nombre || "",
          vendedor_estado_text: (vend.estado || "ACTIVO").toString(),
        };
      })
      .sort((a, b) => a.vendedor_nombre.localeCompare(b.vendedor_nombre, "es"));

    state.vendedores = mapped;
    state.filtered = [...mapped];
  }

  async function loadTipos(sb) {
    const { data, error } = await sb
      .from(TABLES.TIPOS)
      .select("id,supervisor_id,nombre,activo,visible_para_todos,periodo,orden")
      .eq("activo", true)
      .order("orden", { ascending: true, nullsFirst: false });

    if (error) throw error;

    const mensual = new Map();
    const semanal = new Map();
    const diario = [];

    for (const t of data || []) {
      const per = (t.periodo || "DIARIO").toString().trim().toUpperCase();
      const name = (t.nombre || "").toString().trim().toUpperCase();

      if (per === "MENSUAL") mensual.set(name, t);
      else if (per === "SEMANAL") semanal.set(name, t);
      else diario.push(t);
    }

    state.tipos = { mensual, semanal, diario };
  }

  function tipoId(scope, labelUpper) {
    const m = state.tipos?.[scope];
    if (!(m instanceof Map)) return null;
    return m.get(labelUpper)?.id || null;
  }

  async function loadVentasMesTotal(sb, monthStart, monthEndExcl) {
    state.ventasMesTotal = new Map();

    const ids = state.vendedores.map((v) => v.id_vendedor);
    if (!ids.length) return;

    const { data, error } = await sb
      .from(TABLES.VENTAS)
      .select("id_vendedor,monto,fecha_venta")
      .in("id_vendedor", ids)
      .gte("fecha_venta", isoDate(monthStart))
      .lt("fecha_venta", isoDate(monthEndExcl));

    if (error) throw error;

    const m = new Map();
    for (const r of data || []) {
      const id = r.id_vendedor;
      const v = Number(r.monto || 0);
      m.set(id, (m.get(id) || 0) + v);
    }
    state.ventasMesTotal = m;
  }

  async function loadVentasAggByTipo(sb, fromDate, toDateExcl, rowsDef, destMap) {
    destMap.clear();

    const ids = state.vendedores.map((v) => v.id_vendedor);
    if (!ids.length) return;

    const { data, error } = await sb
      .from(TABLES.VENTAS)
      .select("id_vendedor,tipo_venta,monto,fecha_venta")
      .in("id_vendedor", ids)
      .gte("fecha_venta", isoDate(fromDate))
      .lt("fecha_venta", isoDate(toDateExcl));

    if (error) throw error;

    const tipo2key = new Map();
    for (const r of rowsDef) for (const t of r.saleTipos) tipo2key.set(String(t).toUpperCase(), r.key);

    for (const row of data || []) {
      const k = tipo2key.get(String(row.tipo_venta || "").toUpperCase());
      if (!k) continue;
      const cur = destMap.get(row.id_vendedor) || blankAgg();
      cur[k] += Number(row.monto || 0);
      destMap.set(row.id_vendedor, cur);
    }
  }

  async function loadCompAggByTipo(sb, fromDate, toDateExcl, scope, rowsDef, destMap) {
    destMap.clear();

    const ids = state.vendedores.map((v) => v.id_vendedor);
    if (!ids.length) return;

    const tipoIds = [];
    const id2key = new Map();

    for (const r of rowsDef) {
      const tid = tipoId(scope, r.label.toUpperCase());
      if (tid) {
        tipoIds.push(tid);
        id2key.set(tid, r.key);
      }
    }

    if (!tipoIds.length) return;

    const { data, error } = await sb
      .from(TABLES.COMP)
      .select("id_vendedor,id_tipo,monto_comprometido,fecha_compromiso")
      .in("id_vendedor", ids)
      .in("id_tipo", tipoIds)
      .gte("fecha_compromiso", isoDate(fromDate))
      .lt("fecha_compromiso", isoDate(toDateExcl));

    if (error) throw error;

    for (const row of data || []) {
      const k = id2key.get(row.id_tipo);
      if (!k) continue;
      const cur = destMap.get(row.id_vendedor) || blankAgg();
      cur[k] += Number(row.monto_comprometido || 0);
      destMap.set(row.id_vendedor, cur);
    }
  }
  function _normKey(s) {
    return (s || "").toString().trim().toUpperCase().replace(/\s+/g, " ");
  }

  function tipoIdMensualByName(nameUpper) {
    const m = state.tipos?.mensual;
    if (!(m instanceof Map)) return null;
    const wanted = _normKey(nameUpper);
    // exact
    if (m.has(wanted)) return m.get(wanted)?.id || null;
    // fallback: match by normalized key
    for (const [k, row] of m.entries()) {
      if (_normKey(k) === wanted) return row?.id || null;
    }
    return null;
  }

  async function loadCompTF40Mes(sb, monthStart) {
    state.compTF40Mes.clear();

    const ids = state.vendedores.map((v) => v.id_vendedor);
    if (!ids.length) return;

    // Tipos: TOPE MES + SOBRE MES (desde tipos_compromisos periodo MENSUAL)
    const idTopeMes = tipoIdMensualByName("TOPE MES");
    const idSobreMes = tipoIdMensualByName("SOBRE MES");

    const tipoIds = [idTopeMes, idSobreMes].filter(Boolean);
    if (!tipoIds.length) return;

    const dayEndExcl = new Date(monthStart);
    dayEndExcl.setDate(dayEndExcl.getDate() + 1);

    let q = sb
      .from(TABLES.COMP)
      .select("id_vendedor,id_tipo,monto_comprometido,fecha_compromiso")
      .in("id_vendedor", ids)
      .in("id_tipo", tipoIds)
      .gte("fecha_compromiso", isoDate(monthStart))
      .lt("fecha_compromiso", isoDate(dayEndExcl));

    // Asegurar equipo + supervisor (evita mezclar compromisos de otros equipos)
    if (state.id_equipo) q = q.eq("id_equipo", state.id_equipo);
    if (state.id_supervisor) q = q.eq("id_supervisor", state.id_supervisor);

    const { data, error } = await q;
    if (error) throw error;

    for (const row of data || []) {
      const cur = Number(state.compTF40Mes.get(row.id_vendedor) || 0);
      state.compTF40Mes.set(row.id_vendedor, cur + Number(row.monto_comprometido || 0));
    }
  }


  function computeTS(aggMap, vendorId) {
    const a = aggMap.get(vendorId) || blankAgg();
    return Number(a.tope || 0) + Number(a.sobre || 0);
  }

  function buildAbcBar() {
    if (!elAbc) return;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    elAbc.innerHTML = letters.map((c) => `<button type="button" class="ventas-abc__btn" data-c="${c}">${c}</button>`).join("");

    // disabled letters with no vendors
    const present = new Set(
      state.vendedores
        .map((v) => (v.vendedor_nombre || "").trim().toUpperCase().slice(0, 1))
        .filter(Boolean)
    );
    elAbc.querySelectorAll("button[data-c]").forEach((b) => {
      const c = b.getAttribute("data-c");
      if (!present.has(c)) b.classList.add("is-off");
    });

    elAbc.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-c]");
      if (!b) return;
      if (b.classList.contains("is-off")) return;
      const c = b.getAttribute("data-c");
      const idx = state.filtered.findIndex((v) => (v.vendedor_nombre || "").toUpperCase().startsWith(c));
      if (idx >= 0) {
        const el = elLista.querySelector(`[data-idx="${idx}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function applyFilter() {
    const q = (elBuscar?.value || "").toString().trim().toUpperCase();
    if (!q) state.filtered = [...state.vendedores];
    else state.filtered = state.vendedores.filter((v) => (v.vendedor_nombre || "").toUpperCase().includes(q));
  }

  function renderList() {
    elLista.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (let i = 0; i < state.filtered.length; i++) {
      const v = state.filtered[i];

      const ventasTS = computeTS(state.ventasMesByTipo, v.id_vendedor);
      const compTF40 = Number(state.compTF40Mes.get(v.id_vendedor) || 0);

      const pct = compTF40 > 0 ? Math.max(0, Math.min(100, Math.round((ventasTS / compTF40) * 100))) : 0;

      const inactive = v.vendedor_estado_text && v.vendedor_estado_text.toUpperCase() !== "ACTIVO";
      const nombre = (v.vendedor_nombre || "—").toString();
      const initials = nombre.trim() ? nombre.trim().slice(0, 1).toUpperCase() : "—";

      const row = document.createElement("article");
      row.className = "v-card cmp-card";
      row.dataset.idx = String(i);
      row.dataset.vid = v.id_vendedor;

      row.innerHTML = `
        <div class="v-row">
          <div class="v-avatar" aria-hidden="true">${initials}</div>

          <button class="v-namebtn" type="button" data-action="edit">
            <span class="${inactive ? "is-disabled" : ""}">${nombre}</span>
          </button>

          <button class="v-plus cmp-edit" type="button" aria-label="Editar" title="Editar">✎</button>
        </div>

        <div class="cmp-line2">
          <span class="cmp-k">TF40</span><span class="cmp-v">${fmtNum(compTF40)}</span>
          <span class="cmp-sep">|</span>
          <span class="cmp-k">TS</span><span class="cmp-v">${fmtNum(ventasTS)}</span>
        </div>

        <div class="cmp-progress" aria-label="Cumplimiento mensual (TS / TF40)">
          <div class="cmp-bar" style="width:${pct}%"></div>
          <div class="cmp-pct">${pct}%</div>
        </div>
      `;

      row.querySelector(".cmp-edit")?.addEventListener("click", () => openModal(v.id_vendedor, nombre));
      row.querySelector('[data-action="edit"]')?.addEventListener("click", () => openModal(v.id_vendedor, nombre));
      frag.appendChild(row);
    }

    elLista.appendChild(frag);
  }

  function showTab(name) {
    state.activeTab = name;

    tabMensual?.classList.toggle("active", name === "mensual");
    tabSemanal?.classList.toggle("active", name === "semanal");
    tabDiario?.classList.toggle("active", name === "diario");

    if (formMensual) formMensual.style.display = name === "mensual" ? "" : "none";
    if (formSemanal) formSemanal.style.display = name === "semanal" ? "" : "none";
    if (formDiario) formDiario.style.display = name === "diario" ? "" : "none";
  }

  function openSheet() {
    overlay.style.display = "";
    sheet.style.transform = "translateY(0)";
    state.modalOpen = true;
  }

  function closeSheet() {
    overlay.style.display = "none";
    sheet.style.transform = "translateY(110%)";
    state.modalOpen = false;
    diarioPicker.style.display = "none";
  }

  function updateModalHeader() {
    if (modalSub) modalSub.textContent = state.modalVendedorNombre || "";
  }

  function updateDayUI() {
    if (diaLabel) diaLabel.textContent = isoDate(state.baseDate);

    const { weekStart, weekEndExcl } = computeWeekBoundsMon(state.baseDate);
    const weekEndIncl = new Date(weekEndExcl.getTime());
    weekEndIncl.setDate(weekEndExcl.getDate() - 1);
    if (lblSemana) lblSemana.textContent = `${fmtShortDate(weekStart)} - ${fmtShortDate(weekEndIncl)}`;
  }

  function renderAggTable(container, ventasAggMap, compAggMap, rowsDef, onEdit) {
    if (!container) return;
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "cmp-tr";
    head.innerHTML = `
      <div class="cmp-th">Tipo</div>
      <div class="cmp-th">Lleva</div>
      <div class="cmp-th">Compromiso</div>
    `;
    container.appendChild(head);

    const vId = state.modalVendedorId;
    const ventas = ventasAggMap.get(vId) || blankAgg();
    const comp = compAggMap.get(vId) || blankAgg();

    for (const r of rowsDef) {
      const tr = document.createElement("div");
      tr.className = "cmp-tr";
      tr.innerHTML = `
        <div class="cmp-tag">${r.label}</div>
        <div class="cmp-cell"><strong>${fmtNum(ventas[r.key])}</strong></div>
        <div class="cmp-cell">
          <input class="m-input cmp-input" type="number" min="0" step="1" value="${fmtNum(comp[r.key])}" data-key="${r.key}"/>
        </div>
      `;
      const inp = tr.querySelector("input");
      inp.addEventListener("change", () => onEdit(r.key, Number(inp.value || 0)));
      container.appendChild(tr);
    }
  }

  async function upsertComp(scope, key, value) {
    const sb = state.sb;

    const rows = scope === "mensual" ? MENSUAL_ROWS : SEMANAL_ROWS;
    const label = (rows.find((r) => r.key === key)?.label || "").toUpperCase();
    const tid = tipoId(scope, label);
    if (!tid) return showToast("Tipo no configurado");

    // fecha ancla
    const d = new Date(state.baseDate.getTime());
    const { monthStart } = computeMonthBounds(d);
    const { weekStart } = computeWeekBoundsMon(d);
    const fecha = scope === "mensual" ? isoDate(monthStart) : isoDate(weekStart);

    const id_vendedor = state.modalVendedorId;
    const id_equipo = state.id_equipo;
    const id_supervisor = state.id_supervisor;

    // delete + insert
    const del = await sb
      .from(TABLES.COMP)
      .delete()
      .eq("id_vendedor", id_vendedor)
      .eq("id_equipo", id_equipo)
      .eq("id_supervisor", id_supervisor)
      .eq("id_tipo", tid)
      .eq("fecha_compromiso", fecha);

    if (del.error) console.warn("delete compromiso", del.error);

    if (value > 0) {
      const ins = await sb.from(TABLES.COMP).insert({
        id_tipo: tid,
        id_supervisor,
        id_equipo,
        id_vendedor,
        fecha_compromiso: fecha,
        monto_comprometido: value,
        cumplido: false,
      });
      if (ins.error) {
        console.error("insert compromiso", ins.error);
        showToast("Error guardando");
      } else {
        showToast("Guardado");
      }
    } else {
      showToast("Guardado");
    }
  }

  function speechAvailable() {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  }

  function startDictation(onText, onDone) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return onDone?.();
    const rec = new SR();
    rec.lang = "es-CL";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const txt = e.results?.[0]?.[0]?.transcript ?? "";
      onText?.(clampComment(txt));
    };
    rec.onerror = () => {};
    rec.onend = () => onDone?.();
    rec.start();
  }

  async function loadDiario(sb) {
    if (!diarioLista) return;
    const dia = isoDate(state.baseDate);
    const id_vendedor = state.modalVendedorId;

    const tipos = (state.tipos.diario || []).filter((t) => t.visible_para_todos || t.supervisor_id === state.id_supervisor);

    const { data, error } = await sb
      .from(TABLES.COMP)
      .select("id_compromiso,id_tipo,monto_comprometido,comentario,fecha_compromiso")
      .eq("id_vendedor", id_vendedor)
      .eq("id_equipo", state.id_equipo)
      .eq("id_supervisor", state.id_supervisor)
      .eq("fecha_compromiso", dia);

    if (error) {
      console.error("loadDiario", error);
      diarioLista.innerHTML = '<div class="m-mini" style="opacity:.75;font-weight:900">Error cargando diario.</div>';
      return;
    }

    const byTipo = new Map();
    for (const r of data || []) byTipo.set(r.id_tipo, r);

    diarioLista.innerHTML = "";
    for (const t of tipos) {
      const row = byTipo.get(t.id);
      const amt = Number(row?.monto_comprometido || 0);
      const com = clampComment(row?.comentario || "");

      const el = document.createElement("div");
      el.className = "cmp-drow";
      el.innerHTML = `
        <div class="cmp-dtop">
          <div class="cmp-dname">${t.nombre}</div>
          <input class="m-input cmp-damt" type="number" min="0" step="1" value="${fmtNum(amt)}" data-tipo="${t.id}"/>
        </div>
        <div class="cmp-dcom-wrap">
          <textarea class="m-input cmp-dcom" maxlength="${COMMENT_MAX}" rows="2" placeholder="Comentario (máx. ${COMMENT_MAX})">${com}</textarea>
          <button class="m-icbtn cmp-mic" type="button" title="Dictar" ${speechAvailable() ? "" : "disabled"}>🎙️</button>
        </div>
        <div class="m-mini cmp-counter">${com.length} / ${COMMENT_MAX}</div>
      `;

      const inp = el.querySelector(".cmp-damt");
      const ta = el.querySelector(".cmp-dcom");
      const mic = el.querySelector(".cmp-mic");
      const counter = el.querySelector(".cmp-counter");

      ta.addEventListener("input", () => {
        ta.value = clampComment(ta.value);
        counter.textContent = `${ta.value.length} / ${COMMENT_MAX}`;
      });

      mic.addEventListener("click", () => {
        mic.disabled = true;
        startDictation(
          (txt) => {
            ta.value = clampComment(txt);
            counter.textContent = `${ta.value.length} / ${COMMENT_MAX}`;
          },
          () => (mic.disabled = false)
        );
      });

      inp.addEventListener("change", async () => {
        await saveDiarioLine(sb, t.id, Number(inp.value || 0), ta.value);
      });
      ta.addEventListener("blur", async () => {
        await saveDiarioLine(sb, t.id, Number(inp.value || 0), ta.value);
      });

      diarioLista.appendChild(el);
    }
  }

  async function saveDiarioLine(sb, tipoId_, value, comentario) {
    const dia = isoDate(state.baseDate);
    const id_vendedor = state.modalVendedorId;
    const id_equipo = state.id_equipo;
    const id_supervisor = state.id_supervisor;

    comentario = clampComment(comentario);

    const del = await sb
      .from(TABLES.COMP)
      .delete()
      .eq("id_vendedor", id_vendedor)
      .eq("id_equipo", id_equipo)
      .eq("id_supervisor", id_supervisor)
      .eq("id_tipo", tipoId_)
      .eq("fecha_compromiso", dia);

    if (del.error) console.warn("delete diario", del.error);

    if (value > 0 || (comentario && comentario.trim().length)) {
      const ins = await sb.from(TABLES.COMP).insert({
        id_tipo: tipoId_,
        id_supervisor,
        id_equipo,
        id_vendedor,
        fecha_compromiso: dia,
        monto_comprometido: value || 0,
        comentario,
        cumplido: false,
      });
      if (ins.error) console.error("insert diario", ins.error);
    }
  }

  function openTipoPicker() {
    const tipos = (state.tipos.diario || []).filter((t) => t.visible_para_todos || t.supervisor_id === state.id_supervisor);
    diarioTipoSelect.innerHTML = tipos.map((t) => `<option value="${t.id}">${t.nombre}</option>`).join("");
    diarioPicker.style.display = "";
  }

  async function addTipoToDiario() {
    // La UI ya lista todos los tipos diarios. Mantemos el flujo del botón + por UX.
    diarioPicker.style.display = "none";
    showToast("Listo");
  }

  async function openModal(id_vendedor, nombre) {
    state.modalVendedorId = id_vendedor;
    state.modalVendedorNombre = nombre || "";
    updateModalHeader();
    updateDayUI();

    renderAggTable(tblMensual, state.ventasMesByTipo, state.compMesByTipo, MENSUAL_ROWS, async (key, val) => {
      await upsertComp("mensual", key, val);
      await refreshAgg();
      renderAggTable(tblMensual, state.ventasMesByTipo, state.compMesByTipo, MENSUAL_ROWS, async (k, v) => upsertComp("mensual", k, v));
    });

    renderAggTable(tblSemanal, state.ventasSemByTipo, state.compSemByTipo, SEMANAL_ROWS, async (key, val) => {
      await upsertComp("semanal", key, val);
      await refreshAgg();
      renderAggTable(tblSemanal, state.ventasSemByTipo, state.compSemByTipo, SEMANAL_ROWS, async (k, v) => upsertComp("semanal", k, v));
    });

    await loadDiario(state.sb);

    showTab(state.activeTab);
    openSheet();
  }

  async function refreshAgg() {
    const sb = state.sb;

    await loadTipos(sb);

    const { monthStart, nextMonthStart } = computeMonthBounds(state.baseDate);
    const { weekStart, weekEndExcl } = computeWeekBoundsMon(state.baseDate);

    await Promise.all([
      loadVentasMesTotal(sb, monthStart, nextMonthStart),
      loadVentasAggByTipo(sb, monthStart, nextMonthStart, MENSUAL_ROWS, state.ventasMesByTipo),
      loadVentasAggByTipo(sb, weekStart, weekEndExcl, SEMANAL_ROWS, state.ventasSemByTipo),
      loadCompAggByTipo(sb, monthStart, nextMonthStart, "mensual", MENSUAL_ROWS, state.compMesByTipo),
      loadCompAggByTipo(sb, weekStart, weekEndExcl, "semanal", SEMANAL_ROWS, state.compSemByTipo),
    ]);
  }

  function wireEvents() {
    elBuscar?.addEventListener("input", () => {
      applyFilter();
      renderList();
    });

    elDia?.addEventListener("change", async () => {
      const v = elDia.value;
      if (v) state.baseDate = new Date(v + "T00:00:00");
      await refreshAgg();
      applyFilter();
      renderList();
      if (state.modalOpen) {
        updateDayUI();
        await loadDiario(state.sb);
      }
    });

    tabMensual?.addEventListener("click", () => showTab("mensual"));
    tabSemanal?.addEventListener("click", () => showTab("semanal"));
    tabDiario?.addEventListener("click", async () => {
      showTab("diario");
      await loadDiario(state.sb);
    });

    diaPrev?.addEventListener("click", async () => {
      state.baseDate.setDate(state.baseDate.getDate() - 1);
      if (elDia) elDia.value = isoDate(state.baseDate);
      updateDayUI();
      await refreshAgg();
      applyFilter();
      renderList();
      if (state.modalOpen) await loadDiario(state.sb);
    });

    diaNext?.addEventListener("click", async () => {
      state.baseDate.setDate(state.baseDate.getDate() + 1);
      if (elDia) elDia.value = isoDate(state.baseDate);
      updateDayUI();
      await refreshAgg();
      applyFilter();
      renderList();
      if (state.modalOpen) await loadDiario(state.sb);
    });

    diarioAdd?.addEventListener("click", () => openTipoPicker());
    diarioTipoCancel?.addEventListener("click", () => (diarioPicker.style.display = "none"));
    diarioTipoOk?.addEventListener("click", async () => {
      await addTipoToDiario();
    });

    btnCancelar?.addEventListener("click", closeSheet);
    overlay?.addEventListener("click", closeSheet);

    elVolver?.addEventListener("click", () => history.back());

    elLogout?.addEventListener("click", async () => {
      try {
        await state.sb.auth.signOut();
      } catch {}
      location.href = "/index.html";
    });
  }

  // Minimal CSS glue (keeps same base, but ensures sizes/alignments match requirements)
  (function injectCss() {
    const css = `
    .cmp-item{padding:12px 12px 10px 12px}
    .cmp-line1{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .cmp-vname{font-size:14px;font-weight:900;letter-spacing:.1px}
    .cmp-vname.is-disabled{opacity:.45}
    .cmp-line2{margin-top:6px;font-size:12px;font-weight:800;opacity:.95}
    .cmp-k{opacity:.75;margin-right:6px}
    .cmp-v{opacity:1}
    .cmp-sep{opacity:.35;margin:0 8px}
    .cmp-progress{position:relative;height:10px;border-radius:10px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:8px}
    .cmp-bar{height:100%;border-radius:10px;background:rgba(255,255,255,.65)}
    .cmp-pct{position:absolute;right:6px;top:-18px;font-size:11px;font-weight:900;opacity:.85}
    .m-mini-btn.cmp-edit{margin-left:auto}
    .ventas-abc__btn.is-off{opacity:.25}
    .cmp-table{display:flex;flex-direction:column;gap:8px}
    .cmp-tr{display:grid;grid-template-columns:1.1fr .9fr 1.2fr;gap:8px;align-items:center}
    .cmp-th{font-size:12px;font-weight:900;opacity:.7}
    .cmp-tag{font-size:12px;font-weight:900}
    .cmp-cell{font-size:12px}
    .cmp-input{height:38px}
    .cmp-daynav{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px}
    .cmp-diario{display:flex;flex-direction:column;gap:10px;padding-bottom:64px}
    .cmp-drow{padding:10px;border-radius:14px;background:rgba(255,255,255,.08)}
    .cmp-dtop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .cmp-dname{font-size:12px;font-weight:900;opacity:.95}
    .cmp-damt{width:110px}
    .cmp-dcom-wrap{display:flex;gap:10px;align-items:flex-start}
    .cmp-dcom{flex:1;min-height:44px}
    .cmp-mic{width:44px}
    .m-fab{position:sticky;bottom:12px;margin-left:auto;display:block;width:54px;height:54px;border-radius:999px}
    .cmp-picker{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:16px}
    .cmp-picker__card{width:min(520px,100%);background:rgba(20,20,20,.92);border-radius:18px;padding:14px}
    .cmp-picker__actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  async function boot() {
    try {
      const sb = getSupabase();
      if (!sb) return;
      state.sb = sb;

      // date default
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      state.baseDate = today;
      if (elDia) elDia.value = isoDate(today);

      wireEvents();

      await requireUser(sb);
      await loadVendedoresDelEquipo(sb);
      buildAbcBar();

      await refreshAgg();

      applyFilter();
      renderList();
    } catch (e) {
      console.error(e);
      showToast("Error cargando datos");
    }
  }

  boot();

})();