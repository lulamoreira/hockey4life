import { Link } from "@tanstack/react-router";
import { nhlLogoUrl } from "@/lib/nhl-logos";
import type { TimesCarrosselSettings } from "@/lib/posts.functions";
import { TIMES_CARROSSEL_PADRAO } from "@/lib/posts.functions";

type Time = { slug: string; nome: string };

export function TimesCarrossel({
  times,
  settings,
  standalone = false,
}: {
  times: Time[];
  settings?: TimesCarrosselSettings;
  standalone?: boolean;
}) {
  const s = settings ?? TIMES_CARROSSEL_PADRAO;
  const items = [...times]
    .filter((t) => nhlLogoUrl(t.slug))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (items.length === 0 || !s.ativo) return null;

  const vertical = s.direcao === "up" || s.direcao === "down";
  const reverse = s.direcao === "ltr" || s.direcao === "down";
  const animName = vertical ? "h4l-times-marquee-v" : "h4l-times-marquee-h";
  // Duplicamos a lista para loop contínuo
  const loop = [...items, ...items];
  const visiveis = Math.max(2, Math.min(12, s.quantidadeVisivel));
  const itemBasis = `${100 / visiveis}%`;

  const trackStyle: React.CSSProperties = vertical
    ? {
        animation: `${animName} ${s.velocidade}s linear infinite`,
        animationDirection: reverse ? "reverse" : "normal",
        animationPlayState: "running",
      }
    : {
        animation: `${animName} ${s.velocidade}s linear infinite`,
        animationDirection: reverse ? "reverse" : "normal",
        animationPlayState: "running",
      };

  const wrapperClass = vertical
    ? "overflow-hidden"
    : "overflow-hidden";

  const trackClass = vertical
    ? "flex flex-col"
    : "flex";

  return (
    <section
      className={standalone ? "" : "border-y border-border bg-card"}
      aria-label="Times da NHL"
    >
      <style>{`
        @keyframes h4l-times-marquee-h {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes h4l-times-marquee-v {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(0, -50%, 0); }
        }
        .h4l-times-pause:hover .h4l-times-track,
        .h4l-times-pause:focus-within .h4l-times-track { animation-play-state: paused !important; }
        @media (prefers-reduced-motion: reduce) {
          .h4l-times-track { animation: none !important; }
        }
      `}</style>
      <div className={`mx-auto max-w-7xl px-4 ${standalone ? "py-2" : "py-6"} ${s.pausarNoHover ? "h4l-times-pause" : ""}`}>
        <div
          className={wrapperClass}
          style={vertical ? { height: `${s.alturaPx * 2 + 24}px` } : undefined}
        >
          <ul
            className={`${trackClass} h4l-times-track gap-3`}
            style={{
              ...trackStyle,
              width: vertical ? "100%" : "max-content",
            }}
          >
            {loop.map((t, i) => {
              const logo = nhlLogoUrl(t.slug)!;
              return (
                <li
                  key={`${t.slug}-${i}`}
                  className="shrink-0"
                  style={
                    vertical
                      ? { height: `${s.alturaPx}px`, width: "100%" }
                      : { flexBasis: itemBasis, minWidth: `${100 / visiveis}%` }
                  }
                >
                  <Link
                    to="/time/$slug"
                    params={{ slug: t.slug }}
                    title={t.nome}
                    aria-label={`Ver matérias de ${t.nome}`}
                    className="group flex h-full flex-col items-center justify-center gap-2 rounded-md border border-border bg-background p-3 transition-colors hover:border-primary"
                    style={vertical ? undefined : { height: `${s.alturaPx}px` }}
                  >
                    <img
                      src={logo}
                      alt={`Logo ${t.nome}`}
                      loading="lazy"
                      className="max-h-[60%] max-w-[60%] object-contain transition-transform group-hover:scale-110"
                    />
                    <span className="line-clamp-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-primary">
                      {t.nome}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
