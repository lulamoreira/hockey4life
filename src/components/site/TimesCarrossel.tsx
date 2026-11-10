import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { TemaListItem, TimesCarrosselSettings } from "@/lib/posts.functions";
import { nhlLogoUrl } from "@/lib/nhl-logos";
import { useIsMobile } from "@/hooks/use-mobile";
import { TouchMarquee } from "./TouchMarquee";

/**
 * Face do card de time: o logo preenche o frame inteiro (escala na proporção,
 * centralizado, cortando o que sobrar) e o nome do time flutua sobre a base.
 * Sem faixas vazias em volta do logo — mobile e desktop usam a mesma regra.
 */
function TimeFace({ t }: { t: TemaListItem }) {
  const logo = nhlLogoUrl(t.slug);
  return (
    <span className="relative block h-full w-full overflow-hidden rounded-md border border-border bg-background transition-colors group-hover:border-primary/50">
      {logo ? (
        <img
          src={logo}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-110"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center h4l-title text-lg text-muted-foreground/40">
          {t.nome.slice(0, 2)}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-1 pt-5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
        {t.nome}
      </span>
    </span>
  );
}

/**
 * Carrossel de logos NHL (temas do tipo "time"), acima do letreiro "NÃO PERCA".
 *
 * Desktop: marquee contínuo por animação CSS (horizontal ou vertical), com
 * direção, velocidade, quantidade visível e altura controladas em
 * /admin/configuracoes.
 * Mobile: faixa rolada por requestAnimationFrame (TouchMarquee) — rola sozinha
 * e aceita arrasto com o dedo; liga/desliga e velocidade vêm de
 * times.mobileAuto / times.mobileVelocidade.
 */
export function TimesCarrossel({
  times,
  settings,
}: {
  times: TemaListItem[];
  settings: TimesCarrosselSettings;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isMobile = useIsMobile();

  if (!mounted || times.length === 0 || !settings.ativo) return null;

  const s = settings;

  // ── Mobile: rolagem automática + arrasto com o dedo ─────────────────────
  if (isMobile) {
    const itens = times.slice(0, Math.max(1, s.quantidade));
    const lista = s.mobileAuto ? [...itens, ...itens] : itens;
    return (
      <section aria-label="Times da NHL" className="border-y border-border/60 bg-muted/20 py-2.5">
        <TouchMarquee
          auto={s.mobileAuto}
          pxPorSegundo={s.mobileVelocidade}
          reverso={s.direcao === "rtl"}
          className="w-full"
        >
          <ul className={`flex w-max gap-2.5 pr-2.5 ${s.mobileAuto ? "" : "overflow-x-auto"}`}>
            {lista.map((t, i) => (
              <li
                key={`${t.slug}-${i}`}
                className="w-[30vw] min-w-[96px] shrink-0"
                style={{ height: s.alturaPx }}
              >
                <Link
                  to="/time/$slug"
                  params={{ slug: t.slug }}
                  className="group block h-full w-full"
                >
                  <TimeFace t={t} />
                </Link>
              </li>
            ))}
          </ul>
        </TouchMarquee>
      </section>
    );
  }

  // ── Desktop: marquee por animação CSS ────────────────────────────────────
  const vertical = s.direcao === "up" || s.direcao === "down";
  const visiveis = Math.max(2, Math.min(12, s.quantidadeVisivel));
  const tempo = Math.max(6, (s.quantidadeVisivel * s.alturaPx) / Math.max(1, s.velocidade));

  const anim =
    s.direcao === "rtl"
      ? "h4l-times-marquee-h 0s linear infinite"
      : s.direcao === "ltr"
        ? "h4l-times-marquee-h-rev 0s linear infinite"
        : s.direcao === "up"
          ? "h4l-times-marquee-v 0s linear infinite"
          : "h4l-times-marquee-v-rev 0s linear infinite";

  const itens = times.slice(0, Math.max(1, s.quantidade));
  const lista = [...itens, ...itens];

  return (
    <section
      aria-label="Times da NHL"
      className="border-y border-border/60 bg-muted/20 py-3"
    >
      <style>{`
        @keyframes h4l-times-marquee-h      { from { transform: translate3d(0,0,0); }     to { transform: translate3d(-50%,0,0); } }
        @keyframes h4l-times-marquee-h-rev  { from { transform: translate3d(-50%,0,0); }  to { transform: translate3d(0,0,0); } }
        @keyframes h4l-times-marquee-v      { from { transform: translate3d(0,0,0); }     to { transform: translate3d(0,-50%,0); } }
        @keyframes h4l-times-marquee-v-rev  { from { transform: translate3d(0,-50%,0); }  to { transform: translate3d(0,0,0); } }
      `}</style>

      <div
        className="relative overflow-hidden"
        style={{ height: vertical ? Math.min(320, s.alturaPx * 2.5) : s.alturaPx, containerType: "inline-size" }}
      >
        {vertical ? (
          <ul
            className="flex w-full flex-col gap-3"
            style={{
              animation: anim.replace("0s", `${tempo}s`),
            }}
          >
            {lista.map((t, i) => (
              <li key={`${t.slug}-${i}`} className="w-full" style={{ height: s.alturaPx }}>
                <Link
                  to="/time/$slug"
                  params={{ slug: t.slug }}
                  className="group block h-full w-full"
                >
                  <TimeFace t={t} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul
            className="flex h-full w-max gap-3"
            style={{ animation: anim.replace("0s", `${tempo}s`) }}
          >
            {lista.map((t, i) => (
              <li
                key={`${t.slug}-${i}`}
                className="shrink-0"
                style={{
                  width: `max(72px, calc(100cqw / ${visiveis} - 0.75rem))`,
                  height: s.alturaPx,
                }}
              >
                <Link
                  to="/time/$slug"
                  params={{ slug: t.slug }}
                  className="group block h-full w-full"
                >
                  <TimeFace t={t} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* máscara de borda */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
      </div>
    </section>
  );
}
