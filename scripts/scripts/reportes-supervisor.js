// scripts/reportes-supervisor.js
/* ============================================================
   REPORTES-SUPERVISOR.JS
   - Lanzador de reportes (anidado)
   - Sin iframes
   - Volver: NO history.back(); usa el delegado global #btnVolver de supervisor.js
   ============================================================ */

function cargarScriptModulo(scriptRelPath) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.type = "module";
    // Resuelve relativo al archivo actual (scripts/)
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

    // Gestor de modales (si tu app lo usa en módulos anidados)
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
  // Botón volver en la pantalla de REPORTES
  // Opción enterprise-grade: convertirlo en #btnVolver para que lo capture supervisor.js
  const btnVolverReportes = document.getElementById("btnVolverReportes");
  if (btnVolverReportes) {
    // Importante: supervisor.js escucha por delegación "#btnVolver"
    btnVolverReportes.id = "btnVolver";
  }

  const btnCompVentas = document.getElementById("btnReporteCompromisoVentas");
  btnCompVentas?.addEventListener("click", async (e) => {
    e.preventDefault();
    // reportes-supervisor.js está en /scripts/, por eso el JS del reporte es "./compromiso-ventas.js"
    await abrirSubModulo("./compromiso-ventas.html", "./compromiso-ventas.js");
  });

  const btnRepVentas = document.getElementById("btnReporteVentas");
  btnRepVentas?.addEventListener("click", async (e) => {
    e.preventDefault();
    // reportes-supervisor.js está en /scripts/, por eso el JS del reporte es "./reporte-ventas.js"
    await abrirSubModulo("./reporte-ventas.html", "./reporte-ventas.js");
  });


  // Cuando el reporte interno pide "volver a reportes"
  window.addEventListener("reportes:volver", () => cerrarReporteAnidado());
}

init();
