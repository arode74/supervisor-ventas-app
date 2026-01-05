// ============================================================
//  ADMIN.JS – Panel de Administrador
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const usuario = JSON.parse(localStorage.getItem("usuarioActivo"));

  // Validar sesión y rol
  if (!usuario || usuario.rol !== "admin") {
    window.location.href = "../index.html";
    return;
  }

  // Obtener nombre y género
  const nombre = usuario.nombre || "Administrador";
  const genero = usuario.genero ? usuario.genero.toUpperCase() : "M"; // Por defecto M

  // Determinar saludo según género
  const saludo = genero === "F" ? "Bienvenida" : "Bienvenido";

  // Mostrar texto dinámico
  const nombreElemento = document.getElementById("nombreUsuario");
  if (nombreElemento) {
    nombreElemento.textContent = `${saludo}, ${nombre}`;
  }

  console.log(`👋 ${saludo}, ${nombre}`);
});
