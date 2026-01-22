import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function fetchJson(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "sync_feriados_cl" } });
  const text = await r.text().catch(() => "");
  if (!r.ok) {
    throw new Error(
      `Fetch failed url=${url} status=${r.status} body=${text.slice(0, 300)}`
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON parse failed url=${url} body=${text.slice(0, 300)}`);
  }
}

async function fetchFeriadosChile(year: number) {
  // Fuente principal (estructura agrupada por mes)
  try {
    return await fetchJson(`https://feriados-cl.netlify.app/holidays/${year}`);
  } catch {
    return await fetchJson(`https://feriados-cl.netlify.app/api/holidays/${year}`);
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

serve(async (req) => {
  try {
    // Seguridad simple para job interno: token compartido (querystring)
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const expected = Deno.env.get("SYNC_TOKEN");

    if (!expected) {
      return new Response(
        JSON.stringify({ code: 500, message: "SYNC_TOKEN no configurado en Secrets" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!token || token !== expected) {
      return new Response(JSON.stringify({ code: 401, message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ code: 500, message: "Faltan env SUPABASE_URL o SERVICE_ROLE_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const year = new Date().getFullYear();
    const data = await fetchFeriadosChile(year);

    // Estructura esperada (según tu DEBUG_SAMPLE):
    // {
    //   "year": 2026,
    //   "feriados": {
    //     "enero": [{ mes, dia, descripcion, tipo, irrenunciable }, ...],
    //     ...
    //   }
    // }
    const feriadosPorMes = data?.feriados;
    if (!feriadosPorMes || typeof feriadosPorMes !== "object") {
      throw new Error('Formato inesperado: falta propiedad "feriados"');
    }

    const payload: Array<{
      fecha: string;
      nombre: string;
      irrenunciable: boolean;
      tipo: string | null;
      fuente: string;
    }> = [];

    for (const mesKey of Object.keys(feriadosPorMes)) {
      const arr = feriadosPorMes[mesKey];
      if (!Array.isArray(arr)) continue;

      for (const f of arr) {
        const mes = Number(f?.mes);
        const dia = Number(f?.dia);

        if (!Number.isFinite(mes) || !Number.isFinite(dia)) continue;
        if (mes < 1 || mes > 12 || dia < 1 || dia > 31) continue;

        const fecha = `${year}-${pad2(mes)}-${pad2(dia)}`;

        payload.push({
          fecha,
          nombre: String(f?.descripcion ?? "Feriado"),
          irrenunciable: Boolean(f?.irrenunciable ?? false),
          tipo: f?.tipo ? String(f.tipo) : null,
          fuente: "feriados-cl",
        });
      }
    }

    if (payload.length === 0) {
      return new Response(
        JSON.stringify({ code: 500, message: "Payload vacío: no se detectaron feriados" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabase
      .from("feriados")
      .upsert(payload, { onConflict: "fecha" });

    if (error) {
      throw new Error(`Upsert failed: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ code: 200, message: `OK ${year}`, upserted: payload.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync_feriados_cl error:", e);
    return new Response(JSON.stringify({ code: 500, message: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
