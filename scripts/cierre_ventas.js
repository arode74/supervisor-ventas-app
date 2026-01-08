	import { supabase } from "../config.js";

	const ROOT_ID = "modulo-cierre-ventas";

	let tabla = null;
	let tbody = null;
	let btnVolver = null;
	let btnGuardarCierre = null;
	let selectMes = null;
	let selectAnio = null;

	let idEquipo = null;

	let rolActual =
	  localStorage.getItem("rol_actual") ||
	  sessionStorage.getItem("rol_actual") ||
	  localStorage.getItem("rol") ||
	  sessionStorage.getItem("rol") ||
	  "supervisor";

	let existentesPorVendedor = new Map(); // id_vendedor -> { TOPE, SOBRE, BAJO, PLAN, PV }


// ============================
// Ordenar por Vendedor (ASC/DESC) + triángulo
// ============================
let ordenVendedorAsc = true;
let vendedoresActuales = []; // último set de vendedores cargados

function ordenarPorVendedor(lista) {
  const copia = [...(lista || [])];
  copia.sort((a, b) => {
    const na = (a?.nombre || "").toString().trim();
    const nb = (b?.nombre || "").toString().trim();
    const cmp = na.localeCompare(nb, "es", { sensitivity: "base" });
    return ordenVendedorAsc ? cmp : -cmp;
  });
  return copia;
}

function actualizarTrianguloVendedor() {
  const tri = document.getElementById("triVendedor");
  if (tri) tri.textContent = ordenVendedorAsc ? "▲" : "▼";
}

// Snapshot/restauración para no perder lo digitado al reordenar
function snapshotInputsCierre() {
  const snap = new Map();

  const filas = [...tbody.querySelectorAll("tr")];
  for (const tr of filas) {
    const id = tr.dataset.idVendedor;
    if (!id) continue;

    const vals = {};
    tr.querySelectorAll("input.input-cierre").forEach((inp) => {
      const tipo = inp.dataset.tipo;
      if (!tipo) return;
      vals[tipo] = inp.value; // tal cual (incluye PV formateado)
    });
    snap.set(id, vals);
  }
  return snap;
}

function restoreInputsCierre(snap) {
  if (!snap) return;

  snap.forEach((vals, id) => {
    const tr = tbody.querySelector(`tr[data-id-vendedor="${id}"]`) || [...tbody.querySelectorAll("tr")].find((x) => x.dataset?.idVendedor === id);
    if (!tr) return;

    tr.querySelectorAll("input.input-cierre").forEach((inp) => {
      const tipo = inp.dataset.tipo;
      if (!tipo) return;
      if (vals[tipo] === undefined) return;

      inp.value = vals[tipo];

      // Si es PV, re-formateamos por si quedó sin máscara
      if (tipo === "PV" && inp.classList.contains("input-cierre-pv")) {
        formatearPVEnVivo(inp);
      }
    });
  });
}

function habilitarOrdenPorVendedor() {
  const th = document.getElementById("thVendedor");
  if (!th) return;

  // Evita doble bind si recargas el módulo
  if (th.dataset.sortBound === "1") {
    actualizarTrianguloVendedor();
    return;
  }
  th.dataset.sortBound = "1";

  th.addEventListener("click", () => {
    // guarda lo que el usuario ya escribió
    const snap = snapshotInputsCierre();

    // toggle
    ordenVendedorAsc = !ordenVendedorAsc;
    actualizarTrianguloVendedor();

    const ordenados = ordenarPorVendedor(vendedoresActuales);
    render(ordenados);

    // restaura inputs
    restoreInputsCierre(snap);
  });

  actualizarTrianguloVendedor();
}


// ============================
// Ordenar por Vendedor (DOM sort) + triángulo  (robusto para módulos ES)
// - No depende de variables globales
// - No re-renderiza: solo reordena <tr>, por lo que no se pierde lo digitado
// ============================
function ordenarFilasPorVendedorDOM() {
  if (!tbody) return;

  const filas = Array.from(tbody.querySelectorAll("tr"))
    .filter((tr) => tr.querySelector(".nombre-vendedor")); // ignora "Cargando…", "Sin vendedores", etc.

  filas.sort((a, b) => {
    const na = (a.querySelector(".nombre-vendedor")?.textContent || "").trim();
    const nb = (b.querySelector(".nombre-vendedor")?.textContent || "").trim();
    const cmp = na.localeCompare(nb, "es", { sensitivity: "base" });
    return ordenVendedorAsc ? cmp : -cmp;
  });

  for (const tr of filas) tbody.appendChild(tr);
}

