import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PostListItem, CarrosselSettings } from "@/lib/posts.functions";
import { formatDataBR } from "@/lib/slugify";

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

export function MancheteCarrossel({
  slides,
  settings,
}: {
  slides: PostListItem[];
  settings: CarrosselSettings;
}) {
  const total = slides.length;
  const reducedMotion = usePrefersReducedMotion();
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [userTook, setUserTook] = useState(false);
  const [hidden, setHidden] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Direção efetiva (fade quando reduced-motion)
  const transicao = reducedMotion ? "fade" : settings.transicao;
  const duracaoMs = reducedMotion ? Math.min(400, settings.duracaoMs) : settings.duracaoMs;

  const go = useCallback(
    (next: number, manual = false) => {
      if (total < 2) return;
      const n = ((next % total) + total) % total;
      if (n === idx) return;
      setPrev(idx);
      setIdx(n);
      setTransitioning(true);
      if (manual) setUserTook(true);
      window.setTimeout(() => setTransitioning(false), duracaoMs + 20);
    },
    [idx, total, duracaoMs],
  );

  // Autoplay
  useEffect(() => {
    if (userTook || paused || hidden || total < 2 || settings.quantidade <= 1) return;
    const t = window.setInterval(
      () => setIdx((i) => (i + 1) % total),
      Math.max(3000, settings.intervalo * 1000),
    );
    return () => window.clearInterval(t);
  }, [userTook, paused, hidden, total, settings.intervalo, settings.quantidade]);

  // Marca transição para o slide auto-avançado
  useEffect(() => {
    setTransitioning(true);
    const t = window.setTimeout(() => setTransitioning(false), duracaoMs + 20);
    return () => window.clearTimeout(t);
  }, [idx, duracaoMs]);

  // Pausa quando aba escondida
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  // Precarrega o próximo (não todas)
  useEffect(() => {
    const nxt = slides[(idx + 1) % total];
    if (!nxt?.imagem_capa) return;
    const img = new Image();
    img.src = nxt.imagem_capa;
  }, [idx, slides, total]);

  // Touch (swipe)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const sy = touchStartY.current;
    if (sx == null || sy == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      go(idx + (dx < 0 ? 1 : -1), true);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (total === 0) return null;

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
      aria-label="Manchetes"
    >
      <style>{`
        @keyframes h4l-slide-in-rtl  { from { transform: translate3d(100%,0,0); }  to { transform: translate3d(0,0,0); } }
        @keyframes h4l-slide-out-rtl { from { transform: translate3d(0,0,0); }     to { transform: translate3d(-100%,0,0); } }
        @keyframes h4l-slide-in-ltr  { from { transform: translate3d(-100%,0,0); } to { transform: translate3d(0,0,0); } }
        @keyframes h4l-slide-out-ltr { from { transform: translate3d(0,0,0); }     to { transform: translate3d(100%,0,0); } }
        @keyframes h4l-slide-in-up   { from { transform: translate3d(0,100%,0); }  to { transform: translate3d(0,0,0); } }
        @keyframes h4l-slide-out-up  { from { transform: translate3d(0,0,0); }     to { transform: translate3d(0,-100%,0); } }
        @keyframes h4l-slide-in-down { from { transform: translate3d(0,-100%,0); } to { transform: translate3d(0,0,0); } }
        @keyframes h4l-slide-out-down{ from { transform: translate3d(0,0,0); }     to { transform: translate3d(0,100%,0); } }
        @keyframes h4l-fade-in       { from { opacity: 0; } to { opacity: 1; } }
        @keyframes h4l-fade-out      { from { opacity: 1; } to { opacity: 0; } }
      `}</style>

      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
        {/* Slide anterior saindo */}
        {transitioning && total > 1 && (
          <Slide
            key={`out-${slides[prev].id}`}
            post={slides[prev]}
            eager={false}
            style={{
              animation: `h4l-${transicao === "fade" ? "fade" : "slide"}-out-${transicao === "fade" ? "" : transicao} ${duracaoMs}ms ease-in-out both`,
              zIndex: 1,
            }}
          />
        )}
        {/* Slide atual entrando */}
        <Slide
          key={`in-${slides[idx].id}-${idx}`}
          post={slides[idx]}
          eager={idx === 0 && prev === 0}
          style={
            transitioning
              ? {
                  animation: `h4l-${transicao === "fade" ? "fade" : "slide"}-in-${transicao === "fade" ? "" : transicao} ${duracaoMs}ms ease-in-out both`,
                  zIndex: 2,
                }
              : { zIndex: 2 }
          }
        />

        {/* Setas (desktop) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(idx - 1, true)}
              aria-label="Manchete anterior"
              className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/40 p-2 text-white backdrop-blur transition-colors hover:bg-black/70 md:flex"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(idx + 1, true)}
              aria-label="Próxima manchete"
              className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/40 p-2 text-white backdrop-blur transition-colors hover:bg-black/70 md:flex"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {total > 1 && (
        <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Selecionar manchete">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Manchete ${i + 1} de ${total}`}
              onClick={() => go(i, true)}
              className={`h-2 rounded-full transition-all ${
                i === idx ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Slide({
  post,
  eager,
  style,
}: {
  post: PostListItem;
  eager: boolean;
  style: React.CSSProperties;
}) {
  return (
    <div className="absolute inset-0 will-change-transform" style={style}>
      <Link to="/$slug" params={{ slug: post.slug }} className="group block h-full w-full">
        <div className="relative h-full w-full overflow-hidden">
          {post.imagem_capa ? (
            <img
              src={post.imagem_capa}
              alt={post.titulo}
              loading={eager ? "eager" : "lazy"}
              // fetchpriority não é aceito no TS oficial ainda em todos os JSX types
              {...({ fetchpriority: eager ? "high" : "auto" } as any)}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted">
              <span className="h4l-title text-6xl text-muted-foreground/30">H4L</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {post.temas?.slice(0, 2).map((t) => (
                <span key={t.slug} className="rounded bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                  {t.nome}
                </span>
              ))}
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {formatDataBR(post.publicado_em)}
              </span>
            </div>
            <h1 className="h4l-title text-3xl leading-tight text-foreground transition-colors group-hover:text-primary md:text-5xl lg:text-6xl">
              {post.titulo}
            </h1>
            {post.resumo && (
              <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                {post.resumo}
              </p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
