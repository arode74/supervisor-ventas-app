(() => {
  "use strict";

  const supabase =
    window.supabaseClient ||
    (window.supabase?.createClient
      ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
      : null);

  const $ = (id) => document.getElementById(id);

  function go(url) {
    window.location.href = url;
  }

  async function ensureSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!data?.session) {
        go("../index.html");
        return null;
      }
      return data.session;
    } catch {
      go("../index.html");
      return null;
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    go("../index.html");
  }

  async function cargarNombreSupervisor(session) {
    const lbl = $("lbl-user");
    if (!lbl) return;

    const email = session?.user?.email || "Usuario";
    lbl.textContent = email; // fallback inmediato

    try {
      const authId = session?.user?.id;
      if (!authId) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("nombre")
        .eq("id", authId)
        .maybeSingle();

      if (error) throw error;

      const nombre = (data?.nombre || "").trim();
      if (nombre) lbl.textContent = nombre;
    } catch (e) {
      console.warn(
        "[mobile] No se pudo cargar profiles.nombre, se usa email:",
        e?.message || e
      );
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!supabase) {
      console.error("[mobile] Supabase no inicializado");
      return go("../index.html");
    }

    const session = await ensureSession();
    if (!session) return;

    await cargarNombreSupervisor(session);

    const btnLogout = $("btn-logout");
    if (btnLogout) btnLogout.addEventListener("click", logout);

    const goVentas = $("go-ventas");
    if (goVentas) goVentas.addEventListener("click", () => go("../views/ventas.mobile.html"));

    const goComp = $("go-compromisos");
    if (goComp) goComp.addEventListener("click", () => go("../views/compromisos.mobile.html"));
  });
})();