function habilitarOrdenPorVendedorDOM() {
  const th = document.getElementById("thVendedor");
  if (!th) return;

  // Evita doble bind
  if (th.dataset.sortBoundDom === "1") {
    actualizarTrianguloVendedor();
    return;
  }
  th.dataset.sortBoundDom = "1";

  th.addEventListener("click", () => {
    ordenVendedorAsc = !ordenVendedorAsc;
    actualizarTrianguloVendedor();
    ordenarFilasPorVendedorDOM();
  });

  actualizarTrianguloVendedor();
}


	// ----------------------------
	// Utilidades
	// ----------------------------
	function mesAnteriorPorDefecto() {
	  const d = new Date();
	  d.setDate(1);
	  d.setMonth(d.getMonth() - 1);
	  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
	}

	function rangoMes(anio, mes) {
	  const ini = new Date(anio, mes - 1, 1);
	  const fin = new Date(anio, mes, 0);
	  const iniMes = `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, "0")}-01`;
	  const finMes = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(
		fin.getDate()
	  ).padStart(2, "0")}`;
	  return { iniMes, finMes };
	}

	function numOrNull(v) {
	  if (v === null || v === undefined) return null;
	  const s = String(v).trim();
	  if (!s) return null;
	  const n = Number(s);
	  return Number.isFinite(n) ? n : null;
	}

	function setSelectValueRobusto(select, valuePreferida) {
	  if (!select) return false;
	  const v = String(valuePreferida);

	  if ([...select.options].some((o) => o.value === v)) {
		select.value = v;
		return true;
	  }

	  const v2 = v.padStart(2, "0");
	  if ([...select.options].some((o) => o.value === v2)) {
		select.value = v2;
		return true;
	  }

	  const opt = document.createElement("option");
	  opt.value = v;
	  opt.textContent = v;
	  select.appendChild(opt);
	  select.value = v;
	  return true;
	}

	// ----------------------------
	// PV (Producto Voluntario) — Formateo en vivo CLP
	// ----------------------------
	const MAX_PV = 999999999;

	function soloDigitos(s) {
	  return String(s || "").replace(/[^\d]/g, "");
	}

	function clampPV(n) {
	  const num = Number(n || 0);
	  if (!Number.isFinite(num) || num <= 0) return 0;
	  return Math.min(num, MAX_PV);
	}

	function formatearCLP(n) {
	  const v = clampPV(n);
	  if (!v) return "";
	  return "$" + new Intl.NumberFormat("es-CL").format(v);
	}

	function parseCLP(value) {
	  const dig = soloDigitos(value);
	  if (!dig) return null;
	  const num = clampPV(Number(dig));
	  return num || null;
	}

	/**
	 * Formatea PV en vivo y mantiene el cursor estable basado en la cantidad de dígitos a la izquierda.
	 */
	function formatearPVEnVivo(inputEl) {
	  const prev = inputEl.value ?? "";
	  const caret = inputEl.selectionStart ?? prev.length;

	  // cuántos dígitos había antes del cursor (en el texto anterior)
	  const digitosAntes = soloDigitos(prev.slice(0, caret)).length;

	  // número cappeado
	  const dig = soloDigitos(prev);
	  const num = dig ? clampPV(Number(dig)) : 0;

	  const next = num ? formatearCLP(num) : "";
	  inputEl.value = next;

	  if (!next) return;

	  // ubicar el cursor: avanzar hasta que pasen "digitosAntes" dígitos
	  let count = 0;
	  let newPos = next.length;

	  for (let i = 0; i < next.length; i++) {
		if (/\d/.test(next[i])) count++;
		if (count >= digitosAntes) {
		  newPos = i + 1;
		  break;
		}
	  }

	  newPos = Math.max(0, Math.min(newPos, next.length));
	  inputEl.setSelectionRange(newPos, newPos);
	}

	// ----------------------------
	// DOM bind (robusto embebido)
	// ----------------------------
	function bindDOM() {
	  const root = document.getElementById(ROOT_ID);
	  const scope = root || document;

	  tabla = scope.querySelector("#tablaCierre") || document.querySelector("#tablaCierre");
	  tbody = tabla?.querySelector("tbody") || null;

	  btnVolver = scope.querySelector("#btnVolver") || document.querySelector("#btnVolver");
	  btnGuardarCierre =
		scope.querySelector("#btnGuardarCierre") || document.querySelector("#btnGuardarCierre");

	  selectMes = scope.querySelector("#selectMes") || document.querySelector("#selectMes");
	  selectAnio = scope.querySelector("#selectAnio") || document.querySelector("#selectAnio");

	  return !!(tabla && tbody && selectMes && selectAnio && btnGuardarCierre);
	}

	async function esperarDOM(maxMs = 8000) {
	  if (bindDOM()) return true;

	  return await new Promise((resolve) => {
		const start = Date.now();
		const obs = new MutationObserver(() => {
		  if (bindDOM()) {
			obs.disconnect();
			resolve(true);
		  } else if (Date.now() - start > maxMs) {
			obs.disconnect();
			resolve(false);
		  }
		});

		obs.observe(document.documentElement, { childList: true, subtree: true });

		setTimeout(() => {
		  obs.disconnect();
		  resolve(bindDOM());
		}, maxMs);
	  });
	}

	// ----------------------------
	// Contexto
	// ----------------------------
	function leerEquipoActivo() {
	  return localStorage.getItem("idEquipoActivo") || sessionStorage.getItem("idEquipoActivo") || null;
	}

	// ----------------------------
	// Filtros Mes/Año
	// ----------------------------
	function inicializarFiltros() {
	  const anioActual = new Date().getFullYear();

	  selectAnio.innerHTML = "";
	  for (let y = anioActual - 3; y <= anioActual + 1; y++) {
		const opt = document.createElement("option");
		opt.value = String(y);
		opt.textContent = String(y);
		selectAnio.appendChild(opt);
	  }

	  const def = mesAnteriorPorDefecto();
	  setSelectValueRobusto(selectMes, def.mes);
	  setSelectValueRobusto(selectAnio, def.anio);

	  selectMes.addEventListener("change", cargarCierre);
	  selectAnio.addEventListener("change", cargarCierre);
	}

	function obtenerMesAnioFiltro() {
	  const def = mesAnteriorPorDefecto();
	  const mes = parseInt(selectMes?.value || "", 10) || def.mes;
	  const anio = parseInt(selectAnio?.value || "", 10) || def.anio;
	  return { mes, anio };
	}

	// ----------------------------
	// Datos vendedores activos por mes
	// ----------------------------
	async function obtenerVendedoresDelMes(idEquipoLocal, anio, mes) {
	  const { iniMes, finMes } = rangoMes(anio, mes);

	  const { data, error } = await supabase
		.from("equipo_vendedor")
		.select(
		  `
		  id_vendedor,
		  fecha_inicio,
		  fecha_fin,
		  vendedores (
			id_vendedor,
			nombre
		  )
		`
		)
		.eq("id_equipo", idEquipoLocal)
		.lte("fecha_inicio", finMes)
		.or(`fecha_fin.is.null,fecha_fin.gte.${iniMes}`);

	  if (error) throw error;

	  const rows = (data || [])
		.filter((r) => r?.vendedores?.id_vendedor)
		.map((r) => ({
		  id_vendedor: r.vendedores.id_vendedor,
		  nombre: r.vendedores.nombre || "",
		}));

	  const seen = new Set();
	  const out = [];
	  for (const r of rows) {
		if (seen.has(r.id_vendedor)) continue;
		seen.add(r.id_vendedor);
		out.push(r);
	  }
	  out.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
	  return out;
	}

	// ----------------------------
	// Montos existentes (ventas_mensuales)
	// ----------------------------
	async function obtenerMontosExistentes(idEquipoLocal, anio, mes, idsVendedores) {
	  existentesPorVendedor = new Map();

	  // Precarga desde ventas (histórico real) vía RPC
	  // Requiere function: public.rpc_cierre_ventas_mes(p_id_equipo uuid, p_anio int, p_mes int)
	  try {
		const { data, error } = await supabase.rpc("rpc_cierre_ventas_mes", {
		  p_id_equipo: idEquipoLocal,
		  p_anio: anio,
		  p_mes: mes,
		});

		if (error) throw error;

		(data || []).forEach((r) => {
		  existentesPorVendedor.set(r.id_vendedor, {
			TOPE: Number(r.tope || 0) || 0,
			SOBRE: Number(r.sobre || 0) || 0,
			BAJO: Number(r.bajo || 0) || 0,
			PLAN: Number(r.plan || 0) || 0,
			PV: Number(r.pv || 0) || 0,
		  });
		});
	  } catch (err) {
		console.warn(
		  "CIERRE_VENTAS: no se pudo precargar desde ventas (RPC/RLS):",
		  err?.message || err
		);
		existentesPorVendedor = new Map();
	  }
	}

	// ----------------------------
	// Render (sin Acciones)
	// ----------------------------
	function render(vendedores) {
	  tbody.innerHTML = "";

	  if (!idEquipo) {
		tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay equipo seleccionado</td></tr>`;
		return;
	  }

	  if (!vendedores.length) {
		tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Sin vendedores para el período seleccionado</td></tr>`;
		return;
	  }

	  for (const v of vendedores) {
		const ex = existentesPorVendedor.get(v.id_vendedor) || {};
		const tr = document.createElement("tr");
		tr.dataset.idVendedor = v.id_vendedor;

		tr.innerHTML = `
		  <td class="col-vendedor"><span class="nombre-vendedor">${v.nombre || ""}</span></td>
		  <td><input class="input-cierre" type="number" min="0" step="1" data-tipo="BAJO" value="${(ex.TOPE ?? 0) + (ex.SOBRE ?? 0) + (ex.BAJO ?? 0) || ""}"></td>
		  <td><input class="input-cierre" type="number" min="0" step="1" data-tipo="SOBRE" value="${(ex.TOPE ?? 0) + (ex.SOBRE ?? 0) || ""}"></td>
		  <td><input class="input-cierre" type="number" min="0" step="1" data-tipo="TOPE" value="${ex.TOPE ?? ""}"></td>
		  <td><input class="input-cierre" type="number" min="0" step="1" data-tipo="PLAN" value="${ex.PLAN ?? ""}"></td>

		  <!-- PV: text + formateo CLP en vivo -->
		  <td>
			<input
			  class="input-cierre input-cierre-pv"
			  type="text"
			  inputmode="numeric"
			  autocomplete="off"
			  data-tipo="PV"
			  value="${ex.PV != null ? formatearCLP(ex.PV) : ""}"
			>
		  </td>
		`;
		tbody.appendChild(tr);
	  }
	}

	// ----------------------------
	// Guardado masivo (UN solo botón)
	// ----------------------------
	function construirCambiosParaUpsertDelete(anio, mes) {
	  const upserts = [];
	  const deletes = []; // {id_vendedor, tipos:[]}

	  const filas = [...tbody.querySelectorAll("tr[data-id-vendedor], tr[data-idvendedor], tr")];

	  for (const tr of filas) {
		const idVendedor = tr.dataset.idVendedor;
		if (!idVendedor) continue;

		const inputs = [...tr.querySelectorAll("input.input-cierre")];
		if (!inputs.length) continue;

		const ex = existentesPorVendedor.get(idVendedor) || {};
		const delTipos = [];

		const valores = {};
		for (const inp of inputs) {
		  const tipo = String(inp.dataset.tipo || "").toUpperCase();

		  // PV viene formateado ($ + puntos): parse especial con tope 999.999.999
		  if (tipo === "PV") valores[tipo] = parseCLP(inp.value);
		  else valores[tipo] = numOrNull(inp.value);
		}

		// >>> Ajuste de métricas acumuladas (UI: >70, >40, TF)
		// UI muestra:
		//   TOPE  -> >70
		//   SOBRE -> >40 (= TOPE + SOBRE)
		//   BAJO  -> TF  (= TOPE + SOBRE + BAJO)
		// Para persistir en BD como tipos base, descomponemos:
		//   tope = >70
		//   sobre = max(>40 - >70, 0)
		//   bajo = max(TF - >40, 0)
		{
		  const ui70 = valores.TOPE;
		  const ui40 = valores.SOBRE;
		  const uiTF = valores.BAJO;

		  const n70 = ui70 === null ? null : Number(ui70 || 0);
		  const n40 = ui40 === null ? null : Number(ui40 || 0);
		  const nTF = uiTF === null ? null : Number(uiTF || 0);

		  // Defaults: si no ingresan acumulados, se asume consistencia
		  const a70 = n70 ?? 0;
		  const a40 = (n40 ?? a70);
		  const aTF = (nTF ?? a40);

		  const baseTope  = a70;
		  const baseSobre = Math.max(a40 - a70, 0);
		  const baseBajo  = Math.max(aTF - a40, 0);

		  valores.TOPE  = baseTope;
		  valores.SOBRE = baseSobre;
		  valores.BAJO  = baseBajo;
		}

		for (const tipo of ["TOPE", "SOBRE", "BAJO", "PLAN", "PV"]) {
		  const v = valores[tipo];
		  const vNum = v === null ? 0 : Number(v || 0);

		  if (v !== null && vNum > 0) {
			upserts.push({
			  id_equipo: idEquipo,
			  id_vendedor: idVendedor,
			  anio,
			  mes,
			  tipo_venta: tipo,
			  monto: vNum,
			  descripcion: "EMPTY",
			});
		  } else {
			if (ex[tipo] !== undefined) delTipos.push(tipo);
		  }
		}

		if (delTipos.length) deletes.push({ id_vendedor: idVendedor, tipos: delTipos });
	  }

	  return { upserts, deletes };
	}

	async function guardarTodo() {
	  const rol = String(rolActual || "").toLowerCase();
	  if (rol && rol !== "supervisor") {
		alert("Este módulo es solo para supervisor.");
		return;
	  }

	  if (!idEquipo) {
		alert("No hay equipo seleccionado.");
		return;
	  }

	  const { mes, anio } = obtenerMesAnioFiltro();

	  const textoOriginal = btnGuardarCierre.textContent;
	  btnGuardarCierre.disabled = true;
	  btnGuardarCierre.textContent = "Guardando...";

	  try {
		const { upserts, deletes } = construirCambiosParaUpsertDelete(anio, mes);

		if (!upserts.length && !deletes.length) {
		  alert("No hay cambios para guardar.");
		  return;
		}

		if (upserts.length) {
		  const { error } = await supabase
			.from("ventas_mensuales")
			.upsert(upserts, { onConflict: "id_equipo,id_vendedor,anio,mes,tipo_venta" });
		  if (error) throw error;
		}

		for (const d of deletes) {
		  const { error: errDel } = await supabase
			.from("ventas_mensuales")
			.delete()
			.eq("id_equipo", idEquipo)
			.eq("id_vendedor", d.id_vendedor)
			.eq("anio", anio)
			.eq("mes", mes)
			.in("tipo_venta", d.tipos);

		  if (errDel) throw errDel;
		}

		alert("Cierre mensual guardado.");
		await cargarCierre();
	  habilitarOrdenPorVendedorDOM();
	  } catch (err) {
		console.error("Error guardando cierre mensual:", err);
		alert(
		  "No se pudo guardar el cierre mensual.\n" +
			"Causa probable: tabla ventas_mensuales no existe o RLS bloquea.\n" +
			(err?.message || "Revisa consola.")
		);
	  } finally {
		btnGuardarCierre.disabled = false;
		btnGuardarCierre.textContent = textoOriginal;
	  }
	}

	// ----------------------------
	// Carga
	// ----------------------------
	async function cargarCierre() {
	  try {
		tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Cargando…</td></tr>`;

		idEquipo = leerEquipoActivo();
		if (!idEquipo) {
		  render([]);
		  return;
		}

		const { mes, anio } = obtenerMesAnioFiltro();

		const vendedores = await obtenerVendedoresDelMes(idEquipo, anio, mes);
		const ids = vendedores.map((v) => v.id_vendedor);

		await obtenerMontosExistentes(idEquipo, anio, mes, ids);

		vendedoresActuales = vendedores;
		render(ordenarPorVendedor(vendedoresActuales));
		ordenarFilasPorVendedorDOM();
	  } catch (err) {
		console.error("Error cargando cierre mensual:", err);
		tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error cargando datos (revisa consola)</td></tr>`;
	  }
	}

	// ----------------------------
	// Eventos UI
	// ----------------------------
	function bindEventos() {
	  btnGuardarCierre.addEventListener("click", guardarTodo);

	  // PV: formateo CLP en vivo (solo campo PV)
	  tbody.addEventListener("input", (e) => {
		const inp = e.target.closest("input.input-cierre-pv");
		if (!inp) return;
		formatearPVEnVivo(inp);
	  });

	  if (btnVolver) {
		btnVolver.addEventListener("click", (e) => {
		  e.preventDefault();
		  // supervisor.js lo maneja global
		});
	  }

	  window.addEventListener("equipo:change", (ev) => {
		const nuevo = ev?.detail?.idEquipo;
		if (!nuevo) return;
		idEquipo = nuevo;
		cargarCierre();
	  });
	}

	// ----------------------------
	// INIT
	// ----------------------------
	(async function init() {
	  const okDom = await esperarDOM(8000);
	  if (!okDom) {
		console.error("❌ CIERRE_VENTAS: No se encontraron elementos del DOM (tabla/filtros/botón).");
		return;
	  }

	  inicializarFiltros();
	  bindEventos();
	  await cargarCierre();
	  habilitarOrdenPorVendedorDOM();
	})();
