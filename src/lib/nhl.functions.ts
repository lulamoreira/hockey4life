import { createServerFn } from "@tanstack/react-start";

export type NhlTeam = {
  abbrev: string;
  nome: string;
  logo: string;
  score: number | null;
  record: string | null;
};

export type NhlJogo = {
  id: number;
  startUTC: string;
  estado: "FUT" | "PRE" | "LIVE" | "FINAL";
  periodo: string | null;
  tvs: string[];
  away: NhlTeam;
  home: NhlTeam;
  gameCenter: string;
};

export type NhlDados = {
  ultimos: NhlJogo[];
  proximos: NhlJogo[];
  atualizadoEm: string;
};

function normEstado(s: string): NhlJogo["estado"] {
  const u = (s || "").toUpperCase();
  if (u === "LIVE" || u === "CRIT") return "LIVE";
  if (u === "OFF" || u === "FINAL") return "FINAL";
  if (u === "PRE") return "PRE";
  return "FUT";
}

function toTeam(raw: any): NhlTeam {
  return {
    abbrev: raw?.abbrev ?? "",
    nome: raw?.name?.default ?? raw?.commonName?.default ?? raw?.abbrev ?? "",
    logo: raw?.logo ?? "",
    score: typeof raw?.score === "number" ? raw.score : null,
    record: raw?.record ?? null,
  };
}

function toJogo(raw: any): NhlJogo {
  const estado = normEstado(raw?.gameState);
  const per = raw?.periodDescriptor;
  let periodo: string | null = null;
  if (estado === "LIVE" && per) {
    const n = per.number ?? per.periodNumber;
    const tipo = per.periodType || "REG";
    const clock = raw?.clock?.timeRemaining;
    periodo = clock ? `${tipo === "OT" ? "PRORR." : `${n}º PER`} · ${clock}` : `${tipo === "OT" ? "PRORR." : `${n}º PER`}`;
  } else if (estado === "FINAL" && per?.periodType && per.periodType !== "REG") {
    periodo = per.periodType === "SO" ? "FINAL (PÊN)" : "FINAL (PRORR)";
  }
  const tvs: string[] = Array.isArray(raw?.tvBroadcasts)
    ? [...new Set(raw.tvBroadcasts.map((t: any) => t?.network).filter(Boolean))]
    : [];
  return {
    id: raw?.id,
    startUTC: raw?.startTimeUTC,
    estado,
    periodo,
    tvs,
    away: toTeam(raw?.awayTeam),
    home: toTeam(raw?.homeTeam),
    gameCenter: raw?.gameCenterLink ? `https://www.nhl.com${raw.gameCenterLink}` : "",
  };
}

export const getNhlGames = createServerFn({ method: "GET" }).handler(async (): Promise<NhlDados> => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch("https://api-web.nhle.com/v1/scoreboard/now", {
      signal: ctl.signal,
      headers: { accept: "application/json" },
    });
    if (!r.ok) throw new Error(`NHL API ${r.status}`);
    const json: any = await r.json();
    const todos: NhlJogo[] = [];
    for (const d of json?.gamesByDate ?? []) {
      for (const g of d?.games ?? []) todos.push(toJogo(g));
    }
    const agora = Date.now();
    const finalizados = todos
      .filter((j) => j.estado === "FINAL" || j.estado === "LIVE")
      .sort((a, b) => new Date(b.startUTC).getTime() - new Date(a.startUTC).getTime())
      .slice(0, 8);
    const futuros = todos
      .filter((j) => j.estado === "FUT" || j.estado === "PRE")
      .filter((j) => new Date(j.startUTC).getTime() >= agora - 30 * 60_000)
      .sort((a, b) => new Date(a.startUTC).getTime() - new Date(b.startUTC).getTime())
      .slice(0, 8);
    return { ultimos: finalizados, proximos: futuros, atualizadoEm: new Date().toISOString() };
  } catch (e) {
    clearTimeout(t);
    return { ultimos: [], proximos: [], atualizadoEm: new Date().toISOString() };
  } finally {
    clearTimeout(t);
  }
});
