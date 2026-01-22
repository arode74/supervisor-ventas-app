/* ===========================================================
   GESTIÓN GLOBAL DE MODALES — APP VENTAS (ESTABLE)
   =========================================================== */

import { supabase } from "../config.js";

console.log("🟢 ui_modales.js cargado");

/* ===========================================================
   SUPERVISOR — FUENTE ÚNICA (RBAC)
   - No usar localStorage/sessionStorage para identidad
   =========================================================== */
async function getSupervisorId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}


/* ===========================================================
   ABRIR MODAL
   =========================================================== */
function abrirModal(idModal) {
  const modal = document.getElementById(idModal);
  if (modal && typeof modal.showModal === "function") {
    modal.showModal();
    console.log(`🟢 Modal '${idModal}' abierto`);
  } else {
    console.warn(`⚠️ No se encontró modal '${idModal}'`);
  }
}

/* ===========================================================
   CERRAR MODAL
   =========================================================== */
function cerrarModal(idModal) {
  const modal = document.getElementById(idModal);
  if (modal && typeof modal.close === "function") {
    modal.close();
    console.log(`🔴 Modal '${idModal}' cerrado`);
  }
}

/* ===========================================================
   MANEJADOR GLOBAL DE CLICKS
   =========================================================== */
document.addEventListener("click", async (e) => {
  const btnAbrir = e.target.closest("[data-modal-abrir]");
  const btnCerrar = e.target.closest("[data-modal-cerrar]");

  // ABRIR
  if (btnAbrir) {
    const idModal = btnAbrir.getAttribute("data-modal-abrir");
    abrirModal(idModal);

    // Caso especial: modal nuevo vendedor
    if (idModal === "modalNuevoVendedor") {
      const idSupervisor = await getSupervisorId();

      const select = document.getElementById("selectEquipoModal");
      if (!select || !idSupervisor) return;

      supabase
        .from("vista_equipo_supervisor_dia")
        .select("id_equipo, nombre_equipo")
        .eq("id_supervisor", idSupervisor)
        .eq("vigente", true)
        .then(({ data, error }) => {
          if (error) {
            console.error("❌ Error cargando equipos:", error.message);
            select.innerHTML = '<option value="">Error al cargar equipos</option>';
            return;
          }

          if (!data?.length) {
            select.innerHTML = '<option value="">Sin equipos asignados</option>';
            return;
          }

          select.innerHTML = data
            .map(eq => `<option value="${eq.id_equipo}">${eq.nombre_equipo}</option>`)
            .join("");
        });
    }
  }

  // CERRAR
  if (btnCerrar) {
    const idModal = btnCerrar.getAttribute("data-modal-cerrar");
    cerrarModal(idModal);
  }
});

/* ===========================================================
   ESCAPE CIERRA MODALES
   =========================================================== */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
  }
});

/* ===========================================================
   EXPONER API GLOBAL (CONTRATO)
   =========================================================== */
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;
