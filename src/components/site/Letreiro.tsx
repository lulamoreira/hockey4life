import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Facebook, Instagram, Rss } from "lucide-react";
import type { LetreiroSettings } from "@/lib/posts.functions";

type Item = { id: string; titulo: string; slug: string };
type Redes = { facebook?: string; instagram?: string; x?: string; youtube?: string };

export function Letreiro({
  items,
  settings,
  redes,
}: {
  items: Item[];
  settings: LetreiroSettings;
  redes?: Redes;
  standalone?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  if (!settings.ativo || !items || items.length === 0) return null;

  const rotulo = settings.rotulo?.trim() ? settings.rotulo : "NÃO PERCA";
  const horizontal = settings.direcao === "rtl" || settings.direcao === "ltr";
  const running = !paused;

  const sociais: Array<{
    key: string;
    href: string;
    label: string;
    icon: ReactNode;
    external: boolean;
  }> = [];
  if (redes?.facebook) sociais.push({ key: "fb", href: redes.facebook, label: "Facebook", icon: <Facebook size={14} />, external: true });
  if (redes?.x) sociais.push({ key: "x", href: redes.x, label: "X (Twitter)", icon: <XIcon />, external: true });
  if (redes?.instagram) sociais.push({ key: "ig", href: redes.instagram, label: "Instagram", icon: <Instagram size={14} />, external: true });
  sociais.push({ key: "rss", href: "/feed", label: "RSS", icon: <Rss size={14} />, external: false });

  return (
    <div className="mx-auto max-w-7xl px-4">
      <div
        className="flex h-[30px] items-stretch overflow-hidden text-[hsl(var(--letreiro-fg,0_0%_100%))]"
        style={{ backgroundColor: "rgba(119,119,119,0.55)" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {/* Etiqueta esquerda com ponta triangular */}
        <div
          className="relative flex shrink-0 items-center bg-[#1a1a1a] pl-3 pr-5 text-white"
          style={{
            clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)",
          }}
        >
          <span
            className="h4l-title uppercase leading-none tracking-wider"
            style={{ fontSize: "14px", fontWeight: 700 }}
          >
            {rotulo}
          </span>
        </div>

        {/* Manchetes */}
        <div className="relative flex-1 overflow-hidden text-white" style={{ fontSize: "12px" }}>
          {reducedMotion ? (
            <FadeTicker items={items} intervalMs={Math.max(2000, settings.velocidade * 1000)} running={running} />
          ) : horizontal ? (
            <MarqueeHorizontal items={items} direcao={settings.direcao as "rtl" | "ltr"} segundos={settings.velocidade} running={running} />
          ) : (
            <MarqueeVertical items={items} direcao={settings.direcao as "up" | "down"} segundos={settings.velocidade} running={running} />
          )}
        </div>

        {/* Ícones sociais — escondidos no mobile */}
        <div className="hidden shrink-0 items-stretch sm:flex">
          {sociais.map((s, i) => (
            <a
              key={s.key}
              href={s.href}
              aria-label={s.label}
              target={s.external ? "_blank" : undefined}
              rel={s.external ? "noopener noreferrer" : undefined}
              className="flex h-[30px] w-[30px] items-center justify-center bg-black/40 text-white transition-colors hover:bg-black/70"
              style={{ borderLeft: i === 0 ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.12)" }}
            >
              {s.icon}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.914l-5.41-6.61L4.5 22H1.244l8.02-9.17L1 2h7.09l4.88 6.02L18.244 2Zm-1.21 18h1.86L7.05 4H5.09l11.944 16Z" />
    </svg>
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
  const dup = useMemo(() => [...items, ...items], [items]);
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
      <div className="flex h-full w-max items-center whitespace-nowrap will-change-transform" style={style}>
        {dup.map((it, idx) => (
          <span key={`${it.id}-${idx}`} className="flex items-center" aria-hidden={idx >= items.length ? "true" : undefined}>
            <Link
              to="/$slug"
              params={{ slug: it.slug }}
              className="px-4 no-underline hover:underline"
              tabIndex={idx >= items.length ? -1 : 0}
            >
              {it.titulo}
            </Link>
            <span className="text-white/40">•</span>
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
            className="line-clamp-1 px-4 no-underline hover:underline"
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
      <Link to="/$slug" params={{ slug: it.slug }} className="line-clamp-1 px-4 no-underline hover:underline">
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
