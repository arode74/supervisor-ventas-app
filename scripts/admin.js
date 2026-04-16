import { supabase, limpiarSesion } from "../config.js";
import { enforceMustChangePassword } from "./guard-must-change-password.js";
import { renderAccesos, setAccesosMode } from "./admin/accesos.js";

try {
  await enforceMustChangePassword();
} catch (e) {
  console.warn("⚠️ Guard falló (no bloquea):", e);
}

function irLogin() {
  window.location.replace("../index.html");
}

async function getSesion() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session ?? null;
}

async function getPerfilActual(userId) {
  const { data, error } = await supabase.rpc("get_perfil_actual", { p_user_id: userId });
  if (error) throw error;
  return data ?? null;
}

const ADMIN_MODULOS = {
  dashboard: {
    titulo: "Dashboard",
    subtitulo: "Resumen ejecutivo y operativo del módulo Admin.",
    subopciones: ["Resumen", "Alertas", "Movimientos recientes"],
    render: () => `
      <div class="admin-panel__header">
        <div>
          <h2 class="admin-panel__titulo">Dashboard</h2>
          <p class="admin-panel__subtitulo">Vista inicial del backoffice. Aquí parte el control tower.</p>
        </div>
      </div>

      <div class="admin-kpis">
        <div class="admin-kpi"><p class="admin-kpi__label">Usuarios activos</p><p class="admin-kpi__value">--</p></div>
        <div class="admin-kpi"><p class="admin-kpi__label">Vendedores activos</p><p class="admin-kpi__value">--</p></div>
        <div class="admin-kpi"><p class="admin-kpi__label">Equipos activos</p><p class="admin-kpi__value">--</p></div>
        <div class="admin-kpi"><p class="admin-kpi__label">Zonas activas</p><p class="admin-kpi__value">--</p></div>
        <div class="admin-kpi"><p class="admin-kpi__label">Suplencias pendientes</p><p class="admin-kpi__value">--</p></div>
      </div>

      <div class="admin-grid">
        <article class="admin-card">
          <h3>Prioridades del módulo</h3>
          <ul>
            <li>Gestión integral de cuentas, roles y reseteo de contraseñas.</li>
            <li>Administración de vendedores, supervisores, zonales, equipos y zonas.</li>
            <li>Mantención de suplencias, motivos de suplencia y tipos de compromisos.</li>
          </ul>
        </article>
        <article class="admin-card">
          <h3>Próximos enchufes backend</h3>
          <ul>
            <li>RPCs seguras para crear cuentas y forzar cambios de password.</li>
            <li>Operaciones con vigencia para equipo_vendedor, equipo_supervisor, zona_zonal y zona_equipo.</li>
            <li>Alertas por inconsistencias: huérfanos, dobles asignaciones y faltas de cobertura.</li>
          </ul>
        </article>
      </div>
    `,
  },
  usuarios: {
    titulo: "Usuarios y cuentas",
    subtitulo: "Creación de cuentas, roles, reset de password y vínculo con entidades.",
    subopciones: ["Listado", "Crear cuenta"],
    render: () => tablaBase(
      "Usuarios y cuentas",
      "Base operativa para creación de cuentas y gestión de acceso.",
      ["Nombre", "Email", "Perfil", "Entidad asociada", "Estado", "Acciones"],
      [
        ["--", "--", "--", "--", pill("Activo", "activo"), acciones("Ver", "Editar", "Reset")],
      ]
    ),
  },
  roles: {
    titulo: "Roles y perfiles",
    subtitulo: "Asignación de roles, vigencias y control RBAC.",
    subopciones: ["Listado", "Asignar", "Cambiar", "Vigencias"],
    render: () => tablaBase(
      "Roles y perfiles",
      "Control de perfiles y consistencia RBAC.",
      ["Usuario", "Perfil actual", "Desde", "Hasta", "Estado", "Acciones"],
      [["--", "--", "--", "--", pill("Pendiente", "pendiente"), acciones("Asignar", "Cambiar")]]
    ),
  },
  vendedores: {
    titulo: "Vendedores",
    subtitulo: "Alta, edición, asignación a equipos y cuenta asociada.",
    subopciones: ["Listado", "Crear vendedor", "Asignar equipo", "Cambio de equipo", "Crear cuenta"],
    render: () => tablaBase(
      "Vendedores",
      "Gestión del ciclo completo del vendedor.",
      ["Nombre", "RUT", "Equipo vigente", "Cuenta asociada", "Estado", "Acciones"],
      [["--", "--", "--", "--", pill("Activo", "activo"), acciones("Editar", "Asignar", "Cuenta")]]
    ),
  },
  supervisores: {
    titulo: "Supervisores",
    subtitulo: "Asignación de equipos y gestión de vigencias.",
    subopciones: ["Listado", "Asignar equipos", "Cambiar equipos"],
    render: () => tablaBase(
      "Supervisores",
      "Administración de supervisores y cobertura de equipos.",
      ["Nombre", "Usuario", "Equipos vigentes", "Estado", "Acciones"],
      [["--", "--", "--", pill("Activo", "activo"), acciones("Ver", "Asignar")]]
    ),
  },
  zonales: {
    titulo: "Zonales",
    subtitulo: "Asignación de zonas y control de cobertura zonal.",
    subopciones: ["Listado", "Asignar zonas", "Cambiar zonas"],
    render: () => tablaBase(
      "Zonales",
      "Administración de zonales y zonas vigentes.",
      ["Nombre", "Usuario", "Zonas vigentes", "Estado", "Acciones"],
      [["--", "--", "--", pill("Activo", "activo"), acciones("Ver", "Asignar")]]
    ),
  },
  equipos: {
    titulo: "Equipos",
    subtitulo: "Creación de equipos, relación con zonas y supervisores.",
    subopciones: ["Listado", "Crear equipo", "Asignar zona", "Asignar supervisor"],
    render: () => tablaBase(
      "Equipos",
      "Gestión estructural del modelo comercial.",
      ["Equipo", "Zona vigente", "Supervisor vigente", "Estado", "Acciones"],
      [["--", "--", "--", pill("Activo", "activo"), acciones("Editar", "Zona", "Supervisor")]]
    ),
  },
  zonas: {
    titulo: "Zonas",
    subtitulo: "Creación de zonas y mantención de la relación zona-equipo.",
    subopciones: ["Listado", "Crear zona", "Relacionar equipos"],
    render: () => tablaBase(
      "Zonas",
      "Administración de zonas y su cobertura.",
      ["Zona", "Zonal vigente", "Equipos relacionados", "Estado", "Acciones"],
      [["--", "--", "--", pill("Activo", "activo"), acciones("Editar", "Equipos")]]
    ),
  },
  asignaciones: {
    titulo: "Asignaciones",
    subtitulo: "Movimientos vendedor-equipo, supervisor-equipo, zonal-zona y equipo-zona.",
    subopciones: ["Vendedor → Equipo", "Supervisor → Equipo", "Zonal → Zona", "Equipo → Zona"],
    render: () => `
      <div class="admin-panel__header">
        <div>
          <h2 class="admin-panel__titulo">Asignaciones</h2>
          <p class="admin-panel__subtitulo">Hub operativo para todos los movimientos estructurales con vigencia.</p>
        </div>
      </div>
      <div class="admin-grid">
        <article class="admin-card">
          <h3>Movimientos a implementar</h3>
          <ul>
            <li>Cambio de equipo en vendedores.</li>
            <li>Asignación y cambio de equipos para supervisores.</li>
            <li>Cambio de zonas de zonales.</li>
            <li>Mantención de relación zona ↔ equipo.</li>
          </ul>
        </article>
        <article class="admin-card">
          <h3>Reglas mínimas</h3>
          <ul>
            <li>Cerrar vigencia anterior antes de abrir la nueva.</li>
            <li>Validar superposiciones y cobertura.</li>
            <li>Registrar trazabilidad del movimiento.</li>
          </ul>
        </article>
      </div>
    `,
  },
  suplencias: {
    titulo: "Suplencias",
    subtitulo: "Bandeja, aprobación, rechazo, cancelación y término anticipado.",
    subopciones: ["Bandeja", "Crear", "Pendientes", "Activas", "Historial"],
    render: () => tablaBase(
      "Suplencias",
      "Gestión completa del ciclo de suplencias.",
      ["Tipo", "Titular", "Suplente", "Motivo", "Estado", "Acciones"],
      [["--", "--", "--", "--", pill("Pendiente", "pendiente"), acciones("Aprobar", "Rechazar", "Cancelar")]]
    ),
  },
  motivos: {
    titulo: "Motivos de suplencia",
    subtitulo: "Maestro de motivos con activación, orden y configuración.",
    subopciones: ["Listado", "Crear", "Editar", "Activar/Desactivar"],
    render: () => tablaBase(
      "Motivos de suplencia",
      "Catálogo parametrizable para la operación de suplencias.",
      ["Motivo", "Descripción", "Estado", "Orden", "Acciones"],
      [["--", "--", pill("Activo", "activo"), "--", acciones("Editar", "Estado")]]
    ),
  },
  compromisos: {
    titulo: "Compromisos",
    subtitulo: "Mantención de tipos de compromisos y su configuración funcional.",
    subopciones: ["Tipos", "Crear tipo", "Editar tipo", "Configuración"],
    render: () => tablaBase(
      "Compromisos",
      "Parámetros de tipos de compromiso para la operación comercial.",
      ["Tipo", "Obligatorio", "Visible para todos", "Estado", "Acciones"],
      [["--", "--", "--", pill("Activo", "activo"), acciones("Editar", "Estado")]]
    ),
  },
  alertas: {
    titulo: "Alertas",
    subtitulo: "Inconsistencias operativas y pendientes críticas.",
    subopciones: ["Inconsistencias", "Pendientes", "Validaciones"],
    render: () => `
      <div class="admin-panel__header">
        <div>
          <h2 class="admin-panel__titulo">Alertas</h2>
          <p class="admin-panel__subtitulo">Monitor de inconsistencias para que esto no quede a fe del Espíritu Santo.</p>
        </div>
      </div>
      <div class="admin-grid">
        <article class="admin-card">
          <h3>Alertas a controlar</h3>
          <ul>
            <li>Vendedores sin equipo vigente.</li>
            <li>Cuentas sin rol o sin entidad asociada.</li>
            <li>Equipos sin supervisor vigente.</li>
            <li>Zonas sin zonal vigente.</li>
          </ul>
        </article>
        <article class="admin-card">
          <h3>Objetivo</h3>
          <ul>
            <li>Levantar inconsistencias antes de que exploten en la operación.</li>
            <li>Centralizar pendientes críticos del sistema.</li>
          </ul>
        </article>
      </div>
    `,
  },
  auditoria: {
    titulo: "Auditoría",
    subtitulo: "Trazabilidad de cambios de acceso y estructura.",
    subopciones: ["Acciones recientes", "Cambios de estructura", "Cambios de acceso"],
    render: () => tablaBase(
      "Auditoría",
      "Base para trazabilidad de movimientos críticos.",
      ["Fecha", "Usuario ejecutor", "Acción", "Entidad", "Detalle"],
      [["--", "--", "--", "--", "--"]]
    ),
  },
};

