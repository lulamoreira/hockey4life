import { Link } from "@tanstack/react-router";
import { nhlLogoUrl, nhlLogoViewBox } from "@/lib/nhl-logos";
import type { TimesCarrosselSettings } from "@/lib/posts.functions";
import { TIMES_CARROSSEL_PADRAO } from "@/lib/posts.functions";
import { useIsMobile } from "@/hooks/use-mobile";
import { TouchMarquee } from "@/components/site/TouchMarquee";

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
  const isMobile = useIsMobile();
  const items = [...times]
    .filter((t) => nhlLogoUrl(t.slug))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (items.length === 0 || !s.ativo) return null;

  // Celular: faixa horizontal que rola sozinha e aceita arrasto com o dedo
  if (isMobile && !standalone) {
    const loopM = [...items, ...items];
    return (
      <section className="border-y border-border bg-card" aria-label="Times da NHL">
        <div className="py-4">
          <TouchMarquee auto={s.mobileAuto} pxPorSegundo={s.mobileVelocidade} reverso={s.direcao === "ltr"}>
            <ul className="flex w-max gap-3 px-4">
              {loopM.map((t, i) => (
                <li key={`${t.slug}-${i}`} className="w-[30vw] min-w-[96px] shrink-0" style={{ height: `${s.alturaPx}px` }} aria-hidden={i >= items.length ? "true" : undefined}>
                  <Link
                    to="/time/$slug"
                    params={{ slug: t.slug }}
                    aria-label={`Ver matérias de ${t.nome}`}
                    tabIndex={i >= items.length ? -1 : 0}
                    draggable={false}
                    className="group relative flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-background"
                  >
                    <img src={nhlLogoUrl(t.slug)!} alt={`Logo ${t.nome}`} loading="eager" draggable={false} style={{ objectViewBox: nhlLogoViewBox(t.slug) } as React.CSSProperties} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-110" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-1 pt-5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">{t.nome}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </TouchMarquee>
        </div>
      </section>
    );
  }

  const vertical = s.direcao === "up" || s.direcao === "down";
  const reverse = s.direcao === "ltr" || s.direcao === "down";
  const animName = vertical ? "h4l-times-marquee-v" : "h4l-times-marquee-h";
  // Duplicamos a lista para loop contínuo
  const loop = [...items, ...items];
  const visiveis = Math.max(2, Math.min(12, s.quantidadeVisivel));
  

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
        /* Mobile: no máximo 3 logos visíveis para não cortar o nome do time */
        @media (max-width: 767px) {
          .h4l-times-item-h { width: calc(100cqw / 3 - 0.75rem) !important; min-width: 84px; }
        }
      `}</style>
      <div className={`mx-auto max-w-7xl px-4 ${standalone ? "py-2" : "py-6"} ${s.pausarNoHover ? "h4l-times-pause" : ""}`}>
        <div
          className={wrapperClass}
          style={{
            containerType: "inline-size",
            height: vertical ? `${s.alturaPx * visiveis}px` : undefined,
          } as React.CSSProperties}
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
              const itemStyle: React.CSSProperties = vertical
                ? { height: `${s.alturaPx}px`, width: "100%" }
                : {
                    width: `max(72px, calc(100cqw / ${visiveis} - 0.75rem))`,
                    height: `${s.alturaPx}px`,
                  };
              return (
                <li
                  key={`${t.slug}-${i}`}
                  className={`shrink-0 ${vertical ? "" : "h4l-times-item-h"}`}
                  style={itemStyle}
                >


                  <Link
                    to="/time/$slug"
                    params={{ slug: t.slug }}
                    title={t.nome}
                    aria-label={`Ver matérias de ${t.nome}`}
                    className="group relative flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-background transition-colors hover:border-primary"
                    style={vertical ? undefined : { height: `${s.alturaPx}px` }}
                  >
                    <img
                      src={logo}
                      alt={`Logo ${t.nome}`}
                      loading="eager"
                      style={{ objectViewBox: nhlLogoViewBox(t.slug) } as React.CSSProperties}
                      className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-110"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-1 pt-5 text-center text-[10px] font-semibold uppercase tracking-wide text-white group-hover:text-primary">
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
