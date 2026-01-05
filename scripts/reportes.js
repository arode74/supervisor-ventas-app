// ============================================================
//  REPORTES.JS – KPIs básicos del supervisor
//  Se ejecuta cuando supervisor.js inyecta reportes.html
// ============================================================

(() => {
  const panel = document.getElementById("panelReportes");
  const btnVolver = document.getElementById("btnVolverReportes");

  async function cargarReportes() {
    try {
      const { data, error } = await supabase.from("ventas").select("monto");
      if (error) throw error;

      const total    = (data || []).reduce((acc, v) => acc + Number(v.monto || 0), 0);
      const cantidad = (data || []).length;
      const promedio = cantidad ? total / cantidad : 0;

      panel.innerHTML = `
        <div class="card-report">
          <h4>Total Ventas</h4>
          <p>$${total.toLocaleString("es-CL")}</p>
        </div>
        <div class="card-report">
          <h4>Promedio por Venta</h4>
          <p>$${promedio.toLocaleString("es-CL")}</p>
        </div>
        <div class="card-report">
          <h4>Cantidad de Ventas</h4>
          <p>${cantidad}</p>
        </div>
      `;
    } catch (e) {
      console.error("Error al cargar reportes:", e);
      panel.innerHTML = `<p style="color:#c00">No fue posible cargar los indicadores.</p>`;
    }
  }

  btnVolver?.addEventListener("click", () => {
    if (typeof window.volverMenuSupervisor === "function") window.volverMenuSupervisor();
  });

  cargarReportes();
})();
