import { useEffect, useState, type RefObject } from "react";

interface ReadingProgressProps {
  targetRef: RefObject<HTMLElement | null>;
}

export function ReadingProgress({ targetRef }: ReadingProgressProps) {
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let raf = 0;
    let ticking = false;

    const compute = () => {
      ticking = false;
      const el = targetRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const start = rect.top; // px from viewport top
      const total = rect.height - vh;
      if (total <= 0) {
        setProgress(rect.bottom <= vh ? 1 : 0);
        return;
      }
      // scrolled past top: -start goes from 0 to total
      const p = Math.min(1, Math.max(0, -start / total));
      setProgress(p);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetRef]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] bg-transparent"
    >
      <div
        className="h-full origin-left bg-primary"
        style={{
          transform: `scaleX(${progress})`,
          transition: reduced ? "none" : "transform 80ms linear",
          willChange: "transform",
        }}
      />
    </div>
  );
}
