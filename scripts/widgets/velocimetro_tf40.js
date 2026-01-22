/* =========================================================================
   APP Ventas — Widget Velocímetro TF40 (Supervisor) — ES Module (v10)

   Ajuste fino:
   - El arco quedaba muy "abajo" y se veía cortado visualmente: se sube el centro (cy)
     y se aumenta levemente el alto del SVG.
   - Badge: separador correcto "TF40: 36".
   - Alineación vertical más limpia (centrado).

   Reglas:
   - Dentro de .bloque-supervisor.
   - No sobresale (overflow hidden).
   - VA/VO sobre el arco. Badge compacto TF40.
   ========================================================================= */

const DEFAULT_REFRESH_MS = 2 * 60 * 1000;
const PAD = 10;

const SVG_W = 120;
const SVG_H = 58;
const STROKE = 7;

function $(sel, root = document) { return root.querySelector(sel); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function isFiniteNumber(n) { return typeof n === "number" && Number.isFinite(n); }

function formatNumberCL(n) {
  if (!isFiniteNumber(n)) return "—";
  const hasDecimals = Math.abs(n % 1) > 0.000001;
  return n.toLocaleString("es-CL", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0
  });
}

function getMesAnioChile() {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" });
  const parts = dtf.formatToParts(new Date());
  const month = Number(parts.find(p => p.type === "month")?.value);
  const year = Number(parts.find(p => p.type === "year")?.value);
  return { month, year };
}

function findHostBlock() {
  return $(".bloque-supervisor") || $("#bloque-supervisor") || null;
}

function injectStylesOnce() {
  if ($("#av-tf40-mini-styles-v10")) return;

  const style = document.createElement("style");
  style.id = "av-tf40-mini-styles-v10";
  style.textContent = `
    .av-tf40-mini-wrap{
      position:absolute;
      left:${PAD}px;
      top:${PAD}px;
      display:flex;
      align-items:center;
      gap:8px;
      z-index:50;
      pointer-events:none;
      max-width: calc(100% - ${PAD*2}px);
    }

    .av-tf40-mini-svg{
      width:${SVG_W}px;
      height:${SVG_H}px;
      display:block;
      background:rgba(255,255,255,0.78);
      backdrop-filter: blur(6px);
      border-radius:12px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.10);
      overflow:hidden;
      flex: 0 0 auto;
    }

    .av-tf40-mini-badge{
      display:inline-flex;
      align-items:center;
      padding:6px 8px;
      background:rgba(255,255,255,0.78);
      backdrop-filter: blur(6px);
      border-radius:12px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.10);
      font: 700 11px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color:#0f172a;
      white-space:nowrap;
      flex: 0 0 auto;
    }
    .av-tf40-mini-badge b{ font-weight:800; }

    .av-tf40-mini-err{
      display:block;
      margin-left:8px;
      font: 700 10px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color:#b91c1c;
      white-space:normal;
      max-width:180px;
    }
  `;
  document.head.appendChild(style);
}

function ensureHost(host) {
  const cs = window.getComputedStyle(host);
  if (cs.position === "static") host.style.position = "relative";
  if (cs.overflow !== "hidden") host.style.overflow = "hidden";

  const needed = PAD * 2 + SVG_H;
  const currentH = host.getBoundingClientRect().height;
  if (currentH + 0.5 < needed) host.style.minHeight = `${needed}px`;
}

function ensureMountPoint(containerId = "velocimetro-tf40") {
  const host = findHostBlock();
  if (!host) return null;

  ensureHost(host);

  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement("div");
    el.id = containerId;
    host.appendChild(el);
  }

  el.classList.add("av-tf40-mini-wrap");
  if (el.parentElement !== host) host.appendChild(el);
  return el;
}

