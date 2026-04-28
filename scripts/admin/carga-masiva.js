import { supabase } from "../../config.js";

let _xlsxModule = null;
let _excelJsModule = null;

async function getXLSX() {
  if (_xlsxModule) return _xlsxModule;
  _xlsxModule = await import("https://cdn.jsdelivr.net/npm/xlsx/+esm");
  return _xlsxModule;
}

async function getExcelJS() {
  if (_excelJsModule) return _excelJsModule;
  const module = await import("https://cdn.jsdelivr.net/npm/exceljs@4.4.0/+esm");
  _excelJsModule = module.default || module;
  return _excelJsModule;
}

async function obtenerContratosVigentes() {
  const { data, error } = await supabase.rpc("get_contratos_vigentes");

  if (error) {
    console.error("❌ Error obteniendo contratos vigentes:", error);
    throw new Error(error?.message || "No fue posible obtener los contratos vigentes para generar la plantilla.");
  }

  const contratos = (data || [])
    .map((item) => String(item?.descripcion || "").trim())
    .filter(Boolean);

  if (!contratos.length) {
    throw new Error("No existen contratos vigentes configurados en la tabla contratos.");
  }

  return contratos;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function styles() {
  return `
    <style>
      .cm-shell{display:grid;gap:16px}
      .cm-card{background:#fff;border:1px solid #dbe7f3;border-radius:20px;box-shadow:0 8px 22px rgba(7,46,94,.06);padding:24px}
      .cm-sub{margin:0;color:#5b6b7c;font-size:14px;line-height:1.5}
      .cm-block{border:1px solid #dbe7f3;border-radius:16px;padding:18px;background:#fbfdff}
      .cm-field{display:flex;flex-direction:column;gap:6px}
      .cm-label{font-size:13px;font-weight:700;color:#33485c}
      .cm-input{width:100%;min-height:42px;border:1px solid #bfd3e8;border-radius:12px;padding:10px 12px;font-size:14px;color:#1e2f3f;background:#fff;box-sizing:border-box}
      .cm-input:focus{outline:none;border-color:#0b56a5;box-shadow:0 0 0 3px rgba(11,86,165,.12)}
      .cm-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
      .cm-btn{min-height:42px;padding:10px 16px;border-radius:12px;border:1px solid #0b56a5;background:#0b56a5;color:#fff;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.15}
      .cm-btn--secondary{background:#fff;color:#0b56a5}
      #cm-ejecutar{min-width:220px}
      #cm-limpiar{min-width:120px}
      .cm-btn[disabled]{opacity:.5;cursor:not-allowed}
      .cm-status{min-height:24px;font-size:13px;font-weight:700;color:#1f6f43;margin-top:12px;white-space:pre-wrap}
      .cm-status--error{color:#b42318}
      .cm-result{margin-top:16px;border:1px solid #dbe7f3;border-radius:16px;background:#fff;padding:16px}
      .cm-result h3{margin:0 0 10px 0;font-size:15px;color:#0b3f79}
      .cm-result__table-wrap{overflow:auto;border:1px solid #dbe7f3;border-radius:12px}
      .cm-result__table{width:100%;border-collapse:collapse;font-size:12px;background:#fff}
      .cm-result__table th{background:#f3f8ff;color:#0b3f79;text-align:left;font-weight:800;padding:10px;border-bottom:1px solid #dbe7f3;white-space:nowrap}
      .cm-result__table td{padding:10px;border-bottom:1px solid #edf3f8;vertical-align:top;color:#243649}
      .cm-result__table tr:last-child td{border-bottom:0}
      .cm-pill{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:4px 9px;font-weight:800;font-size:11px;white-space:nowrap}
      .cm-pill--creado{background:#e7f7ed;color:#166534}
      .cm-pill--omitido{background:#fff7e6;color:#92400e}
      .cm-pill--error{background:#feecec;color:#991b1b}
      .cm-pill--pendiente{background:#edf3f8;color:#33485c}
      .cm-help{background:#f7fbff;border:1px solid #dbe7f3;border-radius:16px;padding:16px}
      .cm-help h3{margin:0 0 8px 0;font-size:15px;color:#0b3f79}
      .cm-help p{margin:0 0 10px 0;font-size:13px;color:#4f5f70;line-height:1.5}
      .cm-link{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 18px;border-radius:10px;border:1px solid #bfd3e8;background:#fff;color:#0b56a5;font-weight:700;text-decoration:none;cursor:pointer;min-width:260px;max-width:260px;text-align:center;line-height:1.15;}
      .cm-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:12px}
      .cm-kpi{border:1px solid #dbe7f3;border-radius:12px;background:#f8fbff;padding:12px}
      .cm-kpi__label{display:block;font-size:12px;color:#5b6b7c;margin-bottom:4px}
      .cm-kpi__value{display:block;font-size:22px;font-weight:800;color:#0b3f79}
    </style>
  `;
}

function templateRows() {
  return [
    {
      fila_excel: 2,
      perfil_raw: "supervisor",
      rut_raw: "12.345.678-5",
      nombre_raw: "Supervisor Ejemplo Uno",
      email_raw: "supervisor.ejemplo@appventas.cl",
      usuario_raw: "supervisor.ejemplo",
      genero_raw: "M",
      nombre_zona_raw: "Metropolitana 2",
      nombre_equipo_raw: "Los Leones 1",
      fecha_inicio_raw: "2026-01-01",
      contrato: "",
    },
    {
      fila_excel: 3,
      perfil_raw: "vendedor",
      rut_raw: "11.111.111-1",
      nombre_raw: "Vendedor Ejemplo Uno",
      email_raw: "vendedor.ejemplo@appventas.cl",
      usuario_raw: "vendedor.ejemplo",
      genero_raw: "F",
      nombre_zona_raw: "Metropolitana 2",
      nombre_equipo_raw: "Los Leones 1",
      fecha_inicio_raw: "2026-01-01",
      contrato: "40 UF",
    },
  ];
}

function requiredHeaders() {
  return [
    "perfil_raw",
    "rut_raw",
    "nombre_raw",
    "email_raw",
    "usuario_raw",
    "genero_raw",
    "nombre_zona_raw",
    "nombre_equipo_raw",
    "fecha_inicio_raw",
    "contrato",
  ];
}

function setStatus(container, message, isError = false) {
  const el = container.querySelector("#cm-status");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("cm-status--error", !!isError);
}

function setButtonsLoading(container, loading) {
  const ejecutar = container.querySelector("#cm-ejecutar");
  const limpiar = container.querySelector("#cm-limpiar");
  const descargar = container.querySelector("#cm-descargar-plantilla");

  if (ejecutar) {
    ejecutar.disabled = loading;
    ejecutar.textContent = loading ? "Procesando..." : "Ejecutar carga masiva";
  }
  if (limpiar) limpiar.disabled = loading;
  if (descargar) descargar.disabled = loading;
}

function renderEmptyResult(container) {
  const result = container.querySelector("#cm-resultado");
  if (!result) return;
  result.innerHTML = "";
}

function estadoLabel(estado) {
  const value = String(estado ?? "").toLowerCase();
  if (value === "creado") return "Creado";
  if (value === "omitido") return "Omitido";
  if (value === "error") return "Error";
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Pendiente";
}

function estadoClass(estado) {
  const value = String(estado ?? "").toLowerCase();
  if (value === "creado") return "cm-pill--creado";
  if (value === "omitido") return "cm-pill--omitido";
  if (value === "error") return "cm-pill--error";
  return "cm-pill--pendiente";
}

function renderResult(container, payload) {
  const result = container.querySelector("#cm-resultado");
  if (!result) return;

  const resumen = payload?.lote
    ? {
        creados: payload.total_creados ?? 0,
        omitidos: payload.total_omitidos ?? 0,
        errores: payload.total_errores ?? 0,
        filas: payload.cantidad_filas_recibidas ?? 0,
      }
    : {
        creados: payload?.resumen?.ok ?? 0,
        omitidos: 0,
        errores: payload?.resumen?.error ?? 0,
        filas: payload?.resumen?.total ?? 0,
      };

  const staging = Array.isArray(payload?.staging) ? payload.staging : [];

  const filasDetalle = staging.length
    ? staging.map((fila) => {
        const estado = fila.estado_proceso || fila.estado_validacion || "pendiente";
        const motivo = fila.motivo_resultado || fila.codigo_error || "-";
        const password = fila.password_temporal || "-";

        return `
          <tr>
            <td>${escapeHtml(fila.fila_excel ?? "-")}</td>
            <td>${escapeHtml(fila.perfil ?? fila.perfil_raw ?? "-")}</td>
            <td>${escapeHtml(fila.nombre ?? fila.nombre_raw ?? "-")}</td>
            <td>${escapeHtml(fila.usuario ?? fila.usuario_raw ?? "-")}</td>
            <td><span class="cm-pill ${estadoClass(estado)}">${escapeHtml(estadoLabel(estado))}</span></td>
            <td>${escapeHtml(motivo)}</td>
            <td>${escapeHtml(password)}</td>
          </tr>
        `;
      }).join("")
    : `
      <tr>
        <td colspan="7">No se recibió detalle de filas desde la Edge Function.</td>
      </tr>
    `;

  result.innerHTML = `
    <div class="cm-result">
      <h3>Resultado de la carga</h3>
      <div class="cm-summary">
        <div class="cm-kpi"><span class="cm-kpi__label">Filas</span><span class="cm-kpi__value">${escapeHtml(resumen.filas)}</span></div>
        <div class="cm-kpi"><span class="cm-kpi__label">Creados</span><span class="cm-kpi__value">${escapeHtml(resumen.creados)}</span></div>
        <div class="cm-kpi"><span class="cm-kpi__label">Omitidos</span><span class="cm-kpi__value">${escapeHtml(resumen.omitidos)}</span></div>
        <div class="cm-kpi"><span class="cm-kpi__label">Errores</span><span class="cm-kpi__value">${escapeHtml(resumen.errores)}</span></div>
      </div>

      <div class="cm-result__table-wrap">
        <table class="cm-result__table">
          <thead>
            <tr>
              <th>Fila</th>
              <th>Perfil</th>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Estado</th>
              <th>Motivo</th>
              <th>Password inicial</th>
            </tr>
          </thead>
          <tbody>
            ${filasDetalle}
          </tbody>
        </table>
      </div>
    </div>
  `;

  console.log("Resultado carga masiva:", payload);
}

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error("El archivo no contiene filas válidas para procesar.");
  }

  const headers = requiredHeaders();
  const first = rows[0] || {};
  const missing = headers.filter((key) => !(key in first));

  if (missing.length) {
    throw new Error(`Faltan columnas obligatorias: ${missing.join(", ")}`);
  }

  const hasData = rows.some((row) =>
    headers.some((key) => String(row[key] ?? "").trim() !== "")
  );

  if (!hasData) {
    throw new Error("El archivo no contiene datos útiles para cargar.");
  }
}