function pill(texto, tipo) {
  return `<span class="estado-pill ${tipo}">${texto}</span>`;
}

function acciones(...items) {
  return `<div class="acciones-fila">${items
    .map((txt) => `<button type="button" class="btn-secundario">${txt}</button>`)
    .join("")}</div>`;
}

function tablaBase(titulo, subtitulo, columnas, filas) {
  return `
    <div class="admin-panel__header">
      <div>
        <h2 class="admin-panel__titulo">${titulo}</h2>
        <p class="admin-panel__subtitulo">${subtitulo}</p>
      </div>
      <button type="button" class="btn">Nuevo</button>
    </div>

    <div class="admin-filtros">
      <input type="text" placeholder="Buscar..." />
      <select>
        <option>Todos</option>
      </select>
      <select>
        <option>Activos</option>
        <option>Inactivos</option>
      </select>
    </div>

    <div class="admin-tabla-wrap">
      <table class="admin-tabla">
        <thead>
          <tr>${columnas.map((c) => `<th>${c}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${filas
            .map((fila) => `<tr>${fila.map((celda) => `<td>${celda}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function initAdmin() {
  const nombreAdminEl = document.getElementById("nombreAdmin");
  const btnLogout = document.getElementById("btnLogout");
  const btnToggleMenu = document.getElementById("btnToggleMenu");
  const btnVolver = document.getElementById("btnVolver");
  const adminMenu = document.getElementById("adminMenu");
  const adminContenido = document.getElementById("adminContenido");
  const adminSubmenu = document.getElementById("adminSubmenu");
  const menuItems = Array.from(document.querySelectorAll(".admin-menu__item"));
  const menuHeaders = Array.from(document.querySelectorAll("[data-menu-group]"));

  if (btnLogout) {
    btnLogout.addEventListener("click", async (ev) => {
      ev.preventDefault();
      window.__AV_SKIP_GUARD__ = true;
      try { limpiarSesion(); } catch (_) {}
      try { await supabase.auth.signOut(); } catch (_) {}
      irLogin();
    });
  }

  if (btnVolver) {
    btnVolver.addEventListener("click", () => {
      window.history.back();
    });
  }

  if (btnToggleMenu && adminMenu) {
    btnToggleMenu.addEventListener("click", () => {
      adminMenu.hidden = !adminMenu.hidden;
    });
  }

  function setMenuGroupState(groupKey, expandido) {
    const header = document.querySelector(`[data-menu-group="${groupKey}"]`);
    const panel = document.querySelector(`[data-menu-panel="${groupKey}"]`);
    if (!header || !panel) return;
    const icon = header.querySelector(".admin-menu__toggle");
    header.setAttribute("aria-expanded", expandido ? "true" : "false");
    panel.classList.toggle("colapsada", !expandido);
    if (icon) icon.textContent = expandido ? "−" : "+";
  }


  function collapseAllMenuGroups() {
    menuHeaders.forEach((header) => {
      const groupKey = header.dataset.menuGroup;
      setMenuGroupState(groupKey, false);
    });
  }

  function initAccordionMenu() {
    collapseAllMenuGroups();

    menuHeaders.forEach((header) => {
      header.addEventListener("click", () => {
        const groupKey = header.dataset.menuGroup;
        const expanded = header.getAttribute("aria-expanded") === "true";

        if (expanded) {
          setMenuGroupState(groupKey, false);
          return;
        }

        menuHeaders.forEach((otherHeader) => {
          const otherKey = otherHeader.dataset.menuGroup;
          setMenuGroupState(otherKey, otherKey === groupKey);
        });
      });
    });
  }

  const session = await getSesion();
  const authUserId = session?.user?.id || null;
  if (!authUserId) {
    irLogin();
    return;
  }

  let usuarioActivo = null;
  try {
    usuarioActivo = typeof window.obtenerUsuarioActivo === "function"
      ? await window.obtenerUsuarioActivo()
      : null;
  } catch (_) {}

  if (nombreAdminEl) {
    nombreAdminEl.textContent = usuarioActivo?.nombre || usuarioActivo?.email || "Administrador";
  }

  const elTextoBienvenida = document.getElementById("textoBienvenida");
  if (elTextoBienvenida) {
    const g = String(usuarioActivo?.genero || "").trim().toUpperCase();
    const esF = g === "F" || g.startsWith("FEM");
    const esM = g === "M" || g.startsWith("MAS");
    elTextoBienvenida.textContent = esF ? "Bienvenida," : esM ? "Bienvenido," : "Bienvenido/a,";
    setTimeout(() => { elTextoBienvenida.style.display = "none"; }, 5000);
  }

  try {
    const perfilActual = await getPerfilActual(authUserId);
    if (String(perfilActual || "").toLowerCase() !== "admin") {
      console.warn("⛔ Acceso denegado: perfil_actual != admin");
      irLogin();
      return;
    }
  } catch (e) {
    console.error("⛔ Error validando RBAC admin:", e);
    irLogin();
    return;
  }

  function bindUsuariosSubmenu() {
    if (!adminSubmenu) return;
    const botones = Array.from(adminSubmenu.querySelectorAll(".admin-submenu__item"));
    botones.forEach((btn) => {
      btn.addEventListener("click", () => {
        botones.forEach((b) => b.classList.remove("activo"));
        btn.classList.add("activo");
        const txt = btn.textContent.trim();
        const modeMap = {
          "Listado": "listado",
          "Crear cuenta": "crear",
          "Editar cuenta": "editar",
          "Reset password": "reset",
        };
        setAccesosMode(modeMap[txt] || "crear");
      });
    });
  }

  function renderSubmenu(moduloKey) {
    const modulo = ADMIN_MODULOS[moduloKey];
    if (!modulo || !adminSubmenu) return;
    const activeIndex = moduloKey === "usuarios" ? 1 : 0;
    adminSubmenu.innerHTML = modulo.subopciones
      .map((txt, i) => `<button type="button" class="admin-submenu__item ${i === activeIndex ? "activo" : ""}">${txt}</button>`)
      .join("");
    if (moduloKey === "usuarios") bindUsuariosSubmenu();
  }

  function renderModulo(moduloKey) {
    const moduloRealKey = moduloKey === "usuarios" ? "usuarios" : moduloKey;
    const modulo = ADMIN_MODULOS[moduloRealKey] || ADMIN_MODULOS.dashboard;

    menuItems.forEach((btn) => btn.classList.toggle("activo", btn.dataset.modulo === moduloKey));
    renderSubmenu(moduloRealKey);

    if (moduloKey === "usuarios") {
      renderAccesos(adminContenido, { mode: "crear" });
      return;
    }

    adminContenido.innerHTML = modulo.render();
  }

  menuItems.forEach((btn) => {
    btn.addEventListener("click", () => renderModulo(btn.dataset.modulo));
  });

  initAccordionMenu();
  renderModulo("dashboard");
}

initAdmin();
