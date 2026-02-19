(function () {
  "use strict";

  const form = document.getElementById("loginForm");
  const usuarioInput = document.getElementById("usuario");
  const passwordInput = document.getElementById("password");

  function getSupabase() {
    return window.sb || window.supabaseClient || null;
  }

  function irSupervisor() {
    window.location.replace("./views/supervisor.mobile.html");
  }

  form?.addEventListener("submit", async function (e) {
    e.preventDefault();

    const sb = getSupabase();
    if (!sb) {
      alert("Supabase no inicializado.");
      return;
    }

    const usuario = usuarioInput.value.trim();
    const password = passwordInput.value.trim();

    if (!usuario || !password) {
      alert("Completa usuario y contraseña.");
      return;
    }

    const { error } = await sb.auth.signInWithPassword({
      email: usuario,
      password: password,
    });

    if (error) {
      alert("Credenciales inválidas.");
      return;
    }

    irSupervisor();
  });
})();