function renderMiniGauge({ containerId, va, vo, ventasAcum, errorMsg }) {
  injectStylesOnce();
  const host = findHostBlock();
  if (!host) return;

  ensureHost(host);

  const mount = ensureMountPoint(containerId);
  if (!mount) return;

  const maxBase = Math.max(
    isFiniteNumber(va) ? va : 0,
    isFiniteNumber(vo) ? vo : 0,
    1
  );
  const max = maxBase * 1.25;

  function valueToAngle(v) {
    const p = clamp((v || 0) / max, 0, 1);
    return -180 + p * 180;
  }

  const W = SVG_W, H = SVG_H;
  const cx = W / 2;
  const cy = H - 14;               // sube el centro => más visible
  const r = Math.min(26, cy - STROKE);

  function polarToXY(angleDeg, radius) {
    const a = (Math.PI / 180) * angleDeg;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  }

  const start = polarToXY(-180, r);
  const end = polarToXY(0, r);

  const vaAngle = valueToAngle(isFiniteNumber(va) ? va : 0);
  const voAngle = valueToAngle(isFiniteNumber(vo) ? vo : 0);

  const needleEnd = polarToXY(vaAngle, r - 7);
  const markerOuter = polarToXY(voAngle, r);
  const markerInner = polarToXY(voAngle, r - 7);

  const vaTxt = formatNumberCL(va);
  const voTxt = formatNumberCL(vo);
  const tf40Txt = isFiniteNumber(ventasAcum) ? formatNumberCL(ventasAcum) : "—";

  mount.innerHTML = `
    <svg class="av-tf40-mini-svg" viewBox="0 0 ${W} ${H}" aria-label="Velocímetro TF40">
      <path d="M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}"
            fill="none" stroke="rgba(15,23,42,0.22)" stroke-width="${STROKE}" stroke-linecap="round"></path>

      ${[0,0.25,0.5,0.75,1].map(p=>{
        const a = -180 + p*180;
        const o = polarToXY(a, r);
        const i = polarToXY(a, r-4.8);
        return `<line x1="${i.x.toFixed(2)}" y1="${i.y.toFixed(2)}" x2="${o.x.toFixed(2)}" y2="${o.y.toFixed(2)}"
                       stroke="rgba(15,23,42,0.35)" stroke-width="2" />`;
      }).join("")}

      <line x1="${markerInner.x.toFixed(2)}" y1="${markerInner.y.toFixed(2)}"
            x2="${markerOuter.x.toFixed(2)}" y2="${markerOuter.y.toFixed(2)}"
            stroke="rgba(220,38,38,0.95)" stroke-width="3.6" stroke-linecap="round"></line>

      <line x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}"
            x2="${needleEnd.x.toFixed(2)}" y2="${needleEnd.y.toFixed(2)}"
            stroke="rgba(2,132,199,0.95)" stroke-width="3.6" stroke-linecap="round"></line>

      <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="4.2"
              fill="rgba(15,23,42,0.85)"></circle>

      <text x="10" y="14" font-size="9.2" font-weight="800"
            font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="rgba(15,23,42,0.92)">
        VA: ${vaTxt}
      </text>
      <text x="${(W*0.57).toFixed(0)}" y="14" font-size="9.2" font-weight="800"
            font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="rgba(220,38,38,0.95)">
        VO: ${voTxt}
      </text>
    </svg>

    <div class="av-tf40-mini-badge">TF40: <b>${tf40Txt}</b></div>
    ${errorMsg ? `<span class="av-tf40-mini-err">${errorMsg}</span>` : ""}
  `;
}

async function fetchTF40(options) {
  const supabase = options?.supabase;
  const containerId = options?.containerId || "velocimetro-tf40";
  const getEquipoActivo = options?.getEquipoActivo;

  if (!supabase || typeof supabase.rpc !== "function") {
    renderMiniGauge({ containerId, va: null, vo: null, ventasAcum: null, errorMsg: "Supabase no disponible" });
    return;
  }

  const id_equipo = (typeof getEquipoActivo === "function") ? getEquipoActivo() : null;
  if (!id_equipo) {
    renderMiniGauge({ containerId, va: null, vo: null, ventasAcum: null, errorMsg: "Sin equipo activo" });
    return;
  }

  const { month, year } = getMesAnioChile();
  const { data, error } = await supabase.rpc("get_velocimetro_supervisor_tf40_equipo", {
    p_id_equipo: id_equipo,
    p_mes: month,
    p_anio: year
  });

  if (error) {
    renderMiniGauge({ containerId, va: null, vo: null, ventasAcum: null, errorMsg: error.message || "Error RPC" });
    return;
  }

  const row = Array.isArray(data) ? (data[0] || {}) : (data || {});
  renderMiniGauge({
    containerId,
    va: Number(row.va_tf40),
    vo: Number(row.vo_tf40),
    ventasAcum: Number(row.ventas_acum_tf40),
    errorMsg: ""
  });
}

export async function initVelocimetroTF40(options = {}) {
  const containerId = options.containerId || "velocimetro-tf40";
  injectStylesOnce();
  ensureMountPoint(containerId);

  const refreshMs = Number(options.refreshMs || DEFAULT_REFRESH_MS);

  await fetchTF40(options);

  if (refreshMs > 0) setInterval(() => fetchTF40(options), refreshMs);

  const host = findHostBlock();
  if (host) host.addEventListener("change", () => fetchTF40(options), true);

  window.addEventListener("storage", (e) => {
    if (e.key === "idEquipoActivo") fetchTF40(options);
  });

  window.addEventListener("resize", () => {
    const h = findHostBlock();
    if (h) ensureHost(h);
  });
}
