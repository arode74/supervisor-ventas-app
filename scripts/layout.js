// ============================================================
// LAYOUT.JS – Carga dinámica de vistas en Index
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const vista = params.get("view");
  const contenedor = document.getElementById("mainContent");

  if (!contenedor) {
    console.error("❌ No se encontró el contenedor principal (#mainContent)");
    return;
  }

  if (!vista) {
    contenedor.innerHTML = `
      <div class="inicio" style="text-align:center; margin-top:80px;">
        <h2>Bienvenido a APP Ventas</h2>
        <p>Por favor, inicie sesión para continuar.</p>
      </div>`;
    return;
  }

  try {
    console.log(`🔄 Cargando vista: ${vista}`);
    const response = await fetch(`./views/${vista}.html`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    contenedor.innerHTML = html;

    console.log(`✅ Vista "${vista}" cargada correctamente.`);

    // 🔹 Ejecutar script correspondiente a la vista
    const scriptTag = document.createElement("script");
    scriptTag.type = "module";
    scriptTag.src = `./scripts/${vista}.js`;
    document.body.appendChild(scriptTag);
  } catch (err) {
    console.error("❌ Error cargando vista:", err);
    contenedor.innerHTML = `
      <div style="color:red; padding:20px; text-align:center;">
        Error cargando la vista <strong>${vista}</strong>.<br>
        Detalle: ${err.message}
      </div>`;
  }
});
