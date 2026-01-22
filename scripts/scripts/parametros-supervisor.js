import { supabase } from "../config.js";
import { initTiposCompromisos } from "./parametros/tipos-compromisos.js";

console.log("🟢 parametros-supervisor.js cargado");

const $ = (id) => document.getElementById(id);

/* ===========================================================
   AUTH
   =========================================================== */
async function getSupervisorId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("auth.getUser error:", error.message, error.details, error.hint);
    return null;
  }
  return data?.user?.id ?? null;
}

/* ===========================================================
   HELPERS (comunes)
   =========================================================== */
function abrir(idModal) {
  if (typeof window.abrirModal === "function") return window.abrirModal(idModal);
  const d = $(idModal);
  if (d?.showModal) d.showModal();
}

function cerrar(idModal) {
  if (typeof window.cerrarModal === "function") return window.cerrarModal(idModal);
  const d = $(idModal);
  if (d?.close) d.close();
}

function mostrarAviso(texto, titulo = "Resultado") {
  const t = $("avisoTitulo");
  const p = $("avisoTexto");
  if (t) t.textContent = titulo;
  if (p) p.textContent = texto || "";
  abrir("modalAviso");
}

function setMensaje(msg, tipo = "info") {
  const el = $("mensajeEstado");

  if (tipo === "error") {
    if (el) {
      el.textContent = msg || "";
      el.style.color = "#b00020";
      return;
    }
    mostrarAviso(msg, "Error");
    return;
  }

  if (el) el.textContent = "";
  if (msg) mostrarAviso(msg, "Resultado");
}

/* ===========================================================
   ESTADO UI
   =========================================================== */
let parametroActivo = null;
let __ps_inited = false;

function setHint(texto) {
  const el = $("cfgHint");
  if (el) el.textContent = texto || "";
}

function activarParametro(param) {
  parametroActivo = param;

  if (!param) setHint("Selecciona un parámetro para habilitar acciones.");
  else if (param === "tipos_compromisos") setHint("Administra tipos de compromisos (Editar / Guardar / Cancelar)." );
  else setHint("Parámetro no disponible.");

  renderAccionesDerecha();
}

function renderAccionesDerecha() {
  const box = $("accionesParametro");
  if (!box) return;

  if (!parametroActivo) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  if (parametroActivo === "tipos_compromisos") {
    box.style.display = "flex";
    box.style.gap = "12px";
    box.innerHTML = `
      <button class="btn btn--primary" id="btnEditarTipos" type="button">Modificar</button>
      <button class="btn btn--secondary" id="btnCrearTipo" type="button">Crear</button>
    `;
    return;
  }

  box.style.display = "none";
  box.innerHTML = "";
}

/* ===========================================================
   BIND UI (router)
   =========================================================== */
function bindUI() {
  // Selección de parámetro
  document.querySelectorAll('.config-item__btn[data-param]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      activarParametro(btn.getAttribute("data-param"));
    });
  });

  // Acciones a la derecha (delegación)
  const acciones = $("accionesParametro");
  if (acciones) {
    acciones.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;

      // Delegamos al módulo activo
      if (t.id === "btnEditarTipos") {
        initTiposCompromisos({
          supabase,
          $, 
          abrir,
          cerrar,
          mostrarAviso,
          setMensaje,
          getSupervisorId,
        }).open();
      }

      if (t.id === "btnCrearTipo") {
        initTiposCompromisos({
          supabase,
          $, 
          abrir,
          cerrar,
          mostrarAviso,
          setMensaje,
          getSupervisorId,
        }).openCreate();
      }
    });
  }

  // Cierre de modales (genérico)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-modal-cerrar]");
    if (!btn) return;
    const id = btn.getAttribute("data-modal-cerrar");
    if (id) cerrar(id);
  });

  const btnCerrarAviso = $("btnCerrarAviso");
  if (btnCerrarAviso) btnCerrarAviso.addEventListener("click", () => cerrar("modalAviso"));
}

/* ===========================================================
   INIT robusto (para módulos inyectados)
   =========================================================== */
function init() {
  if (__ps_inited) return;

  const cont = $("modulo-configuracion");
  if (!cont) return;

  __ps_inited = true;
  bindUI();
  activarParametro(null);

  // Inicializa módulos una sola vez (listeners internos)
  initTiposCompromisos({
    supabase,
    $,
    abrir,
    cerrar,
    mostrarAviso,
    setMensaje,
    getSupervisorId,
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

const mo = new MutationObserver(() => {
  if (!__ps_inited && $("modulo-configuracion")) init();
});
mo.observe(document.documentElement, { childList: true, subtree: true });
