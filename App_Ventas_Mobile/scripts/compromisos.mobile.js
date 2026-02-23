
(() => {
  "use strict";

  console.log("[compromisos.mobile.js] VERSION 20260223d");

  const $ = (s) => document.querySelector(s);
  const lista = $("#lista-vendedores");
  const dtInput = $("#dt-dia");

  if (!window.supabase) {
    alert("Supabase no inicializado.");
    return;
  }

  const sb = window.supabase;

  function firstDayOfMonth(d) {
    const date = new Date(d);
    return new Date(date.getFullYear(), date.getMonth(), 1)
      .toISOString()
      .split("T")[0];
  }

  async function getTipoIds() {
    const { data, error } = await sb
      .from("tipos_compromisos")
      .select("id, nombre")
      .ilike("nombre", "%MES%");

    if (error) throw error;

    const tope = data.find(t => t.nombre.toUpperCase().includes("TOPE"));
    const sobre = data.find(t => t.nombre.toUpperCase().includes("SOBRE"));

    return {
      topeId: tope?.id,
      sobreId: sobre?.id
    };
  }

  async function load() {
    lista.innerHTML = "";
    const fecha = dtInput.value;
    const mes = firstDayOfMonth(fecha);

    const { data: vendedores } = await sb
      .from("vendedores")
      .select("id:id_vendedor,nombre")
      .order("nombre", { ascending: true });

    const { topeId, sobreId } = await getTipoIds();

    for (const v of vendedores) {

      const { data: comp } = await sb
        .from("compromisos")
        .select("monto_comprometido")
        .eq("id_vendedor", v.id)
        .in("id_tipo_compromiso", [topeId, sobreId])
        .eq("fecha_compromiso", mes);

      const compromisoTF40 = (comp || []).reduce((a, b) => a + (b.monto_comprometido || 0), 0);

      const { data: ventas } = await sb
        .from("ventas")
        .select("cantidad, tipo_venta, fecha")
        .eq("id_vendedor", v.id)
        .gte("fecha", mes);

      const ventasTF40 = (ventas || [])
        .filter(x => ["TOPE", "SOBRE"].includes(x.tipo_venta))
        .reduce((a, b) => a + (b.cantidad || 0), 0);

      const pct = compromisoTF40 > 0 ? Math.min(100, (ventasTF40 / compromisoTF40) * 100) : 0;

      const card = document.createElement("div");
      card.className = "v-card";
      card.innerHTML = `
        <div class="v-row">
          <div class="v-avatar">${v.nombre[0]}</div>
          <div class="v-info">
            <div class="v-name">${v.nombre}</div>
            <div class="v-metrics">
              <strong>Compromiso TF40:</strong> ${compromisoTF40}
              &nbsp; | &nbsp;
              <strong>Ventas TF40:</strong> ${ventasTF40}
            </div>
            <div class="v-bar">
              <div class="v-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
      `;

      lista.appendChild(card);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    dtInput.valueAsDate = new Date();
    load();
  });

})();
