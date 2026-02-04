import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function fetchJson(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "sync_feriados_cl" } });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Fetch failed ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

async function fetchFeriadosChile(year: number) {
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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const expected = Deno.env.get("SYNC_TOKEN");

    if (!expected || token !== expected) {
      return new Response(JSON.stringify({ code: 401, message: "Unauthorized" }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const year = new Date().getFullYear();
    const data = await fetchFeriadosChile(year);
    const feriadosPorMes = data?.feriados;

    if (!feriadosPorMes) throw new Error("Formato inesperado API feriados");

    const payload: any[] = [];
    const fechasApi = new Set<string>();

    for (const mesKey of Object.keys(feriadosPorMes)) {
      for (const f of feriadosPorMes[mesKey] || []) {
        const mes = Number(f.mes);
        const dia = Number(f.dia);
        if (!mes || !dia) continue;

        const fecha = `${year}-${pad2(mes)}-${pad2(dia)}`;
        fechasApi.add(fecha);

        payload.push({
          fecha,
          nombre: String(f.descripcion ?? "Feriado"),
          irrenunciable: Boolean(f.irrenunciable ?? false),
          tipo: f.tipo ?? null,
          fuente: "api",
        });
      }
    }

    // 1️⃣ UPSERT
    const { error: upsertError } = await supabase
      .from("feriados")
      .upsert(payload, { onConflict: "fecha" });

    if (upsertError) throw upsertError;

    // 2️⃣ DELETE feriados API que ya no existen
    const { error: deleteError } = await supabase
      .from("feriados")
      .delete()
      .eq("fuente", "api")
      .gte("fecha", `${year}-01-01`)
      .lte("fecha", `${year}-12-31`)
      .not("fecha", "in", `(${Array.from(fechasApi).join(",")})`);

    if (deleteError) throw deleteError;

    return new Response(
      JSON.stringify({
        code: 200,
        message: `OK ${year}`,
        upserted: payload.length,
        synced: fechasApi.size,
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ code: 500, message: String(e) }), { status: 500 });
  }
});