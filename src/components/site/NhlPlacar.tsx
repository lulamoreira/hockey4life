import { useQuery } from "@tanstack/react-query";
import { getNhlGames, type NhlJogo } from "@/lib/nhl.functions";
import { Circle, Tv } from "lucide-react";

function formatarHora(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(d);
  } catch {
    return "";
  }
}

function TimeLinha({
  logo,
  abbrev,
  nome,
  score,
  vencedor,
  finalizado,
}: {
  logo: string;
  abbrev: string;
  nome: string;
  score: number | null;
  vencedor: boolean;
  finalizado: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {logo ? (
          <img src={logo} alt={`Logo ${nome}`} loading="lazy" className="h-6 w-6 shrink-0 object-contain" />
        ) : (
          <div className="h-6 w-6 shrink-0 rounded bg-muted" />
        )}
        <span
          className={`truncate text-sm font-semibold ${
            finalizado && !vencedor ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {abbrev}
        </span>
      </div>
      {score !== null && (
        <span
          className={`tabular-nums text-base font-bold ${
            finalizado && !vencedor ? "text-muted-foreground" : "text-primary"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function CardJogo({ jogo }: { jogo: NhlJogo }) {
  const finalizado = jogo.estado === "FINAL";
  const aoVivo = jogo.estado === "LIVE";
  const agendado = jogo.estado === "FUT" || jogo.estado === "PRE";
  const homeGanhou =
    finalizado && jogo.home.score !== null && jogo.away.score !== null
      ? jogo.home.score > jogo.away.score
      : false;
  const awayGanhou =
    finalizado && jogo.home.score !== null && jogo.away.score !== null
      ? jogo.away.score > jogo.home.score
      : false;

  return (
    <a
      href={jogo.gameCenter || "#"}
      target={jogo.gameCenter ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 transition-colors hover:border-primary"
    >
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
        {aoVivo ? (
          <span className="inline-flex items-center gap-1 text-destructive">
            <Circle className="h-2 w-2 animate-pulse fill-destructive" />
            AO VIVO {jogo.periodo ? `· ${jogo.periodo}` : ""}
          </span>
        ) : finalizado ? (
          <span className="text-muted-foreground">{jogo.periodo ?? "FINAL"}</span>
        ) : (
          <span className="text-muted-foreground">{formatarHora(jogo.startUTC)}</span>
        )}
        {jogo.tvs.length > 0 && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Tv className="h-3 w-3" />
            {jogo.tvs.slice(0, 2).join(", ")}
          </span>
        )}
      </div>
      <TimeLinha
        logo={jogo.away.logo}
        abbrev={jogo.away.abbrev}
        nome={jogo.away.nome}
        score={jogo.away.score}
        vencedor={awayGanhou}
        finalizado={finalizado}
      />
      <TimeLinha
        logo={jogo.home.logo}
        abbrev={jogo.home.abbrev}
        nome={jogo.home.nome}
        score={jogo.home.score}
        vencedor={homeGanhou}
        finalizado={finalizado}
      />
      {agendado && (
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {jogo.away.record && jogo.home.record ? `${jogo.away.record} · ${jogo.home.record}` : "Agendado"}
        </div>
      )}
    </a>
  );
}

export function NhlPlacar() {
  const q = useQuery({
    queryKey: ["nhl-scoreboard"],
    queryFn: () => getNhlGames(),
    refetchInterval: (query) => {
      const d = query.state.data;
      const temAoVivo = d?.ultimos?.some((j) => j.estado === "LIVE");
      return temAoVivo ? 60_000 : 5 * 60_000;
    },
    staleTime: 30_000,
  });

  const ultimos = q.data?.ultimos ?? [];
  const proximos = q.data?.proximos ?? [];

  if (!q.isLoading && ultimos.length === 0 && proximos.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <h2 className="h4l-title text-2xl text-foreground md:text-3xl">Últimos resultados</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">NHL</span>
          </div>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando placar…</p>
          ) : ultimos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem jogos recentes.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ultimos.map((j) => (
                <CardJogo key={j.id} jogo={j} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <h2 className="h4l-title text-2xl text-foreground md:text-3xl">Próximos jogos</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">NHL</span>
          </div>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando agenda…</p>
          ) : proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem jogos agendados.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {proximos.map((j) => (
                <CardJogo key={j.id} jogo={j} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
