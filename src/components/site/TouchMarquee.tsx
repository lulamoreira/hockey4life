import { useEffect, useRef, type ReactNode } from "react";

/**
 * Faixa horizontal para celular: rola sozinha (requestAnimationFrame sobre
 * scrollLeft) e aceita arrasto com o dedo (rolagem nativa). O conteúdo deve
 * vir DUPLICADO pelo chamador para o loop contínuo (metade = uma volta).
 * Depois que o leitor solta o dedo, a rolagem automática volta em 2,5s.
 */
export function TouchMarquee({
  children,
  auto,
  pxPorSegundo,
  reverso = false,
  className = "",
}: {
  children: ReactNode;
  auto: boolean;
  pxPorSegundo: number;
  reverso?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    let pos = el.scrollLeft;
    let pausaAte = 0;
    let tocando = false;

    const wrap = () => {
      const metade = el.scrollWidth / 2;
      if (metade <= 0) return;
      if (pos >= metade) pos -= metade;
      if (pos < 0) pos += metade;
    };
    const onStart = () => { tocando = true; };
    const onEnd = () => { tocando = false; pausaAte = performance.now() + 2500; };
    const onScroll = () => {
      // Só sincroniza quando o leitor está mexendo (evita apagar frações)
      if (tocando || performance.now() < pausaAte) {
        pos = el.scrollLeft;
        const metade = el.scrollWidth / 2;
        if (metade > 0 && (pos >= metade || pos <= 0)) {
          wrap();
          el.scrollLeft = pos;
        }
      }
    };
    if (reverso && el.scrollLeft === 0) {
      pos = el.scrollWidth / 2;
      el.scrollLeft = pos;
    }

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (auto && !tocando && now >= pausaAte && document.visibilityState !== "hidden") {
        pos += (reverso ? -1 : 1) * pxPorSegundo * dt;
        wrap();
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    el.addEventListener("pointerdown", onStart);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("pointerdown", onStart);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("scroll", onScroll);
    };
  }, [auto, pxPorSegundo, reverso]);

  return (
    <div
      ref={ref}
      className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
