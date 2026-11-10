import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const HOST_ALVO = "hockey4life.com.br";

type SiteEntry = { siteUrl: string; permissionLevel?: string };

function headers() {
  const a = process.env.LOVABLE_API_KEY;
  const b = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;
  if (!a || !b) throw new Error("Search Console não está conectado.");
  return { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": b };
}

/** Propriedades verificadas que cobrem hockey4life.com.br (qualquer protocolo / www). */
async function listarPropriedades(): Promise<string[]> {
  const r = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: headers() });
  if (!r.ok) throw new Error(`Search Console [${r.status}]: ${await r.text()}`);
  const { siteEntry = [] } = (await r.json()) as { siteEntry?: SiteEntry[] };
  return siteEntry
    .filter((e) => e.permissionLevel !== "siteUnverifiedUser")
    .filter((e) => {
      if (e.siteUrl.startsWith("sc-domain:")) return e.siteUrl.slice(10).toLowerCase() === HOST_ALVO;
      try { return new URL(e.siteUrl).hostname.replace(/^www\./, "") === HOST_ALVO; } catch { return false; }
    })
    .map((e) => e.siteUrl);
}

async function exigirPainel(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("tem_permissao", { _user_id: ctx.userId, _permissao: "ver_painel" });
  if (!data) throw new Error("Sem permissão.");
}

const input = z.object({
  siteUrl: z.string().max(300).nullable().default(null),
  dias: z.number().int().min(7).max(90).default(28),
});

export type LinhaGSC = { chave: string; cliques: number; impressoes: number; ctr: number; posicao: number };

export const getSearchConsole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => input.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await exigirPainel(context);
    let props: string[];
    try { props = await listarPropriedades(); }
    catch (e: any) { return { status: "erro" as const, erro: e.message as string }; }
    if (props.length === 0) return { status: "sem_propriedade" as const };

    let site: string | null = null;
    if (data.siteUrl) {
      if (!props.includes(data.siteUrl)) return { status: "escolher" as const, candidatos: props };
      site = data.siteUrl;
    } else if (props.length === 1) site = props[0];
    else return { status: "escolher" as const, candidatos: props };

    // O Search Console tem atraso de ~3 dias.
    const fim = new Date(Date.now() - 3 * 864e5);
    const ini = new Date(fim.getTime() - (data.dias - 1) * 864e5);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const consultar = async (dimensions: string[], rowLimit: number) => {
      const r = await fetch(`${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(site!)}/searchAnalytics/query`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: iso(ini), endDate: iso(fim), dimensions, rowLimit }),
      });
      if (r.status === 403) throw new Error("A conta Google conectada não tem acesso a esta propriedade.");
      if (!r.ok) throw new Error(`Search Console [${r.status}]: ${await r.text()}`);
      const j = (await r.json()) as { rows?: Array<{ keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }> };
      return (j.rows ?? []).map<LinhaGSC>((x) => ({
        chave: x.keys?.[0] ?? "", cliques: x.clicks, impressoes: x.impressions, ctr: x.ctr, posicao: x.position,
      }));
    };
    try {
      const [totais, buscas, paginas, diario] = await Promise.all([
        consultar([], 1), consultar(["query"], 25), consultar(["page"], 25), consultar(["date"], 100),
      ]);
      return {
        status: "ok" as const, siteUrl: site, candidatos: props, inicio: iso(ini), fim: iso(fim),
        totais: totais[0] ?? { chave: "", cliques: 0, impressoes: 0, ctr: 0, posicao: 0 },
        buscas, paginas, diario,
      };
    } catch (e: any) {
      return { status: "erro" as const, erro: e.message as string, candidatos: props };
    }
  });