async function parseExcelFile(file) {
  const XLSX = await getXLSX();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error("El archivo Excel no contiene hojas.");

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  validateRows(rows);

  return rows.map((row, index) => ({
    fila_excel: Number(row.fila_excel) || index + 2,
    perfil_raw: String(row.perfil_raw ?? "").trim(),
    rut_raw: String(row.rut_raw ?? "").trim(),
    nombre_raw: String(row.nombre_raw ?? "").trim(),
    email_raw: String(row.email_raw ?? "").trim(),
    usuario_raw: String(row.usuario_raw ?? "").trim(),
    genero_raw: String(row.genero_raw ?? "").trim(),
    nombre_zona_raw: String(row.nombre_zona_raw ?? "").trim(),
    nombre_equipo_raw: String(row.nombre_equipo_raw ?? "").trim(),
    fecha_inicio_raw: String(row.fecha_inicio_raw ?? "").trim(),
    contrato: String(row.contrato ?? "").trim(),
  }));
}

async function downloadTemplate() {
  const ExcelJS = await getExcelJS();
  const contratos = await obtenerContratosVigentes();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "App Ventas";
  workbook.created = new Date();

  const cargaSheet = workbook.addWorksheet("CargaMasiva");
  const listasSheet = workbook.addWorksheet("Listas");

  const headers = [
    "fila_excel",
    "perfil_raw",
    "rut_raw",
    "nombre_raw",
    "email_raw",
    "usuario_raw",
    "genero_raw",
    "nombre_zona_raw",
    "nombre_equipo_raw",
    "fecha_inicio_raw",
    "contrato",
  ];

  cargaSheet.addRow(headers);
  templateRows().forEach((row) => {
    cargaSheet.addRow(headers.map((key) => row[key] ?? ""));
  });

  cargaSheet.columns = [
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 30 },
    { width: 34 },
    { width: 24 },
    { width: 12 },
    { width: 24 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
  ];

  cargaSheet.getRow(1).font = { bold: true };
  cargaSheet.views = [{ state: "frozen", ySplit: 1 }];

  listasSheet.getCell("A1").value = "CONTRATOS";
  listasSheet.getCell("A1").font = { bold: true };

  contratos.forEach((contrato, index) => {
    listasSheet.getCell(`A${index + 2}`).value = contrato;
  });

  listasSheet.getColumn(1).width = 24;

  const ultimaFilaContratos = contratos.length + 1;

  // Excel no siempre respeta validación de datos apuntando directamente a otra hoja.
  // Por eso se usa un rango con nombre, que es la forma estable para listas desplegables.
  workbook.definedNames.add(
    `Listas!$A$2:$A$${ultimaFilaContratos}`,
    "LISTA_CONTRATOS"
  );

  // Columna K = contrato. Filas 2 a 501 = máximo 500 registros.
  // allowBlank=true permite supervisores sin contrato.
  for (let row = 2; row <= 501; row += 1) {
    const cell = cargaSheet.getCell(`K${row}`);
    cell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["LISTA_CONTRATOS"],
      showErrorMessage: true,
      errorTitle: "Contrato inválido",
      error: "Seleccione un contrato vigente desde la lista desplegable o deje vacío si corresponde.",
    };
  }

  listasSheet.state = "hidden";

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob(
    [buffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla_carga_masiva_usuarios.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildView() {
  return `
    ${styles()}
    <div class="cm-shell">
      <section class="cm-card">
        <div class="admin-panel__header">
          <div>
            <h2 class="admin-panel__titulo">Carga masiva de usuarios</h2>
            <p class="cm-sub">Suba un Excel con vendedores y supervisores nuevos a cargar.</p>
            <p class="cm-sub">Use el formato definido para la carga masiva de usuarios.</p>
          </div>
        </div>

        <div class="cm-block">
          <div class="cm-field">
            <label class="cm-label" for="cm-archivo">Archivo Excel</label>
            <input id="cm-archivo" class="cm-input" type="file" accept=".xlsx,.xls" />
          </div>

          <div class="cm-actions">
            <button type="button" class="cm-btn" id="cm-ejecutar">Ejecutar carga masiva</button>
            <button type="button" class="cm-btn cm-btn--secondary" id="cm-limpiar">Limpiar</button>
          </div>

          <div id="cm-status" class="cm-status">Seleccione un archivo para comenzar.</div>
          <div id="cm-resultado"></div>
        </div>
      </section>

      <section class="cm-help">
        <h3>Formato esperado</h3>
        <p>Descargue la plantilla Excel con la estructura requerida para la carga masiva. Complete o modifique ese archivo y luego súbalo nuevamente.</p>
        <button type="button" class="cm-link" id="cm-descargar-plantilla">Descargar plantilla Excel</button>
      </section>
    </div>
  `;
}

function clearForm(container) {
  const input = container.querySelector("#cm-archivo");
  if (input) input.value = "";
  setStatus(container, "Seleccione un archivo para comenzar.", false);
  renderEmptyResult(container);
}

async function handleExecute(container) {
  const input = container.querySelector("#cm-archivo");
  const file = input?.files?.[0];

  renderEmptyResult(container);

  if (!file) {
    setStatus(container, "Debe seleccionar un archivo antes de ejecutar la carga.", true);
    return;
  }

  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    setStatus(container, "Archivo inválido. Debe seleccionar un Excel .xlsx o .xls.", true);
    return;
  }

  try {
    setButtonsLoading(container, true);
    setStatus(container, "Validando archivo...", false);

    const filas = await parseExcelFile(file);

    setStatus(container, "Ejecutando carga masiva...", false);

    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.access_token) {
      throw new Error("No se pudo obtener la sesión autenticada del usuario.");
    }

    const { data: payload, error: fnError } = await supabase.functions.invoke(
      "carga-usuarios-masiva",
      {
        body: {
          nombre_archivo: file.name,
          filas,
        },
      }
    );

    if (fnError) {
      throw new Error(fnError.message || "La carga masiva falló.");
    }

    setStatus(container, "Carga masiva ejecutada correctamente.", false);
    renderResult(container, payload);
  } catch (error) {
    console.error("❌ Carga masiva:", error);
    setStatus(container, error?.message || "La carga masiva terminó con error.", true);
  } finally {
    setButtonsLoading(container, false);
  }
}

function bindEvents(container) {
  const input = container.querySelector("#cm-archivo");
  const ejecutar = container.querySelector("#cm-ejecutar");
  const limpiar = container.querySelector("#cm-limpiar");
  const descargar = container.querySelector("#cm-descargar-plantilla");

  input?.addEventListener("change", () => {
    renderEmptyResult(container);
    const file = input.files?.[0];
    if (!file) {
      setStatus(container, "Seleccione un archivo para comenzar.", false);
      return;
    }
    setStatus(container, `Archivo seleccionado: ${file.name}`, false);
  });

  ejecutar?.addEventListener("click", async () => {
    await handleExecute(container);
  });

  limpiar?.addEventListener("click", () => {
    clearForm(container);
  });

  descargar?.addEventListener("click", async () => {
    try {
      await downloadTemplate();
    } catch (error) {
      console.error("❌ Descargar plantilla:", error);
      setStatus(container, error?.message || "No fue posible descargar la plantilla Excel.", true);
    }
  });
}

export async function renderCargaMasiva(container) {
  container.innerHTML = buildView();
  bindEvents(container);
}
