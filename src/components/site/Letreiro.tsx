import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { LetreiroSettings } from "@/lib/posts.functions";

type Item = { id: string; titulo: string; slug: string };

export function Letreiro({
  items,
  settings,
  standalone = false,
}: {
  items: Item[];
  settings: LetreiroSettings;
  standalone?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  if (!settings.ativo || !items || items.length === 0) return null;

  const rotulo = settings.rotulo?.trim() ? settings.rotulo : "NÃO PERCA";
  const horizontal = settings.direcao === "rtl" || settings.direcao === "ltr";
  const running = !paused;

  return (
    <div
      className="bg-destructive text-destructive-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mx-auto flex h-9 max-w-7xl items-stretch overflow-hidden px-0">
        <div className="flex shrink-0 items-center gap-2 bg-destructive/90 px-4 text-xs font-black uppercase tracking-widest">
          <span className="h4l-title">{rotulo}</span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          {reducedMotion ? (
            <FadeTicker items={items} intervalMs={Math.max(2000, settings.velocidade * 1000)} running={running} />
          ) : horizontal ? (
            <MarqueeHorizontal items={items} direcao={settings.direcao as "rtl" | "ltr"} segundos={settings.velocidade} running={running} />
          ) : (
            <MarqueeVertical items={items} direcao={settings.direcao as "up" | "down"} segundos={settings.velocidade} running={running} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Horizontal — laço contínuo (rtl/ltr) via translateX
 * ============================================================ */
function MarqueeHorizontal({
  items,
  direcao,
  segundos,
  running,
}: {
  items: Item[];
  direcao: "rtl" | "ltr";
  segundos: number;
  running: boolean;
}) {
  // Duplica a lista para o loop ficar sem emenda
  const dup = useMemo(() => [...items, ...items], [items]);
  // Direção RTL: começa em 0% e vai para -50% (metade, já que duplicamos)
  // Direção LTR: começa em -50% e vai para 0%
  const style: React.CSSProperties = {
    animation: `letreiro-x-${direcao} ${segundos}s linear infinite`,
    animationPlayState: running ? "running" : "paused",
  };
  return (
    <>
      <style>{`
        @keyframes letreiro-x-rtl { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
        @keyframes letreiro-x-ltr { from { transform: translate3d(-50%,0,0); } to { transform: translate3d(0,0,0); } }
      `}</style>
      <div className="flex h-full items-center whitespace-nowrap will-change-transform" style={style}>
        {dup.map((it, idx) => (
          <span key={`${it.id}-${idx}`} className="flex items-center" aria-hidden={idx >= items.length ? "true" : undefined}>
            <Link
              to="/$slug"
              params={{ slug: it.slug }}
              className="px-4 text-sm font-medium hover:underline"
              tabIndex={idx >= items.length ? -1 : 0}
            >
              {it.titulo}
            </Link>
            <span className="text-destructive-foreground/50">•</span>
          </span>
        ))}
      </div>
    </>
  );
}

/* ============================================================
 * Vertical — uma manchete por vez com deslize
 * ============================================================ */
function MarqueeVertical({
  items,
  direcao,
  segundos,
  running,
}: {
  items: Item[];
  direcao: "up" | "down";
  segundos: number;
  running: boolean;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!running || items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), segundos * 1000);
    return () => clearInterval(t);
  }, [running, items.length, segundos]);

  const current = items[idx];
  const key = `${current?.id ?? idx}-${direcao}`;
  return (
    <>
      <style>{`
        @keyframes letreiro-y-up   { from { transform: translate3d(0, 100%, 0); opacity: 0.2; } to { transform: translate3d(0, 0, 0); opacity: 1; } }
        @keyframes letreiro-y-down { from { transform: translate3d(0, -100%, 0); opacity: 0.2; } to { transform: translate3d(0, 0, 0); opacity: 1; } }
      `}</style>
      <div className="relative h-full">
        <div
          key={key}
          className="absolute inset-0 flex items-center will-change-transform"
          style={{ animation: `letreiro-y-${direcao} 500ms ease-out both` }}
        >
          <Link
            to="/$slug"
            params={{ slug: current.slug }}
            className="line-clamp-1 px-4 text-sm font-medium hover:underline"
          >
            {current.titulo}
          </Link>
        </div>
      </div>
    </>
  );
}

/* ============================================================
 * Reduced motion — troca com fade
 * ============================================================ */
function FadeTicker({ items, intervalMs, running }: { items: Item[]; intervalMs: number; running: boolean }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!running || items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), intervalMs);
    return () => clearInterval(t);
  }, [running, items.length, intervalMs]);
  const it = items[idx];
  return (
    <div key={it?.id} className="animate-in fade-in flex h-full items-center">
      <Link to="/$slug" params={{ slug: it.slug }} className="line-clamp-1 px-4 text-sm font-medium hover:underline">
        {it.titulo}
      </Link>
    </div>
  );
}

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
