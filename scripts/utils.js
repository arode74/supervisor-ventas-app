// =======================================================
// utils.js — Funciones globales de interfaz y notificaciones
// =======================================================

// ==================== VARIABLES GLOBALES ====================
let intervaloMensajes = null;
const mensajesCarga = [
  "Conectando con base de datos...",
  "Validando sesión...",
  "Procesando información...",
  "Cargando datos...",
  "Finalizando..."
];

// ==================== FUNCIONES DE CARGA ====================

// Muestra overlay de carga (dinámico o estático)
export function mostrarCarga(mensaje = null) {
  const overlay = document.getElementById("overlayCarga");
  const texto = document.getElementById("mensajeCarga");

  if (!overlay || !texto) {
    console.warn("⚠ No se encontró el overlay de carga en el DOM.");
    return;
  }

  overlay.classList.remove("oculto");

  if (!mensaje) {
    let indice = 0;
    texto.textContent = mensajesCarga[indice];
    intervaloMensajes = setInterval(() => {
      indice = (indice + 1) % mensajesCarga.length;
      texto.textContent = mensajesCarga[indice];
    }, 2500);
  } else {
    texto.textContent = mensaje;
  }
}

// Oculta overlay de carga y detiene animación
export function ocultarCarga() {
  const overlay = document.getElementById("overlayCarga");
  if (!overlay) return;

  overlay.classList.add("oculto");
  if (intervaloMensajes) {
    clearInterval(intervaloMensajes);
    intervaloMensajes = null;
  }
}

// ==================== FUNCIONES DE ALERTA / TOAST ====================
export function mostrarToast(mensaje, tipo = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = mensaje;
  toast.className = `toast visible ${tipo}`;

  setTimeout(() => {
    toast.classList.remove("visible");
  }, 3500);
}

// ==================== VALIDACIÓN DE SESIÓN ====================
export async function validarSesion(supabase) {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      console.warn("⚠ Sesión no válida, redirigiendo a login.");
      window.location.href = "../index.html";
      return null;
    }
    return data.session.user;
  } catch (err) {
    console.error("❌ Error al validar sesión:", err);
    return null;
  }
}

// ==================== CIERRE DE SESIÓN ====================
export async function cerrarSesion(supabase) {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("❌ Error al cerrar sesión:", error.message);
    } else {
      window.location.href = "../index.html";
    }
  } catch (err) {
    console.error("❌ Error inesperado al cerrar sesión:", err);
  }
}

// ==================== UTILIDADES DE FORMATO ====================

// Formatea RUT en tiempo real: 12622465-6 → 12.622.465-6
export function formatearRut(rut) {
  rut = rut.replace(/^0+/, "");
  if (rut.length <= 1) return rut;
  let cuerpo = rut.slice(0, -1).replace(/\D/g, "");
  let dv = rut.slice(-1);
  cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${dv}`;
}

// Valida el dígito verificador del RUT
export function validarRut(rut) {
  if (!rut || typeof rut !== "string") return false;
  rut = rut.replace(/\./g, "").replace("-", "");
  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1).toUpperCase();
  let suma = 0, multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  const dvCalculado = dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : dvEsperado.toString();
  return dv === dvCalculado;
}

// Capitaliza nombres (Alejandro Rode)
export function capitalizarNombre(nombre) {
  if (!nombre) return "";
  return nombre
    .trim()
    .toLowerCase()
    .split(" ")
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// ==================== DEPURACIÓN Y UTILIDADES ====================

export function mostrarDebug(mensaje) {
  const debugBox = document.getElementById("debugBox");
  if (!debugBox) return;
  const ts = new Date().toLocaleTimeString();
  debugBox.value += `[${ts}] ${mensaje}\n`;
  debugBox.scrollTop = debugBox.scrollHeight;
}

export function limpiarDebug() {
  const debugBox = document.getElementById("debugBox");
  if (debugBox) debugBox.value = "";
}

// ==================== GESTIÓN DE MODALES ====================

export function abrirModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("visible");
}

export function cerrarModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("visible");
}

// ==================== CONFIRMACIÓN INTERACTIVA ====================

export async function confirmarAccion(mensaje = "¿Desea continuar?") {
  return new Promise(resolve => {
    const confirmBox = document.createElement("div");
    confirmBox.className = "confirm-overlay";
    confirmBox.innerHTML = `
      <div class="confirm-box">
        <p>${mensaje}</p>
        <div class="confirm-buttons">
          <button id="btnConfirmar" class="btn-confirmar">Aceptar</button>
          <button id="btnCancelar" class="btn-cancelar">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmBox);
    document.getElementById("btnConfirmar").onclick = () => {
      confirmBox.remove();
      resolve(true);
    };
    document.getElementById("btnCancelar").onclick = () => {
      confirmBox.remove();
      resolve(false);
    };
  });
}
