import {
  mostrarCarga as mostrarOverlay,
  ocultarCarga as ocultarOverlay,
  mostrarToast as toast,
} from "./utils.js";

function validarPassword(pw) {
  if (!pw || pw.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  return null;
}

async function obtenerSesion(supabase) {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("⚠️ getSession error:", error);
    return null;
  }
  return data?.session ?? null;
}

async function obtenerPerfil(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, activo, must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

function redirectPorRol(role) {
  const r = (role || "").toLowerCase();
  if (r === "admin") window.location.href = "../views/admin.html";
  else if (r === "supervisor") window.location.href = "../views/supervisor.html";
  else if (r === "vendedor") window.location.href = "../views/vendedor.html";
  else window.location.href = "../index.html";
}

function mostrarModalOK(mensaje, onAceptar) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.35)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";
  overlay.style.padding = "16px";

  const box = document.createElement("div");
  box.style.background = "#fff";
  box.style.borderRadius = "14px";
  box.style.boxShadow = "0 18px 60px rgba(0,0,0,0.25)";
  box.style.maxWidth = "520px";
  box.style.width = "calc(100vw - 48px)";
  box.style.padding = "16px 18px";
  box.style.textAlign = "center";
  box.style.color = "#0b1f33";

  const p = document.createElement("div");
  p.textContent = mensaje;
  p.style.fontSize = "14px";
  p.style.lineHeight = "1.25";
  p.style.textAlign = "left";
  p.style.margin = "0 0 12px";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Aceptar";
  btn.style.border = "0";
  btn.style.borderRadius = "10px";
  btn.style.padding = "8px 14px";
  btn.style.cursor = "pointer";
  btn.style.background = "#0b4a7a";
  btn.style.color = "#fff";
  btn.style.fontWeight = "600";

  btn.addEventListener("click", () => {
    overlay.remove();
    onAceptar?.();
  });

  box.appendChild(p);
  box.appendChild(btn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

async function cargarSupabaseSeguro() {
  try {
    const mod = await import("../config.js");
    if (!mod?.supabase) throw new Error("config.js no exportó supabase");
    return mod.supabase;
  } catch (e) {
    console.error("❌ Error cargando config/supabase:", e);
    toast("No se pudo iniciar Supabase. Revisa env.js / config.js.");
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("formCambioPassword");
  // Este script SOLO aplica en /views/cambiar-password.html
  if (!form) return;

  const btnCancelar = document.getElementById("btnCancelar");
  const inputNueva = document.getElementById("nuevaPassword");
  const inputConf = document.getElementById("confirmarPassword");

  mostrarOverlay("Validando sesión...");

  const supabase = await cargarSupabaseSeguro();
  if (!supabase) {
    ocultarOverlay();
    return;
  }

  try {
    // Guardia: debe existir sesión
    const session = await obtenerSesion(supabase);
    if (!session?.user?.id) {
      toast("Sesión no válida. Inicia sesión nuevamente.");
      window.location.href = "../index.html";
      return;
    }

    const userId = session.user.id;

    // Guardia: debe venir marcado para cambio obligatorio
    const perfil = await obtenerPerfil(supabase, userId);

    if (!perfil) {
      toast("Usuario sin perfil en el sistema.");
      await supabase.auth.signOut();
      window.location.href = "../index.html";
      return;
    }

    if (!perfil.activo) {
      toast("Usuario no activo en el sistema.");
      await supabase.auth.signOut();
      window.location.href = "../index.html";
      return;
    }

    if (perfil.must_change_password !== true) {
      // No corresponde estar aquí
      redirectPorRol(perfil.role);
      return;
    }

    // Cancelar: bloqueo real, no permite entrar sin cambiar
    btnCancelar?.addEventListener("click", async () => {
      await supabase.auth.signOut();
      toast("Debes cambiar tu contraseña para continuar.");
      window.location.href = "../index.html";
    });

    // Submit: cambiar contraseña + bajar flag
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nueva = (inputNueva?.value || "").trim();
      const conf = (inputConf?.value || "").trim();

      const msg = validarPassword(nueva);
      if (msg) return toast(msg);

      if (nueva !== conf) return toast("Las contraseñas no coinciden.");

      mostrarOverlay("Actualizando contraseña...");

      // 1) Cambia password en Auth
      const { error: errPw } = await supabase.auth.updateUser({ password: nueva });
      if (errPw) {
        console.error("Error updateUser:", errPw);
        toast(`No se pudo actualizar la contraseña. (${errPw.message})`);
        ocultarOverlay();
        return;
      }

      // 2) Baja flag en profiles (vía RPC ya definida por ustedes)
      const { error: errFlag } = await supabase.rpc("set_my_password_changed");
      if (errFlag) {
        console.error("Error update flag:", errFlag);
        toast(`Contraseña actualizada, pero no se pudo cerrar el proceso. (${errFlag.message})`);
        ocultarOverlay();
        return;
      }

      // Limpieza de contextos
      sessionStorage.removeItem("must_change_password");
      sessionStorage.removeItem("user_id");

      ocultarOverlay();

      // 3) OK + Aceptar
      mostrarModalOK("Cambio de Contraseña Correcta.", () => {
        redirectPorRol(perfil.role);
      });
    });
  } catch (err) {
    console.error("Error en cambiar-password:", err);
    toast("Error validando tu cuenta.");
    await supabase.auth.signOut();
    window.location.href = "../index.html";
  } finally {
    ocultarOverlay();
  }
});
