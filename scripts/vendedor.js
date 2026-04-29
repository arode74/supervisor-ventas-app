// ===========================================================
// VENDEDOR.JS — Panel Vendedor
// Base: Panel Supervisor, sin velocímetro, sin TF y sin combo de equipo
// ===========================================================

import { supabase, limpiarSesion } from "../config.js";
import { enforceMustChangePassword } from "./guard-must-change-password.js";
import { startSessionManager } from "../scripts/session-manager.js";

// Guard global: si falla, no tumba el módulo
try {
  await enforceMustChangePassword();
} catch (e) {
  console.warn("⚠️ Guard falló (no bloquea vendedor):", e);
}

async function initVendedor() {
  // Session Manager transversal (auth + sesión expirada)
  try {
    startSessionManager({
      supabase,
      loginPath: "../index.html",
    });
  } catch (e) {
    console.warn("⚠️ Session Manager no inició:", e);
  }

  const nombreVendedorEl = document.getElementById("nombreVendedor");
  const nombreEquipoEl = document.getElementById("nombreEquipoVendedor");
  const btnLogout = document.getElementById("btnLogout");

  const panelBotones = document.getElementById("panel-botones");
  const contenedorModulos = document.getElementById("contenedor-modulos");

  const btnVentas = document.getElementById("btnVentas");
  const btnCompromisos = document.getElementById("btnCompromisos");

  // -------------------------
  // Logout
  // -------------------------
  if (btnLogout) {
    btnLogout.addEventListener("click", async (ev) => {
      ev.preventDefault();
      window.__AV_SKIP_GUARD__ = true;

      try { limpiarSesion(); } catch (_) {}

      try {
        const w = window.top || window.parent || window;
        if (typeof w.__avLogout === "function") {
          return await w.__avLogout();
        }
      } catch (_) {}

      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn("Logout:", e);
      }

      try {
        const w2 = window.top || window.parent || window;
        if (typeof w2.__appLogout === "function") return w2.__appLogout();
      } catch (_) {}

      window.location.replace("../index.html");
    });
  }

  // -------------------------
  // Usuario activo
  // -------------------------
  const usuarioActivo =
    typeof window.obtenerUsuarioActivo === "function"
      ? await window.obtenerUsuarioActivo()
      : (() => {
          try {
            const w = window.top || window.parent;
            if (w && typeof w.obtenerUsuarioActivo === "function") {
              return w.obtenerUsuarioActivo();
            }
          } catch (_) {}
          return null;
        })();

  if (!usuarioActivo?.id) {
    try {
      const w = window.top || window.parent || window;
      if (typeof w.__appLogout === "function") {
        w.__appLogout();
        return;
      }
    } catch (_) {}
    window.location.replace("../index.html");
    return;
  }

  const idUsuario = usuarioActivo.id;
  window.idUsuarioActivo = idUsuario;

  // -------------------------
  // Perfil: nombre desde profiles
  // -------------------------
  async function cargarPerfilVendedor() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre, email, usuario, genero")
      .eq("id", idUsuario)
      .maybeSingle();

    if (error) {
      console.error("❌ Error leyendo profile del vendedor:", error);
      return null;
    }

    return data || null;
  }

  // -------------------------
  // Validación de perfil vía user_roles -> perfiles
  // Solo si el perfil vigente es vendedor se consulta vendedor_usuario
  // -------------------------
  async function validarPerfilVendedor() {
    const { data, error } = await supabase
      .from("user_roles")
      .select(`
        id_perfil,
        activo,
        fecha_fin,
        perfiles (
          perfil
        )
      `)
      .eq("user_id", idUsuario)
      .eq("activo", true)
      .is("fecha_fin", null);

    if (error) {
      console.error("❌ Error leyendo user_roles/perfiles:", error);
      return { esVendedor: false, perfil: null, roles: [] };
    }

    const roles = Array.isArray(data) ? data : [];
    const rolVendedor = roles.find((r) => r?.perfiles?.perfil === "vendedor");
    const perfil = rolVendedor?.perfiles?.perfil || roles.find((r) => r?.perfiles?.perfil)?.perfiles?.perfil || null;

    return {
      esVendedor: !!rolVendedor,
      perfil,
      roles,
    };
  }

  // -------------------------
  // Relación vendedor + equipo vigente
  // Flujo validado:
  // profiles.id -> user_roles.id_perfil -> perfiles.perfil
  // si perfil=vendedor -> vendedor_usuario.id_vendedor
  // id_vendedor -> equipo_vendedor.id_equipo -> equipos.nombre_equipo
  // -------------------------
  async function cargarContextoVendedor() {
    const validacionPerfil = await validarPerfilVendedor();

    if (!validacionPerfil.esVendedor) {
      console.warn("⚠️ Usuario sin perfil vendedor vigente.", validacionPerfil);
      return {
        perfil: validacionPerfil.perfil,
        idVendedor: null,
        idEquipo: null,
        nombreVendedor: null,
        nombreEquipo: "Sin perfil vendedor",
      };
    }

    const { data: vu, error: vuErr } = await supabase
      .from("vendedor_usuario")
      .select("id_vendedor")
      .eq("id_usuario", idUsuario)
      .maybeSingle();

    if (vuErr) {
      console.error("❌ Error leyendo vendedor_usuario:", vuErr);
      return {
        perfil: "vendedor",
        idVendedor: null,
        idEquipo: null,
        nombreVendedor: null,
        nombreEquipo: "Sin vendedor asociado",
      };
    }

    const idVendedor = vu?.id_vendedor || null;
    if (!idVendedor) {
      console.warn("⚠️ Usuario vendedor sin relación en vendedor_usuario.");
      return {
        perfil: "vendedor",
        idVendedor: null,
        idEquipo: null,
        nombreVendedor: null,
        nombreEquipo: "Sin vendedor asociado",
      };
    }

    // Query directa con joins anidados: vendedores(nombre) + equipos(nombre_equipo)
    // Esta fue la ruta validada en consola para obtener Los Leones 3.
    const { data, error } = await supabase
      .from("equipo_vendedor")
      .select(`
        id_vendedor,
        id_equipo,
        estado,
        fecha_inicio,
        fecha_fin,
        vendedores (
          nombre
        ),
        equipos (
          nombre_equipo
        )
      `)
      .eq("id_vendedor", idVendedor)
      .eq("estado", true)
      .is("fecha_fin", null)
      .maybeSingle();

    if (error) {
      console.error("❌ Error leyendo contexto vendedor/equipo:", error);
      return {
        perfil: "vendedor",
        idVendedor,
        idEquipo: null,
        nombreVendedor: null,
        nombreEquipo: "Equipo no disponible",
      };
    }

    if (!data?.id_equipo) {
      console.warn("⚠️ Vendedor sin equipo vigente en equipo_vendedor.", { idVendedor });
      return {
        perfil: "vendedor",
        idVendedor,
        idEquipo: null,
        nombreVendedor: data?.vendedores?.nombre || null,
        nombreEquipo: "Sin equipo vigente",
      };
    }

    return {
      perfil: "vendedor",
      idVendedor,
      idEquipo: data.id_equipo,
      nombreVendedor: data?.vendedores?.nombre || null,
      nombreEquipo: data?.equipos?.nombre_equipo || "Sin equipo vigente",
    };
  }

  const perfil = await cargarPerfilVendedor();
  const contexto = await cargarContextoVendedor();

  // -------------------------
  // Render superior
  // -------------------------
  if (nombreVendedorEl) {
    nombreVendedorEl.textContent =
      contexto?.nombreVendedor ||
      perfil?.nombre ||
      usuarioActivo.nombre ||
      usuarioActivo.email ||
      "Vendedor";
  }

  if (nombreEquipoEl) {
    nombreEquipoEl.textContent = contexto?.nombreEquipo || "Sin equipo vigente";
  }

  // Contexto global/local para módulos legacy que lo usan
  if (contexto?.idVendedor) {
    window.idVendedorActivo = contexto.idVendedor;
    localStorage.setItem("idVendedorActivo", contexto.idVendedor);
  } else {
    localStorage.removeItem("idVendedorActivo");
  }

  if (contexto?.idEquipo) {
    window.idEquipoActivo = contexto.idEquipo;
    localStorage.setItem("idEquipoActivo", contexto.idEquipo);
    window.dispatchEvent(
      new CustomEvent("equipo:change", { detail: { idEquipo: contexto.idEquipo } })
    );
  } else {
    localStorage.removeItem("idEquipoActivo");
  }

  // Saludo protegido: género desde profile primero, fallback usuarioActivo
  const elTextoBienvenida = document.getElementById("textoBienvenida");
  if (elTextoBienvenida) {
    const g = String(perfil?.genero || usuarioActivo?.genero || "").trim().toUpperCase();
    const esF = g === "F" || g.startsWith("FEM");
    const esM = g === "M" || g.startsWith("MAS");

    elTextoBienvenida.textContent = esF
      ? "Bienvenida,"
      : esM
      ? "Bienvenido,"
      : "Bienvenido/a,";

    setTimeout(() => {
      elTextoBienvenida.style.display = "none";
    }, 5000);
  }

  // -------------------------
  // Volver robusto por delegación
  // -------------------------
  document.addEventListener(
    "click",
    (ev) => {
      const btn = ev.target?.closest?.("#btnVolver");
      if (!btn) return;

      ev.preventDefault();
      if (contenedorModulos) {
        contenedorModulos.innerHTML = "";
        contenedorModulos.style.display = "none";
      }
      if (panelBotones) panelBotones.style.display = "flex";
      window.dispatchEvent(new CustomEvent("modulo:volver"));
    },
    true
  );

  // -------------------------
  // Módulos
  // -------------------------
  function cargarScriptModulo(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.type = "module";
      s.src = `${src}?v=${Date.now()}`;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.body.appendChild(s);
    });
  }

  async function abrirModulo(viewPath, scriptPath) {
    try {
      const resp = await fetch(viewPath, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      contenedorModulos.innerHTML = await resp.text();
      contenedorModulos.style.display = "block";
      panelBotones.style.display = "none";

      if (scriptPath) {
        await cargarScriptModulo(scriptPath);
      }

      await cargarScriptModulo("../scripts/ui_modales.js");
    } catch (e) {
      console.error("❌ Error abriendo módulo:", e);
      alert("No se pudo abrir el módulo. Revisa consola.");
    }
  }

  btnVentas?.addEventListener("click", () =>
    abrirModulo("./ventas.html", "../scripts/ventas.js")
  );

  btnCompromisos?.addEventListener("click", () =>
    abrirModulo("./compromisos.html", "../scripts/compromisos.js")
  );
}

// Ejecuta SIEMPRE (aunque DOMContentLoaded ya pasó)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVendedor, { once: true });
} else {
  initVendedor();
}
