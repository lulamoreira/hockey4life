import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getNhlGames, type NhlJogo } from "@/lib/nhl.functions";
import type { PlacaresSettings } from "@/lib/posts.functions";

/* ------------------------------------------------------------------
 * Formatação compacta
 * ------------------------------------------------------------------ */
function fmtHora(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    })
      .format(d)
      .replace(",", "");
  } catch {
    return "";
  }
}

type Item = { key: string; label: string; href: string | null };

function toResultado(j: NhlJogo): Item {
  const label = `${j.away.abbrev} ${j.away.score ?? 0} × ${j.home.score ?? 0} ${j.home.abbrev}`;
  return { key: `r-${j.id}`, label, href: j.gameCenter || null };
}
function toProximo(j: NhlJogo): Item {
  const label = `${fmtHora(j.startUTC)} · ${j.away.abbrev} × ${j.home.abbrev}`;
  return { key: `p-${j.id}`, label, href: j.gameCenter || null };
}

/* ------------------------------------------------------------------
 * Hooks: visibilidade da aba e prefers-reduced-motion
 * ------------------------------------------------------------------ */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const on = () => setVisible(document.visibilityState !== "hidden");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

/* ------------------------------------------------------------------
 * Uma faixa (letreiro) — rótulo fixo + rolagem horizontal
 * ------------------------------------------------------------------ */
const ALTURA_FAIXA = 48;

function FaixaSkeleton({ dividir }: { dividir: boolean }) {
  return (
    <div
      className={`w-full bg-muted/30 ${dividir ? "sm:col-span-1" : "sm:col-span-2"}`}
      style={{ height: ALTURA_FAIXA }}
      aria-hidden="true"
    />
  );
}

function Faixa({
  rotulo,
  items,
  direcao,
  velocidade,
  variante = "vermelho",
}: {
  rotulo: string;
  items: Item[];
  direcao: "rtl" | "ltr";
  velocidade: number;
  variante?: "vermelho" | "amarelo";
}) {
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const visible = usePageVisible();
  const reduced = usePrefersReducedMotion();

  const running = !hoverPaused && !focusPaused && visible;
  const dup = useMemo(() => [...items, ...items], [items]);

  const keyframes = `
    @keyframes placares-rtl { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
    @keyframes placares-ltr { from { transform: translate3d(-50%,0,0); } to { transform: translate3d(0,0,0); } }
  `;

  const amarelo = variante === "amarelo";
  const containerCls = amarelo
    ? "bg-primary text-black"
    : "bg-destructive text-destructive-foreground";
  const rotuloCls = amarelo ? "bg-primary/90" : "bg-destructive/90";
  const dotCls = amarelo ? "text-black/40" : "text-destructive-foreground/50";

  return (
    <div
      className={`flex items-stretch overflow-hidden ${containerCls}`}
      style={{ height: ALTURA_FAIXA }}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={() => setFocusPaused(false)}
    >
      <div className={`flex shrink-0 items-center px-4 ${rotuloCls}`}>
        <span className="h4l-title text-[12px] uppercase tracking-widest">{rotulo}</span>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden text-sm">
        {reduced ? (
          <FadeItens items={items} intervaloMs={Math.max(3000, velocidade * 200)} running={running} />
        ) : (
          <>
            <style>{keyframes}</style>
            <div
              className="flex h-full w-max items-center whitespace-nowrap will-change-transform"
              style={{
                animation: `placares-${direcao} ${velocidade}s linear infinite`,
                animationPlayState: running ? "running" : "paused",
              }}
            >
              {dup.map((it, idx) => {
                const clone = idx >= items.length;
                return (
                  <span
                    key={`${it.key}-${idx}`}
                    className="flex items-center"
                    aria-hidden={clone ? "true" : undefined}
                  >
                    <ItemLabel item={it} clone={clone} />
                    <span className={`px-1 ${dotCls}`} aria-hidden="true">
                      •
                    </span>
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ItemLabel({ item, clone }: { item: Item; clone: boolean }) {
  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 font-semibold tabular-nums hover:underline"
        tabIndex={clone ? -1 : 0}
      >
        {item.label}
      </a>
    );
  }
  return <span className="px-3 font-semibold tabular-nums">{item.label}</span>;
}

/* Reduced motion — cicla um item por vez com fade */
function FadeItens({
  items,
  intervaloMs,
  running,
}: {
  items: Item[];
  intervaloMs: number;
  running: boolean;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!running || items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), intervaloMs);
    return () => clearInterval(t);
  }, [running, items.length, intervaloMs]);
  const it = items[idx];
  if (!it) return null;
  return (
    <div key={it.key} className="animate-in fade-in flex h-full items-center">
      <ItemLabel item={it} clone={false} />
    </div>
  );
}

/* ------------------------------------------------------------------
 * Componente principal — dois letreiros lado a lado
 * ------------------------------------------------------------------ */
export function PlacaresLetreiros({ settings }: { settings: PlacaresSettings }) {
  if (!settings.ativo) return null;
  if (!settings.mostrarUltimos && !settings.mostrarProximos) return null;

  const q = useQuery({
    queryKey: ["placares-nhl", settings.quantidadeUltimos, settings.quantidadeProximos],
    queryFn: () =>
      getNhlGames({
        data: {
          maxUltimos: settings.quantidadeUltimos,
          maxProximos: settings.quantidadeProximos,
        },
      }),
    refetchInterval: (query) => {
      const d = query.state.data;
      const temAoVivo = d?.ultimos?.some((j) => j.estado === "LIVE");
      return temAoVivo ? 60_000 : 5 * 60_000;
    },
    staleTime: 30_000,
  });

  const ultimos: Item[] = (settings.mostrarUltimos ? (q.data?.ultimos ?? []) : []).map(toResultado);
  const proximos: Item[] = (settings.mostrarProximos ? (q.data?.proximos ?? []) : []).map(toProximo);

  // Enquanto carrega — barra neutra da mesma altura
  if (q.isLoading) {
    return (
      <section
        className="w-full bg-muted/30"
        style={{ height: ALTURA_FAIXA }}
        aria-hidden="true"
      />
    );
  }

  const temU = ultimos.length > 0;
  const temP = proximos.length > 0;
  if (!temU && !temP) return null;

  // Um lado só → ocupa a faixa inteira. Dois lados → divide.
  if (temU && !temP) {
    return (
      <section aria-label="Placares NHL">
        <Faixa rotulo="ÚLTIMOS RESULTADOS" items={ultimos} direcao={settings.direcao} velocidade={settings.velocidade} />
      </section>
    );
  }
  if (temP && !temU) {
    return (
      <section aria-label="Placares NHL">
        <Faixa rotulo="PRÓXIMOS JOGOS" items={proximos} direcao={settings.direcao} velocidade={settings.velocidade} />
      </section>
    );
  }
  // Dois lados: empilhado no mobile, lado a lado a partir de sm.
  return (
    <section aria-label="Placares NHL" className="grid grid-cols-1 sm:grid-cols-2">
      <Faixa rotulo="ÚLTIMOS RESULTADOS" items={ultimos} direcao={settings.direcao} velocidade={settings.velocidade} />
      <Faixa rotulo="PRÓXIMOS JOGOS" items={proximos} direcao={settings.direcao} velocidade={settings.velocidade} />
    </section>
  );
}
