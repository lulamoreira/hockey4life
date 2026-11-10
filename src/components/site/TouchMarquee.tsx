import { useEffect, useRef, type ReactNode } from "react";

/**
 * Faixa horizontal para celular: rola sozinha e aceita arrasto com o dedo,
 * com inércia própria (sem rolagem nativa). Tudo é controlado por um único
 * laço requestAnimationFrame + transform, então o "arremesso" do dedo nunca
 * briga com a rolagem automática (causa do tremor em arrastos fortes).
 * O conteúdo deve vir DUPLICADO pelo chamador (metade = uma volta).
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
  const trilho = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const tr = trilho.current;
    if (!el || !tr) return;
    let raf = 0;
    let last = performance.now();
    let pos = 0; // deslocamento (px) para a esquerda
    let vel = 0; // px/s da inércia
    let pausaAte = 0;
    let arrastando = false;
    let decidido = false; // gesto já classificado como horizontal/vertical
    let horizontal = false;
    let x0 = 0, y0 = 0, lastX = 0, lastT = 0, pid = -1;

    const metade = () => tr.scrollWidth / 2;
    const wrap = () => {
      const m = metade();
      if (m <= 0) return;
      pos = ((pos % m) + m) % m;
    };
    const aplicar = () => { tr.style.transform = `translate3d(${-pos}px,0,0)`; };
    if (reverso) { pos = metade(); aplicar(); }

    const onDown = (e: PointerEvent) => {
      arrastando = true; decidido = false; horizontal = false;
      x0 = lastX = e.clientX; y0 = e.clientY; lastT = performance.now();
      vel = 0; pid = e.pointerId;
    };
    const onMove = (e: PointerEvent) => {
      if (!arrastando || e.pointerId !== pid) return;
      if (!decidido) {
        const dx = Math.abs(e.clientX - x0), dy = Math.abs(e.clientY - y0);
        if (dx < 6 && dy < 6) return;
        decidido = true;
        horizontal = dx > dy;
        if (!horizontal) { arrastando = false; return; }
        try { el.setPointerCapture(pid); } catch { /* ignora */ }
      }
      const now = performance.now();
      const d = e.clientX - lastX;
      const dt = Math.max(1, now - lastT) / 1000;
      // velocidade suavizada (evita picos que fazem a inércia "pular")
      vel = 0.8 * (-d / dt) + 0.2 * vel;
      pos -= d; wrap(); aplicar();
      lastX = e.clientX; lastT = now;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      if (arrastando && horizontal && performance.now() - lastT > 80) vel = 0;
      arrastando = false;
      vel = Math.max(-4000, Math.min(4000, vel));
      pausaAte = performance.now() + 2500;
    };
    // Evita clique acidental em links após arrastar
    const onClick = (e: MouseEvent) => {
      if (horizontal && Math.abs(lastX - x0) > 6) { e.preventDefault(); e.stopPropagation(); }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!arrastando) {
        if (Math.abs(vel) > 5) {
          pos += vel * dt;
          vel *= Math.pow(0.05, dt); // desaceleração suave
          wrap(); aplicar();
          pausaAte = now + 2500;
        } else {
          vel = 0;
          if (auto && now >= pausaAte && document.visibilityState !== "hidden") {
            pos += (reverso ? -1 : 1) * pxPorSegundo * dt;
            wrap(); aplicar();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", onClick, true);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClick, true);
    };
  }, [auto, pxPorSegundo, reverso]);

  return (
    <div
      ref={ref}
      className={`overflow-hidden select-none ${className}`}
      style={{ touchAction: "pan-y" }}
    >
      <div ref={trilho} className="w-max will-change-transform" onDragStart={(e) => e.preventDefault()}>
        {children}
      </div>
    </div>
  );
}
