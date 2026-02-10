import { requireUser, signOut } from "../core/supabase-client.js";

const $ = (id) => document.getElementById(id);

const txtEquipo = $("txtEquipo");
const txtEstado = $("txtEstado");
const btnVolver = $("btnVolver");
const btnSalir = $("btnSalir");

function go(path) {
  window.location.href = path;
}

function setStatus(msg) {
  txtEstado.textContent = msg || "";
}

async function init() {
  try {
    await requireUser();

    const idEquipo = sessionStorage.getItem("av_mobile_id_equipo");
    const label = sessionStorage.getItem("av_mobile_equipo_label") || "";

    if (!idEquipo) {
      setStatus("No hay equipo seleccionado. Volviendo a Supervisor…");
      go("./supervisor.mobile.html");
      return;
    }

    txtEquipo.textContent = label ? `Equipo: ${label}` : `Equipo ID: ${idEquipo}`;
    setStatus("");

    // Aquí enganchas tu lógica real de compromisos por idEquipo.

  } catch (e) {
    console.error("[compromisos.mobile] init error:", e);
    setStatus("Sesión no válida. Vuelve a iniciar sesión.");
    go("../../index.html");
  }
}

btnVolver.addEventListener("click", () => {
  go("./supervisor.mobile.html");
});

btnSalir.addEventListener("click", async () => {
  try {
    await signOut();
  } catch (e) {
    console.error("[compromisos.mobile] signOut error:", e);
  } finally {
    sessionStorage.removeItem("av_mobile_id_equipo");
    sessionStorage.removeItem("av_mobile_equipo_label");
    go("../../index.html");
  }
});

init();