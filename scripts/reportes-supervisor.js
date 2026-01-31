// scripts/reportes-supervisor.js
/* ============================================================
   REPORTES-SUPERVISOR.JS
   - Lanzador de reportes (anidado)
   ============================================================ */

function cargarScriptModulo(scriptRelPath) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.type = "module";
    s.src = new URL(scriptRelPath, import.meta.url).href + `?v=${Date.now()}`;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`No se pudo cargar ${scriptRelPath}`));
    document.body.appendChild(s);
  });
}

async function abrirSubModulo(viewPath, scriptRelPath) {
  const cont = document.getElementById("contenedor-reporte-anidado");
  if (!cont) {
    console.error("❌ No existe #contenedor-reporte-anidado");
    return;
  }

  try {
    const resp = await fetch(viewPath, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} al cargar ${viewPath}`);

    cont.innerHTML = await resp.text();
    cont.style.display = "block";

    if (scriptRelPath) await cargarScriptModulo(scriptRelPath);
    await cargarScriptModulo("./ui_modales.js");
  } catch (err) {
    console.error("❌ Error cargando reporte:", err);
    alert("No se pudo cargar el reporte. Revisa consola.");
  }
}

function cerrarReporteAnidado() {
  const cont = document.getElementById("contenedor-reporte-anidado");
  if (!cont) return;
  cont.innerHTML = "";
  cont.style.display = "none";
}

function init() {
  // Volver (delegado al supervisor)
  const btnVolverReportes = document.getElementById("btnVolverReportes");
  if (btnVolverReportes) btnVolverReportes.id = "btnVolver";

  // Compromiso Ventas
  document
    .getElementById("btnReporteCompromisoVentas")
    ?.addEventListener("click", async (e) => {
      e.preventDefault();
      await abrirSubModulo(
        "./compromiso-ventas.html",
        "./compromiso-ventas.js"
      );
    });

  // Reporte Ventas (mensual)
  document
    .getElementById("btnReporteVentas")
    ?.addEventListener("click", async (e) => {
      e.preventDefault();
      await abrirSubModulo(
        "./reporte-ventas.html",
        "./reporte-ventas.js"
      );
    });

  // ✅ Reporte Ventas Semanal
  document
    .getElementById("btnReporteVentasSemanal")
    ?.addEventListener("click", async (e) => {
      e.preventDefault();
      await abrirSubModulo(
        "./reporte-ventas-semana.html",
        "./reporte-ventas-semana.js"
      );
    });

  // Evento volver desde reportes internos
  window.addEventListener("reportes:volver", () => cerrarReporteAnidado());
}

init();
