(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const lista = $("#lista-vendedores");
  const dtInput = $("#dt-dia");

  function pad2(n) { return String(n).padStart(2, "0"); }
  function ymd(d) {
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}`;
  }
  function firstDayOfMonth(isoOrDate) {
    const d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate);
    return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  function getEnv() {
    // Soporta varios estilos (env.js / config.js históricos)
    const env = (typeof window.__ENV__ === "object" && window.__ENV__) ? window.__ENV__ : {};
    const url =
      window.SUPABASE_URL ||
      env.SUPABASE_URL ||
      env.url ||
      env.supabaseUrl ||
      null;

    const key =
      window.SUPABASE_ANON_KEY ||
      env.SUPABASE_ANON_KEY ||
      env.anonKey ||
      env.supabaseAnonKey ||
      null;

    return { url, key };
  }

  function getSupabaseClient() {
    // 1) Cliente ya inicializado por config.js (lo esperado)
    if (window.sb && typeof window.sb.from === "function") return window.sb;
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") return window.supabaseClient;

    // 2) Evitar usar window.supabase como cliente: es el namespace/lib
    // 3) Fallback: crear cliente si tenemos lib + credenciales
    const lib = window.supabase; // namespace de supabase-js
    if (lib && typeof lib.createClient === "function") {
      const { url, key } = getEnv();
      if (url && key) {
        const client = lib.createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        // Expón para el resto de módulos
        window.sb = client;
        return client;
      }
    }
    return null;
  }

  async function getTipoIds(sb) {
    // TF40 mensual = suma de compromisos cuyo tipo nombre contiene TOPE MES y SOBRE MES (case-insensitive).
    const { data, error } = await sb
      .from("tipos_compromisos")
      .select("id,nombre")
      .ilike("nombre", "%MES%");

    if (error) throw error;

    const tope = (data || []).find(t => String(t.nombre || "").toUpperCase().includes("TOPE"));
    const sobre = (data || []).find(t => String(t.nombre || "").toUpperCase().includes("SOBRE"));

    return { topeId: tope?.id || null, sobreId: sobre?.id || null };
  }

  function safeInitials(nombre) {
    const n = String(nombre || "").trim();
    return n ? n[0].toUpperCase() : "?";
  }

  function renderCard(v, compromisoTF40, ventasTF40, pct) {
    const card = document.createElement("div");
    card.className = "v-card";
    card.innerHTML = `
      <div class="v-row">
        <div class="v-avatar">${safeInitials(v.nombre)}</div>
        <div class="v-info">
          <div class="v-name">${v.nombre || ""}</div>
          <div class="v-metrics">
            <strong>Compromiso TF40:</strong> ${compromisoTF40}
            &nbsp; | &nbsp;
            <strong>Ventas TF40:</strong> ${ventasTF40}
          </div>
          <div class="v-bar" aria-label="Cumplimiento">
            <div class="v-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    `;
    return card;
  }

  async function load() {
    if (!lista || !dtInput) return;

    const sb = getSupabaseClient();
    if (!sb) {
      alert("Supabase no inicializado. Revisa carga de env.js/config.js.");
      return;
    }

    lista.innerHTML = "";

    // Fecha
    const fecha = dtInput.value || ymd(new Date());
    const mes = firstDayOfMonth(fecha);

    // 1) vendedores
    const { data: vendedores, error: errVend } = await sb
      .from("vendedores")
      .select("id,nombre")
      .order("nombre", { ascending: true });

    if (errVend) {
      console.error("[compromisos] error vendedores:", errVend);
      alert("Error cargando vendedores.");
      return;
    }

    const vendList = vendedores || [];
    if (vendList.length === 0) return;

    const vendIds = vendList.map(v => v.id);

    // 2) tipos (TOPE MES / SOBRE MES)
    const { topeId, sobreId } = await getTipoIds(sb);
    const tipoIds = [topeId, sobreId].filter(Boolean);

    // Si no existen tipos, seguimos igual pero todo queda en 0 (sin reventar)
    // 3) compromisos del mes (batch)
    const compSumByVend = new Map();
    if (tipoIds.length) {
      const { data: compRows, error: errComp } = await sb
        .from("compromisos")
        .select("id_vendedor,monto_comprometido,id_tipo_compromiso,fecha_compromiso")
        .in("id_vendedor", vendIds)
        .in("id_tipo_compromiso", tipoIds)
        .eq("fecha_compromiso", mes);

      if (errComp) {
        console.error("[compromisos] error compromisos:", errComp);
      } else {
        for (const r of (compRows || [])) {
          const id = r.id_vendedor;
          const monto = Number(r.monto_comprometido || 0);
          compSumByVend.set(id, (compSumByVend.get(id) || 0) + monto);
        }
      }
    }

    // 4) ventas desde primer día del mes (batch)
    const ventasSumByVend = new Map();
    const { data: ventaRows, error: errVentas } = await sb
      .from("ventas")
      .select("id_vendedor,cantidad,tipo_venta,fecha")
      .in("id_vendedor", vendIds)
      .gte("fecha", mes);

    if (errVentas) {
      console.error("[compromisos] error ventas:", errVentas);
    } else {
      for (const r of (ventaRows || [])) {
        const tipo = String(r.tipo_venta || "").toUpperCase();
        if (tipo !== "TOPE" && tipo !== "SOBRE") continue; // TF40 = TOPE + SOBRE
        const id = r.id_vendedor;
        const qty = Number(r.cantidad || 0);
        ventasSumByVend.set(id, (ventasSumByVend.get(id) || 0) + qty);
      }
    }

    // 5) render
    for (const v of vendList) {
      const compromisoTF40 = Number(compSumByVend.get(v.id) || 0);
      const ventasTF40 = Number(ventasSumByVend.get(v.id) || 0);
      const pct = compromisoTF40 > 0 ? Math.min(100, (ventasTF40 / compromisoTF40) * 100) : 0;
      lista.appendChild(renderCard(v, compromisoTF40, ventasTF40, pct));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!dtInput) return;
    if (!dtInput.value) dtInput.value = ymd(new Date());
    load();

    // Si cambian la fecha, recarga
    dtInput.addEventListener("change", () => load());
  });
})();
