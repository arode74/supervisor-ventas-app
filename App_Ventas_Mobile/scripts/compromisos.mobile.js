// compromisos.mobile.js
// VERSION: 2026-02-26 TF40 + BARRA + ABC + BOTON "+" (match Ventas)
(() => {
  "use strict";
  console.log("[compromisos.mobile] TF40 + BARRA + SHEET v20 (fechas desde dt-dia: mensual+semanal)");

  const $ = (s) => document.querySelector(s);

  const elDia = $("#dt-dia");
  const elBuscar = $("#txt-buscar");
  const elLista = $("#lista-vendedores");
  const elAbc = $("#abcBar");

  if (!elLista) return;

  // Supabase
  function ensureSb() {
    // prefer client created by config.js if exists
    if (window.sb && typeof window.sb.from === "function") return window.sb;
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") return window.supabaseClient;

    const url = window.__ENV__?.SUPABASE_URL || window.SUPABASE_URL;
    const key = window.__ENV__?.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase no inicializado.");
    if (!window.supabase?.createClient) throw new Error("supabase-js no cargado.");
    window.sb = window.supabase.createClient(url, key);
    return window.sb;
  }
  const sb = ensureSb();

  // Helpers
  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const getFirstLetter = (nombre) => {
    const n = norm(nombre);
    if (!n) return "#";
    const L = n.charAt(0).toUpperCase();
    return (L >= "A" && L <= "Z") ? L : "#";
  };

  function setDefaultDate() {
    if (elDia && !elDia.value) elDia.value = new Date().toISOString().slice(0, 10);
  }

  function monthRange() {
    const v = (elDia?.value || new Date().toISOString().slice(0, 10));
    const [yy, mm] = v.split("-").map(n => parseInt(n, 10));
    const start = new Date(Date.UTC(yy, mm - 1, 1));
    const end = new Date(Date.UTC(yy, mm, 0, 23, 59, 59));
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  // Equipo
  const TEAM_KEYS = ["av_mobile_equipo_id","av_equipo_id","equipo_id","id_equipo","APPVENTAS_ID_EQUIPO","APPVENTAS_EQUIPO_ID"];
  const getEquipoId = () => {
    for (const k of TEAM_KEYS) {
      const v = localStorage.getItem(k);
      if (v && String(v).trim()) return String(v).trim();
    }
    return null;
  };

  // Data
  let vendedores = [];
  let metricsById = new Map(); // id -> { ventas, comp }

  async function loadVendedores() {
    const equipoId = getEquipoId();
    const fecha = elDia.value;

    const { data, error } = await sb
      .from("equipo_vendedor")
      .select("id_vendedor, vendedores!inner(nombre)")
      .eq("id_equipo", equipoId)
      .eq("estado", true)
      .lte("fecha_inicio", fecha)
      .or(`fecha_fin.is.null,fecha_fin.gte.${fecha}`)
      .order("vendedores(nombre)", { ascending: true });

    if (error) throw error;
    return (data || []).map(r => ({ id: r.id_vendedor, nombre: r.vendedores?.nombre || "" }));
  }

  async function loadMetrics(ids) {
    const { start, end } = monthRange();
    const map = new Map();
    ids.forEach(id => map.set(id, { ventas: 0, comp: 0 }));

    // Ventas TF40 (COUNT)
    const { data: ventas, error: errV } = await sb
      .from("ventas")
      .select("id_vendedor,tipo_venta,fecha_venta")
      .in("id_vendedor", ids)
      .in("tipo_venta", ["SOBRE","TOPE"])
      .gte("fecha_venta", start)
      .lte("fecha_venta", end);
    if (errV) throw errV;

    (ventas || []).forEach(v => {
      const m = map.get(v.id_vendedor);
      if (m) m.ventas += 1;
    });

    // Tipos compromiso TF40
    const { data: tipos, error: errT } = await sb
      .from("tipos_compromisos")
      .select("id")
      .in("nombre", ["TOPE MES","SOBRE MES"]);
    if (errT) throw errT;

    const tipoIds = (tipos || []).map(t => t.id);

    // Compromisos TF40 (SUM)
    if (tipoIds.length) {
      const { data: comps, error: errC } = await sb
        .from("compromisos")
        .select("id_vendedor,id_tipo,fecha_compromiso,monto_comprometido")
        .in("id_vendedor", ids)
        .in("id_tipo", tipoIds)
        .gte("fecha_compromiso", start)
        .lte("fecha_compromiso", end);
      if (errC) throw errC;

      (comps || []).forEach(c => {
        const m = map.get(c.id_vendedor);
        if (m) m.comp += Number(c.monto_comprometido || 0);
      });
    }

    return map;
  }

  const pct = (ventas, comp) => {
    const v = Number(ventas || 0);
    const c = Number(comp || 0);
    if (c <= 0) return 0;
    return Math.max(0, Math.min(100, (v / c) * 100));
  };

  // ===== Bottom Sheet Compromisos (creación dinámica) =====
  function ensureSheetDom(){
    let sheet = document.getElementById("cmpSheet");
    if (sheet) return sheet;

    sheet = document.createElement("div");
    sheet.id = "cmpSheet";
    sheet.className = "cmp-sheet";
    sheet.setAttribute("aria-hidden","true");
    sheet.innerHTML = `
      <div class="cmp-sheet__backdrop" data-cmp-close="1"></div>
      <div class="cmp-sheet__panel" role="dialog" aria-modal="true" aria-label="Compromisos">
        <div class="cmp-sheet__header">
          <div class="cmp-sheet__title">Compromisos</div>
          <button class="cmp-sheet__close" type="button" data-cmp-close="1" aria-label="Cerrar">×</button>
        </div>
        <div id="cmpSheetVendedor" class="cmp-sheet__vendedor">—</div>

        <div class="cmp-tabs" role="tablist" aria-label="Periodo">
          <button type="button" class="cmp-tab is-active" data-cmp-tab="mensual" role="tab" aria-selected="true">Mensual</button>
          <button type="button" class="cmp-tab" data-cmp-tab="semanal" role="tab" aria-selected="false">Semanal</button>
          <button type="button" class="cmp-tab" data-cmp-tab="diario" role="tab" aria-selected="false">Diario</button>
        </div>

        <div class="cmp-sheet__body">
          <section class="cmp-pane is-active" data-cmp-pane="mensual" role="tabpanel">
            <div class="cmp-grid">
              <div class="cmp-row cmp-row--head">
                <div class="cmp-label"></div>
                <div class="cmp-colhead">Compromiso</div>
                <div class="cmp-colhead">Venta</div>
              </div>

              <div class="cmp-row">
                <div class="cmp-label">Tope</div>
                <input id="cmpMensualTope" class="cmp-input" inputmode="numeric" placeholder="0"/>
                <div id="cmpMensualVentaTope" class="cmp-venta" style="font-weight:400;">0</div>
              </div>

              <div class="cmp-row">
                <div class="cmp-label">Sobre</div>
                <input id="cmpMensualSobre" class="cmp-input" inputmode="numeric" placeholder="0"/>
                <div id="cmpMensualVentaSobre" class="cmp-venta" style="font-weight:400;">0</div>
              </div>

              <div class="cmp-row">
                <div class="cmp-label">TF</div>
                <input id="cmpMensualTF" class="cmp-input" inputmode="numeric" placeholder="0"/>
                <div id="cmpMensualVentaTF" class="cmp-venta" style="font-weight:400;">0</div>
              </div>

              <div class="cmp-row">
                <div class="cmp-label">Plan</div>
                <input id="cmpMensualPlan" class="cmp-input" inputmode="numeric" placeholder="0"/>
                <div id="cmpMensualVentaPlan" class="cmp-venta" style="font-weight:400;">0</div>
              </div>
            </div>

            <div class="cmp-actions">
              <button id="cmpMensualGuardar" class="mobile-btn mobile-btn--primary" type="button">Guardar</button>
            </div>
          </section>

          <section class="cmp-pane" data-cmp-pane="semanal" role="tabpanel">
            <div class="cmp-grid">
              <div class="cmp-row cmp-row--head">
                <div class="cmp-label"></div>
                <div class="cmp-colhead">Compromiso</div>
                <div class="cmp-colhead">Venta</div>
              </div>

              <div class="cmp-row">
                <div class="cmp-label">Tope</div>
                <input id="cmpSemanalTope" class="cmp-input" inputmode="numeric" placeholder="0"/>
                <div id="cmpSemanalVentaTope" class="cmp-venta" style="font-weight:400;">0</div>
              </div>

              <div class="cmp-row">
                <div class="cmp-label">Sobre</div>
                <input id="cmpSemanalSobre" class="cmp-input" inputmode="numeric" placeholder="0"/>
                <div id="cmpSemanalVentaSobre" class="cmp-venta" style="font-weight:400;">0</div>
              </div>

              <div class="cmp-row">
                <div class="cmp-label">Bajo</div>
                <input id="cmpSemanalBajo" class="cmp-input" inputmode="numeric" placeholder="0"/>
                <div id="cmpSemanalVentaBajo" class="cmp-venta" style="font-weight:400;">0</div>
              </div>

              <div class="cmp-row">
                <div class="cmp-label">Plan</div>
                <input id="cmpSemanalPlan" class="cmp-input" inputmode="numeric" placeholder="0"/>
                <div id="cmpSemanalVentaPlan" class="cmp-venta" style="font-weight:400;">0</div>
              </div>
            </div>

            <div class="cmp-actions">
              <button id="cmpSemanalGuardar" class="mobile-btn mobile-btn--primary" type="button">Guardar</button>
            </div>
          </section>

          <section class="cmp-pane" data-cmp-pane="diario" role="tabpanel">
            <div class="cmp-placeholder">Pendiente: UI diaria.</div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(sheet);
    ensureSheetStyles();
    wireSheetEvents(sheet);
    return sheet;
  }

  function ensureSheetStyles(){
    if (document.getElementById("cmpSheetStyles")) return;
    const st = document.createElement("style");
    st.id = "cmpSheetStyles";
    st.textContent = `
      .page-compromisos .cmp-sheet{position:fixed;inset:0;z-index:9999;display:none}
      .page-compromisos .cmp-sheet.is-open{display:block}
      .page-compromisos .cmp-sheet__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.35)}
      .page-compromisos .cmp-sheet__panel{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:18px 18px 0 0;padding:14px 14px 18px;max-height:85vh;overflow:auto;transform:translateY(100%);transition:transform .18s ease-out}
      .page-compromisos .cmp-sheet.is-open .cmp-sheet__panel{transform:translateY(0)}
      .page-compromisos .cmp-sheet__header{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .page-compromisos .cmp-sheet__title{font-size:18px;font-weight:800}
      .page-compromisos .cmp-sheet__close{width:34px;height:34px;border-radius:10px;border:1px solid rgba(0,0,0,.10);background:rgba(0,0,0,.03);font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center}
      .page-compromisos .cmp-sheet__vendedor{margin-top:8px;font-size:14px;font-weight:700;color:#0f172a}
      .page-compromisos .cmp-tabs{margin-top:12px;display:flex;gap:8px}
      .page-compromisos .cmp-tab{flex:1;padding:10px 8px;border-radius:12px;border:1px solid rgba(18,59,109,.18);background:rgba(18,59,109,.06);font-weight:800;font-size:13px}
      .page-compromisos .cmp-tab.is-active{background:rgba(18,59,109,.14);border-color:rgba(18,59,109,.28)}
      .page-compromisos .cmp-pane{display:none;padding-top:12px}
      .page-compromisos .cmp-pane.is-active{display:block}
      .page-compromisos .cmp-grid{display:flex;flex-direction:column;gap:10px}
      .page-compromisos .cmp-row{display:grid;grid-template-columns:1fr 120px 72px;gap:10px;align-items:center}
      .page-compromisos .cmp-row--head{margin-bottom:2px}
      .page-compromisos .cmp-colhead{font-weight:900;font-size:12px;color:rgba(15,23,42,.75);text-align:right}
      .page-compromisos .cmp-venta{height:38px;display:flex;align-items:center;justify-content:flex-end;padding:0 10px;border-radius:12px;background:rgba(0,0,0,.04);font-weight:900;color:#0f172a}
      .page-compromisos .cmp-label{font-weight:800;color:#0f172a}
      .page-compromisos .cmp-input{height:38px;border-radius:12px;border:1px solid rgba(0,0,0,.12);padding:0 10px;font-weight:800;text-align:right;background:#fff}
      .page-compromisos .cmp-actions{margin-top:14px;display:flex;justify-content:flex-end}
      .page-compromisos .cmp-placeholder{padding:12px;border-radius:12px;background:rgba(0,0,0,.04);color:rgba(15,23,42,.75);font-weight:700}
    `;
    document.head.appendChild(st);
  }

  function wireSheetEvents(sheet){
    sheet.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-cmp-close='1']")) setSheetOpen(false);
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") setSheetOpen(false);
    });

    sheet.querySelectorAll(".cmp-tab").forEach(b => {
      b.addEventListener("click", () => activateTab(b.getAttribute("data-cmp-tab")).catch(()=>{}));
    });

    sheet.querySelector("#cmpMensualGuardar")?.addEventListener("click", async () => {
      try {
        const tipos = await ensureTiposMensual();

        const d = getFechaDesdeUI();
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const mm = String(m).padStart(2,"0");
        const fechaYYYYMM01 = `${y}-${mm}-01`;

        const val = (id) => Number((document.getElementById(id)?.value || "0").replace(",", ".") || 0);

        const rows = [
          { nombre: "TOPE MES", inputId: "cmpMensualTope" },
          { nombre: "SOBRE MES", inputId: "cmpMensualSobre" },
          { nombre: "TF MES", inputId: "cmpMensualTF" },
          { nombre: "PLAN MES", inputId: "cmpMensualPlan" },
        ];

        const id_supervisor = getSupervisorId?.() || window?.SESSION?.id_supervisor || window?.id_supervisor;
        const id_equipo = getEquipoId?.() || window?.SESSION?.id_equipo || window?.id_equipo;

        if (!id_supervisor || !id_equipo) {
          alert("Falta id_supervisor o id_equipo (sesión/equipo no definido).");
          return;
        }

        for (const r of rows) {
          const id_tipo = tipos[r.nombre];
          if (!id_tipo) continue;

          await upsertCompromisoMensualReal({
            id_vendedor: currentSheetVendedorId,
            id_tipo,
            id_supervisor,
            id_equipo,
            fecha_compromiso: fechaYYYYMM01,
            monto_comprometido: val(r.inputId) || 0
          });
        }

        console.log("[compromisos] guardado mensual OK");
        setSheetOpen(false);

      } catch (e) {
        console.error("[compromisos] guardar mensual fallo", e);
        alert("Error guardando compromisos.");
      }
    });
    sheet.querySelector("#cmpSemanalGuardar")?.addEventListener("click", async () => {
      try {
        const tipos = await ensureTiposSemanal();
        const { mondayISO } = getWeekStartEndISO();

        const val = (id) => Number((document.getElementById(id)?.value || "0").replace(",", ".") || 0);

        const rows = [
          { nombre: "TOPE", inputId: "cmpSemanalTope" },
          { nombre: "SOBRE", inputId: "cmpSemanalSobre" },
          { nombre: "BAJO", inputId: "cmpSemanalBajo" },
          { nombre: "PLAN", inputId: "cmpSemanalPlan" },
        ];

        const id_supervisor = getSupervisorId?.() || window?.SESSION?.id_supervisor || window?.id_supervisor;
        const id_equipo = getEquipoId?.() || window?.SESSION?.id_equipo || window?.id_equipo;

        if (!id_supervisor || !id_equipo) {
          alert("Falta id_supervisor o id_equipo (sesión/equipo no definido).");
          return;
        }

        for (const r of rows) {
          const id_tipo = tipos[r.nombre];
          if (!id_tipo) continue;

          await upsertCompromisoReal({
            id_vendedor: currentSheetVendedorId,
            id_tipo,
            id_supervisor,
            id_equipo,
            fecha_compromiso: mondayISO,
            monto_comprometido: val(r.inputId) || 0,
            cumplido: false,
            comentario: null
          });
        }

        console.log("[compromisos] guardado semanal OK");
        setSheetOpen(false);

      } catch (e) {
        console.error("[compromisos] guardar semanal fallo", e);
        alert("Error guardando compromisos semanales.");
      }
    });

  }

  function setSheetOpen(isOpen){
    const sheet = document.getElementById("cmpSheet");
    if (!sheet) return;
    sheet.classList.toggle("is-open", !!isOpen);
    sheet.setAttribute("aria-hidden", isOpen ? "false" : "true");
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  async function activateTab(key){
    const sheet = document.getElementById("cmpSheet");
    if (!sheet) return;
    sheet.querySelectorAll(".cmp-tab").forEach(b => {
      const active = b.getAttribute("data-cmp-tab") === key;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    sheet.querySelectorAll(".cmp-pane").forEach(p => {
      p.classList.toggle("is-active", p.getAttribute("data-cmp-pane") === key);
    });
    // Precarga data al cambiar tab
    if (currentSheetVendedorId) {
      if (key === "mensual") {
        try {
          const d = getFechaDesdeUI();
          const y = d.getFullYear();
          const mm = String(d.getMonth()+1).padStart(2,"0");
          const fechaYYYYMM01 = `${y}-${mm}-01`;
          const { tipos, byTipo } = await loadCompromisosMensual(currentSheetVendedorId, fechaYYYYMM01);
          setMensualInputsFromDB(tipos, byTipo, (typeof byNombre!=="undefined"?byNombre:null));
          const ventas = await loadVentasPorTipoMes(currentSheetVendedorId);
          setVentasUI(ventas);
        } catch (e) { console.warn("[compromisos.tab] mensual preload", e); }
      }
      if (key === "semanal") {
        try {
          const { tipos, byTipo, byNombre } = await loadCompromisosSemanal(currentSheetVendedorId);
          setSemanalInputsFromDB(tipos, byTipo, byNombre);
          setVentasSemanalUI({TOPE:0,SOBRE:0,BAJO:0,PLAN:0});
          const ventas = await loadVentasPorTipoSemana(currentSheetVendedorId);
          setVentasSemanalUI(ventas);
        } catch (e) { console.warn("[compromisos.tab] semanal preload", e); }
      }
    }

  }

  
  async function loadVentasPorTipoMes(vendedorId){
    const { start, end } = monthRange();
    const tipos = ["TOPE","SOBRE","BAJO","PLAN"];
    const out = { TOPE:0, SOBRE:0, BAJO:0, PLAN:0 };

    const { data, error } = await sb
      .from("ventas")
      .select("tipo_venta,fecha_venta")
      .eq("id_vendedor", vendedorId)
      .in("tipo_venta", tipos)
      .gte("fecha_venta", start)
      .lte("fecha_venta", end);

    if (error) throw error;

    (data || []).forEach(r => {
      const t = String(r.tipo_venta || "").toUpperCase();
      if (out[t] != null) out[t] += 1;
    });

    return out;
  }

  function setVentasUI(v){
    // v: {TOPE,SOBRE,BAJO,PLAN}
    const mapId = {
      TOPE: "cmpMensualVentaTope",
      SOBRE: "cmpMensualVentaSobre",
      PLAN: "cmpMensualVentaPlan",
      TF:   "cmpMensualVentaTF",
    };
    const tf = Number(v?.TOPE ?? 0) + Number(v?.SOBRE ?? 0) + Number(v?.BAJO ?? 0);
    const values = { ...v, TF: tf };

    Object.entries(mapId).forEach(([k,id]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(values?.[k] ?? 0);
    });
  }

  // =============================
  // SEMANAL: Tipos + Ventas + Compromisos
  // =============================
  const tipoCacheSemanal = (window.tipoCacheSemanal ||= { loaded:false, map:{} });

  async function ensureTiposSemanal(){
    if (tipoCacheSemanal.loaded) return tipoCacheSemanal.map;
    const nombres = ["TOPE","SOBRE","BAJO","PLAN"];
    const { data, error } = await sb
      .from("tipos_compromisos")
      .select("id,nombre")
      .in("nombre", nombres);
    if (error) throw error;

    const map = {};
    (data || []).forEach(r => { map[String(r.nombre)] = r.id; });
    tipoCacheSemanal.map = map;
    tipoCacheSemanal.loaded = true;
    return map;
  }

  function toISODate(d){
    const dt = (d instanceof Date) ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,"0");
    const dd = String(dt.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }

  function getWeekStartEndISO(){
    const d = getFechaDesdeUI(); // usa el datepicker de la vista
    const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = base.getDay(); // 0..6
    const diff = (day === 0) ? -6 : (1 - day); // lunes
    const monday = new Date(base);
    monday.setDate(base.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { mondayISO: toISODate(monday), sundayISO: toISODate(sunday) };
  }

  async function loadVentasPorTipoSemana(vendedorId){
    const { mondayISO, sundayISO } = getWeekStartEndISO();
    const tipos = ["TOPE","SOBRE","BAJO","PLAN"];
    const out = { TOPE:0, SOBRE:0, BAJO:0, PLAN:0 };

    const { data, error } = await sb
      .from("ventas")
      .select("tipo_venta,monto,fecha_venta")
      .eq("id_vendedor", vendedorId)
      .in("tipo_venta", tipos)
      .gte("fecha_venta", mondayISO)
      .lte("fecha_venta", sundayISO);

    if (error) throw error;

    (data || []).forEach(r => {
      const t = String(r.tipo_venta || "").toUpperCase();
      const m = Number(r.monto || 0);
      if (out[t] != null) out[t] += m;
    });

    return out;
  }

  function setVentasSemanalUI(v){
    const mapId = {
      TOPE: "cmpSemanalVentaTope",
      SOBRE: "cmpSemanalVentaSobre",
      BAJO: "cmpSemanalVentaBajo",
      PLAN: "cmpSemanalVentaPlan",
    };
    Object.entries(mapId).forEach(([k,id]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(v?.[k] ?? 0);
    });
  }

  async function loadCompromisosSemanal(vendedorId){
    const tipos = await ensureTiposSemanal();
    const ids = Object.values(tipos).filter(Boolean);
    const id_supervisor = (window.getSupervisorId && window.getSupervisorId()) || window?.SESSION?.id_supervisor || window?.id_supervisor;
    const id_equipo = (typeof getEquipoId === "function" ? getEquipoId() : null) || window?.SESSION?.id_equipo || window?.id_equipo;

    const { mondayISO } = getWeekStartEndISO();
    const q = sb
      .from("compromisos")
      .select("id_tipo,monto_comprometido,tipos_compromisos(nombre)")
      .eq("id_vendedor", vendedorId)
      .eq("fecha_compromiso", mondayISO);

    if (id_supervisor) q.eq("id_supervisor", id_supervisor);
    if (id_equipo) q.eq("id_equipo", id_equipo);
    if (ids.length) q.in("id_tipo", ids);

    const { data, error } = await q;
    if (error) throw error;

    const byTipo = {};
    const byNombre = {};

    (data || []).forEach(r => {
      const v = Number(r.monto_comprometido || 0);
      if (r.id_tipo) byTipo[r.id_tipo] = v;
      const nom = r?.tipos_compromisos?.nombre ? String(r.tipos_compromisos.nombre) : null;
      if (nom) byNombre[nom] = v;
    });

    // asegurar claves esperadas existan (para inputs)
    ["TOPE","SOBRE","BAJO","PLAN"].forEach(n => { if (byNombre[n] == null) byNombre[n] = 0; });

    return { tipos, byTipo, byNombre, mondayISO };
  }

  function setSemanalInputsFromDB(tipos, byTipo, byNombre){
    const getByNombre = (n) => Number((byNombre && byNombre[n] != null) ? byNombre[n] : 0);
    const getById = (n) => Number((byTipo && tipos && tipos[n] && byTipo[tipos[n]] != null) ? byTipo[tipos[n]] : 0);
    const get = (n) => (getById(n) || getByNombre(n));
    const setVal = (id,val)=>{ const el=document.getElementById(id); if(el) el.value=String(val??0); };
    setVal("cmpSemanalTope", get("TOPE"));
    setVal("cmpSemanalSobre", get("SOBRE"));
    setVal("cmpSemanalBajo", get("BAJO"));
    setVal("cmpSemanalPlan", get("PLAN"));
  }

  async function upsertCompromisoReal(payload){
    const { data, error } = await sb
      .from("compromisos")
      .upsert([payload], {
        onConflict: "id_tipo,id_supervisor,id_equipo,id_vendedor,fecha_compromiso"
      })
      .select("id_compromiso")
      .single();
    if (error) throw error;
    return data?.id_compromiso;
  }


  
  // Fecha seleccionada en la UI (input #fecha-compromiso). Fallback: hoy.
  function getFechaDesdeUI(){
    // Fuente oficial: datepicker de la vista (id="dt-dia")
    const input =
      document.getElementById("dt-dia") ||
      document.getElementById("fecha") ||
      document.getElementById("fecha-compromiso") ||
      document.querySelector('input[type="date"]');

    if (!input) return new Date();

    // Garantiza formato ISO en inputs date
    if (!input.value) {
      const hoy = new Date();
      if ("valueAsDate" in input) input.valueAsDate = hoy;
      else input.value = hoy.toISOString().slice(0,10);
    }

    // input.value siempre debe ser YYYY-MM-DD
    return new Date(input.value + "T00:00:00");
  }

// ===== CACHE TIPOS COMPROMISOS MENSUAL =====
  const tipoCacheMensual = { loaded: false, mapByName: {} };

  async function ensureTiposMensual(){
    if (tipoCacheMensual.loaded) return tipoCacheMensual.mapByName;

    const nombres = ["TOPE MES","SOBRE MES","TF MES","PLAN MES"];
    const { data, error } = await sb
      .from("tipos_compromisos")
      .select("id,nombre")
      .in("nombre", nombres);

    if (error) throw error;

    const map = {};
    (data || []).forEach(r => { map[String(r.nombre)] = r.id; });

    nombres.forEach(n => { if (!map[n]) console.warn("[compromisos] Falta tipos_compromisos:", n); });

    tipoCacheMensual.mapByName = map;
    tipoCacheMensual.loaded = true;
    return map;
  }

  async function loadCompromisosMensual(vendedorId, fechaYYYYMM01){
    const tipos = await ensureTiposMensual();
    const ids = Object.values(tipos).filter(Boolean);
    const id_supervisor = (window.getSupervisorId && window.getSupervisorId()) || window?.SESSION?.id_supervisor || window?.id_supervisor;
    const id_equipo = (typeof getEquipoId === "function" ? getEquipoId() : null) || window?.SESSION?.id_equipo || window?.id_equipo;

    
    const q = sb
      .from("compromisos")
      .select("id_tipo,monto_comprometido,tipos_compromisos(nombre)")
      .eq("id_vendedor", vendedorId)
      .eq("fecha_compromiso", fechaYYYYMM01);

    if (id_supervisor) q.eq("id_supervisor", id_supervisor);
    if (id_equipo) q.eq("id_equipo", id_equipo);
    if (ids.length) q.in("id_tipo", ids);

    const { data, error } = await q;
    if (error) throw error;

    const byTipo = {};
    const byNombre = {};

    (data || []).forEach(r => {
      const v = Number(r.monto_comprometido || 0);
      if (r.id_tipo) byTipo[r.id_tipo] = v;
      const nom = r?.tipos_compromisos?.nombre ? String(r.tipos_compromisos.nombre) : null;
      if (nom) byNombre[nom] = v;
    });

    // asegurar claves esperadas existan (para inputs)
    ["TOPE MES","SOBRE MES","TF MES","PLAN MES"].forEach(n => { if (byNombre[n] == null) byNombre[n] = 0; });

    return { tipos, byTipo, byNombre };
  }

  function setMensualInputsFromDB(tipos, byTipo, byNombre){
    const getByNombre = (n) => Number((byNombre && byNombre[n] != null) ? byNombre[n] : 0);
    const getById = (n) => Number((byTipo && tipos && tipos[n] && byTipo[tipos[n]] != null) ? byTipo[tipos[n]] : 0);
    const get = (n) => (getById(n) || getByNombre(n));
    const setVal = (id,val)=>{ const el=document.getElementById(id); if(el) el.value=String(val??0); };
    setVal("cmpMensualTope", get("TOPE MES"));
    setVal("cmpMensualSobre", get("SOBRE MES"));
    setVal("cmpMensualTF", get("TF MES"));
    setVal("cmpMensualPlan", get("PLAN MES"));
  }

  let currentSheetVendedorId = null;

async function openCmpSheet(vendedorId){
    currentSheetVendedorId = vendedorId;
    const sheet = ensureSheetDom();
    const v = vendedores.find(x => String(x.id) === String(vendedorId));
    sheet.querySelector("#cmpSheetVendedor").textContent = v?.nombre || "—";
    activateTab("mensual");
    setSheetOpen(true);
    try {
      // Precargar inputs Mensual desde BD (si existe) usando fecha YYYY-MM-01 del mes seleccionado
      const d = getFechaDesdeUI();
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const mm = String(m).padStart(2,"0");
      const fechaYYYYMM01 = `${y}-${mm}-01`;
      const { tipos, byTipo } = await loadCompromisosMensual(vendedorId, fechaYYYYMM01);
      setMensualInputsFromDB(tipos, byTipo, (typeof byNombre!=="undefined"?byNombre:null));


      setVentasUI({TOPE:0,SOBRE:0,BAJO:0,PLAN:0});
      const ventas = await loadVentasPorTipoMes(vendedorId);
      setVentasUI(ventas);
    } catch (e) {
      console.warn('[compromisos.sheet] ventas por tipo fallo', e);
    }
  }


  // ABC
  function buildAbcBar(list) {
    if (!elAbc) return;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const available = new Set((list || []).map(v => getFirstLetter(v.nombre)));

    elAbc.innerHTML = letters.map(L => {
      const off = !available.has(L);
      return `<button type="button" data-letter="${L}" class="${off ? "is-off" : ""}" ${off ? "disabled" : ""}>${L}</button>`;
    }).join("") + `<button type="button" data-letter="#" class="${available.has("#") ? "" : "is-off"}" ${available.has("#") ? "" : "disabled"}>#</button>`;
  }

  function scrollToLetter(letter) {
    const card = elLista.querySelector(`.v-card[data-letter="${CSS.escape(letter)}"]`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Render
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function render() {
    const q = norm(elBuscar?.value || "");
    const list = !q ? vendedores : vendedores.filter(v => norm(v.nombre).includes(q));

    buildAbcBar(list);

    elLista.innerHTML = list.map(v => {
      const m = metricsById.get(v.id) || { ventas: 0, comp: 0 };
      const L = (v.nombre || "?").trim().charAt(0).toUpperCase();
      const letter = getFirstLetter(v.nombre);
      const p = pct(m.ventas, m.comp);

      return `
        <article class="v-card" data-id="${escapeHtml(v.id)}" data-letter="${escapeHtml(letter)}">
          <div class="v-row">
            <div class="v-avatar">${escapeHtml(L)}</div>

            <div class="v-namewrap">
              <div class="v-name">${escapeHtml(v.nombre)}</div>
              <div class="v-meta">TF40&nbsp;&nbsp;Compromiso <b>${escapeHtml(m.comp)}</b>&nbsp;&nbsp;Venta <b>${escapeHtml(m.ventas)}</b></div>
            </div>

            <button class="v-plus" type="button" data-action="open" aria-label="Abrir">+</button>
          </div>

          <div class="v-bar-row" aria-hidden="true">
            <div class="v-bar-track">
              <div class="v-bar-fill" style="width:${p.toFixed(2)}%"></div>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  // Events
  elBuscar?.addEventListener("input", render);
  elDia?.addEventListener("change", async () => { await reload(); });

  elAbc?.addEventListener("click", (ev) => {
    const b = ev.target?.closest?.("button[data-letter]");
    if (!b || b.disabled) return;
    scrollToLetter(b.getAttribute("data-letter"));
  });

  elLista.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-action='open']");
    if (!btn) return;
    const card = ev.target.closest(".v-card");
    const id = card?.getAttribute("data-id");
    if (!id) return;
    openCmpSheet(id);
  });

async function reload() {
    setDefaultDate();
    vendedores = await loadVendedores();
    const ids = vendedores.map(v => v.id);
    metricsById = ids.length ? await loadMetrics(ids) : new Map();
    render();
  }

  reload();
})();

  // ===== UPSERT REAL MENSUAL =====
  async function upsertCompromisoMensualReal({
    id_vendedor,
    id_tipo,
    id_supervisor,
    id_equipo,
    fecha_compromiso,
    monto_comprometido
  }) {

    const payload = {
      id_vendedor,
      id_tipo,
      id_supervisor,
      id_equipo,
      fecha_compromiso,
      monto_comprometido: Number(monto_comprometido || 0),
      cumplido: false,
      comentario: null
    };

    const { data, error } = await sb
      .from("compromisos")
      .upsert([payload], {
        onConflict: "id_tipo,id_supervisor,id_equipo,id_vendedor,fecha_compromiso"
      })
      .select("id_compromiso")
      .single();

    if (error) throw error;
    return data?.id_compromiso;
  }

