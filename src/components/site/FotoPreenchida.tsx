import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

/**
 * Foto que preenche o frame inteiro (cover, centralizada) e que também
 * corta faixas pretas embutidas no próprio arquivo (capturas de vídeo).
 * A detecção roda num canvas pequeno; se falhar (CORS), vira cover comum.
 */
type Caixa = { x: number; y: number; w: number; h: number; nw: number; nh: number };

function detectar(img: HTMLImageElement): Caixa | null {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return null;
  const W = 120, H = Math.max(1, Math.round((nh / nw) * 120));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const escura = (x: number, y: number) => {
      const i = (y * W + x) * 4;
      return d[i] + d[i + 1] + d[i + 2] < 45;
    };
    const colEscura = (x: number) => { let n = 0; for (let y = 0; y < H; y++) if (escura(x, y)) n++; return n / H > 0.97; };
    const linEscura = (y: number) => { let n = 0; for (let x = 0; x < W; x++) if (escura(x, y)) n++; return n / W > 0.97; };
    let l = 0, r = W - 1, t = 0, b = H - 1;
    while (l < r && colEscura(l)) l++;
    while (r > l && colEscura(r)) r--;
    while (t < b && linEscura(t)) t++;
    while (b > t && linEscura(b)) b--;
    if (r - l < W * 0.3 || b - t < H * 0.3) return null;
    if (l === 0 && r === W - 1 && t === 0 && b === H - 1) return null;
    const sx = nw / W, sy = nh / H;
    const m = 1; // margem de segurança (px da amostra)
    return { x: (l + m) * sx, y: (t + m) * sy, w: (r - l + 1 - 2 * m) * sx, h: (b - t + 1 - 2 * m) * sy, nw, nh };
  } catch {
    return null;
  }
}

export function FotoPreenchida({ className = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const box = useRef<HTMLDivElement>(null);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTam({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let estilo: React.CSSProperties | undefined;
  if (caixa && tam.w && tam.h) {
    const s = Math.max(tam.w / caixa.w, tam.h / caixa.h);
    estilo = {
      position: "absolute",
      maxWidth: "none",
      width: caixa.nw * s,
      height: caixa.nh * s,
      left: tam.w / 2 - (caixa.x + caixa.w / 2) * s,
      top: tam.h / 2 - (caixa.y + caixa.h / 2) * s,
    };
  }

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      <img
        {...props}
        crossOrigin="anonymous"
        onLoad={(e) => setCaixa(detectar(e.currentTarget))}
        style={estilo}
        className={estilo ? className.replace(/\bh-full\b|\bw-full\b/g, "") : className}
      />
    </div>
  );
}
