// scripts/session-manager.js
// Session Manager — reconexión y sesión expirada (transversal)

let __started = false;
let __unsub = null;

const DEFAULTS = {
  loginPath: "../index.html",
  retryBaseMs: 500,
  retryMaxMs: 6000,
  maxRetries: 3,
  transientStatus: new Set([408, 409, 425, 429, 500, 502, 503, 504]),
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isNetworkLikeError(err) {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed") ||
    msg.includes("timeout") ||
    msg.includes("ECONN") ||
    msg.includes("ENOTFOUND")
  );
}

function getStatus(err) {
  return (
    err?.status ||
    err?.statusCode ||
    err?.code ||
    err?.cause?.status ||
    err?.cause?.statusCode ||
    null
  );
}

function shouldRetry(err, cfg) {
  const status = getStatus(err);

  // 401/403: normalmente no es transitorio; requiere re-login
  if (status === 401 || status === 403) return false;

  if (status && cfg.transientStatus.has(Number(status))) return true;
  if (isNetworkLikeError(err)) return true;

  return false;
}

function jitter(ms) {
  const j = Math.floor(Math.random() * 120);
  return ms + j;
}

function backoff(attempt, cfg) {
  const ms = Math.min(cfg.retryMaxMs, cfg.retryBaseMs * Math.pow(2, attempt));
  return jitter(ms);
}

// En modo "URL limpia" (shell + iframe), NO navegamos por window.location aquí.
// Solo pedimos al contenedor (index.html) que vuelva a mostrar login.
function notifyShellGoLogin() {
  try {
    const w = window.top || window.parent || window;
    if (typeof w.__appLogout === "function") {
      w.__appLogout();
      return true;
    }
  } catch (_) {}
  return false;
}

async function safeSignOutAndRedirect(supabase, cfg) {
  try { window.__AV_SKIP_GUARD__ = true; } catch (_) {}

  try { await supabase.auth.signOut(); } catch (_) {}

  // Preferir shell
  if (notifyShellGoLogin()) return;

  // Fallback legado (si no hay shell/iframe)
  try { window.location.replace(cfg.loginPath); } catch (_) {}
}

/**
 * startSessionManager({ supabase, ...cfg })
 * - Listener global onAuthStateChange
 * - Helper: withRetry(fn)
 */
export function startSessionManager({ supabase, ...overrides } = {}) {
  if (__started) return { stop: stopSessionManager, withRetry: makeWithRetry(DEFAULTS) };
  if (!supabase) throw new Error("startSessionManager: falta supabase");

  const cfg = { ...DEFAULTS, ...overrides };
  __started = true;

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      // Ya está fuera: NO llamar signOut de nuevo (evita loops).
      if (!notifyShellGoLogin()) {
        try { window.location.replace(cfg.loginPath); 

  // Exponer logout centralizado para vistas embebidas (iframe)
  try {
    const w = window;
    w.__avLogout = () => safeSignOutAndRedirect(supabase, cfg);
  } catch (_) {}
} catch (_) {}
      }
      return;
    }

    if (event === "TOKEN_REFRESHED") {
      return;
    }

    // En INITIAL_SESSION es normal recibir null si no hay sesión.
    if (event === "SIGNED_IN" && !session?.user?.id) {
      safeSignOutAndRedirect(supabase, cfg);
      return;
    }
  });

  __unsub = data?.subscription?.unsubscribe || null;

  return {
    stop: stopSessionManager,
    withRetry: makeWithRetry(cfg),
  };
}

export function stopSessionManager() {
  try {
    if (__unsub) __unsub();
  } catch (_) {}
  __unsub = null;
  __started = false;
}

/**
 * Wrapper de reintento para llamadas críticas (RPC / selects)
 * Uso: await withRetry(() => supabase.rpc(...))
 */
function makeWithRetry(cfg) {
  return async function withRetry(fn, opts = {}) {
    const max = Number.isFinite(opts.maxRetries) ? opts.maxRetries : cfg.maxRetries;

    let lastErr = null;
    for (let attempt = 0; attempt <= max; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;

        const st = getStatus(e);
        if (st === 401 || st === 403) throw e;

        if (!shouldRetry(e, cfg) || attempt === max) throw e;

        await sleep(backoff(attempt, cfg));
      }
    }
    throw lastErr;
  };
}
