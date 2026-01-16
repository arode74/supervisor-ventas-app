// ============================================================
//  ADMIN.JS – Panel de Administrador (RBAC)
//  - Valida ADMIN vía get_perfil_actual (user_roles.id_perfil -> perfiles)
//  - No depende de localStorage.usuarioActivo ni de profiles.role
// ============================================================

import { supabase } from "../config.js";

function navegarLogin() {
  window.location.replace("../index.html");
}

async function obtenerSesion() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session ?? null;
}

async function obtenerPerfil(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, genero, activo, email, usuario")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function obtenerPerfilActual(userId) {
  const { data, error } = await supabase.rpc("get_perfil_actual", { p_user_id: userId });
  if (error) throw error;
  return (data ?? null);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const session = await obtenerSesion();
    const userId = session?.user?.id;
    if (!userId) return navegarLogin();

    const [perfil, perfilActual] = await Promise.all([
      obtenerPerfil(userId),
      obtenerPerfilActual(userId),
    ]);

    if (!perfil?.activo) return navegarLogin();

    if (String(perfilActual || "").toLowerCase() !== "admin") {
      return navegarLogin();
    }

    // Saludo
    const nombre = perfil.nombre || "Administrador";
    const genero = perfil.genero ? String(perfil.genero).toUpperCase() : "M";
    const saludo = genero === "F" ? "Bienvenida" : "Bienvenido";

    const nombreElemento = document.getElementById("nombreUsuario");
    if (nombreElemento) nombreElemento.textContent = `${saludo}, ${nombre}`;

    // Persist opcional (ayuda a módulos que leen rol local)
    try {
      localStorage.setItem("perfil_actual", "admin");
      sessionStorage.setItem("perfil_actual", "admin");
    } catch (_) {}
  } catch (e) {
    console.error("ADMIN: error:", e);
    navegarLogin();
  }
});
