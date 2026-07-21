/**
 * Otimização de imagens 100% no navegador (canvas + WebP).
 * - Corrige orientação EXIF (via createImageBitmap { imageOrientation: 'from-image' }).
 * - Redimensiona mantendo proporção, sem ampliar quem já é menor.
 * - Converte para WebP q=0.8. Se ficar maior que o original, devolve o original.
 * - Remove metadados EXIF (re-encoding via canvas descarta tudo, inclusive GPS).
 * - Gera variantes menores para uso responsivo.
 *
 * Uso:
 *   const r = await optimizeImage(file, { maxWidth: 1600 });
 *   uploadBlob(r.main.blob);          // arquivo principal
 *   r.variants.forEach(v => upload(v.blob, v.width));  // variantes p/ srcset
 */

export type OptimVariant = {
  width: number;
  blob: Blob;
  ext: string; // 'webp' ou extensão do original
};

export type OptimResult = {
  main: OptimVariant;               // versão principal (maior)
  variants: OptimVariant[];         // versões menores (para srcset), pode ser vazio
  originalSize: number;
  originalName: string;
  usedOriginal: boolean;            // true se o "otimizado" ficou maior e mantivemos o original
  format: "webp" | "passthrough";
};

export type OptimOptions = {
  maxWidth: number;                 // largura máxima da versão principal
  variantWidths?: number[];         // ex.: [640, 1280]
  quality?: number;                 // 0..1, default 0.8
};

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

async function loadBitmap(file: File): Promise<{ bitmap: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  // Preferência: createImageBitmap com imageOrientation:'from-image' (respeita EXIF)
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
      return { bitmap: bmp, width: bmp.width, height: bmp.height };
    } catch {
      // fallback
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return { bitmap: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    // não revogar aqui pois o Image ainda pode ser referenciado; navegador libera depois
  }
}

function drawResized(
  bitmap: ImageBitmap | HTMLImageElement,
  srcW: number,
  srcH: number,
  targetW: number,
): HTMLCanvasElement {
  const ratio = srcH / srcW;
  const w = Math.round(targetW);
  const h = Math.round(w * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap as any, 0, 0, w, h);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar blob"))),
      type,
      quality,
    );
  });
}

/**
 * Otimiza um arquivo de imagem. Nunca lança em erros esperados — em falha, devolve o original.
 */
export async function optimizeImage(file: File, opts: OptimOptions): Promise<OptimResult> {
  const originalSize = file.size;
  const originalName = file.name;
  const quality = opts.quality ?? 0.8;

  if (!isBrowser) {
    return {
      main: { width: 0, blob: file, ext: extOf(file.name) },
      variants: [],
      originalSize, originalName,
      usedOriginal: true, format: "passthrough",
    };
  }

  // Não tenta processar SVG/GIF animado.
  if (/\.svg$/i.test(file.name) || file.type === "image/svg+xml" || file.type === "image/gif") {
    return {
      main: { width: 0, blob: file, ext: extOf(file.name) },
      variants: [],
      originalSize, originalName,
      usedOriginal: true, format: "passthrough",
    };
  }

  try {
    const { bitmap, width, height } = await loadBitmap(file);
    const mainW = Math.min(opts.maxWidth, width); // nunca amplia
    const canvas = drawResized(bitmap, width, height, mainW);
    const webp = await canvasToBlob(canvas, "image/webp", quality);

    let main: OptimVariant;
    let format: "webp" | "passthrough";
    if (webp.size >= originalSize) {
      // Otimização engordou — mantém original
      main = { width: mainW, blob: file, ext: extOf(file.name) };
      format = "passthrough";
    } else {
      main = { width: mainW, blob: webp, ext: "webp" };
      format = "webp";
    }

    const variants: OptimVariant[] = [];
    if (opts.variantWidths && format === "webp") {
      for (const vw of opts.variantWidths) {
        if (vw >= mainW) continue; // não gera variante maior/igual à principal
        const c = drawResized(bitmap, width, height, vw);
        const b = await canvasToBlob(c, "image/webp", quality);
        variants.push({ width: vw, blob: b, ext: "webp" });
      }
    }

    return { main, variants, originalSize, originalName, usedOriginal: format === "passthrough", format };
  } catch (err) {
    // qualquer falha → sobe original
    console.warn("[image-optim] fallback para original:", err);
    return {
      main: { width: 0, blob: file, ext: extOf(file.name) },
      variants: [],
      originalSize, originalName,
      usedOriginal: true, format: "passthrough",
    };
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "bin";
}

/** Deriva um nome de arquivo destino trocando a extensão e opcionalmente injetando um sufixo. */
export function renameFor(originalName: string, ext: string, suffix?: string): string {
  const base = originalName.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${base}${suffix ? `-${suffix}` : ""}.${ext}`;
}
