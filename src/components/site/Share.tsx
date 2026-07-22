import { useEffect, useRef, useState } from "react";
import {
  Facebook,
  Link as LinkIcon,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  Instagram,
  X as XIcon,
  Download,
} from "lucide-react";
import logoClaroAsset from "@/assets/logo-claro.png.asset.json";

export interface ShareButtonsProps {
  url: string;
  titulo: string;
  resumo?: string | null;
  chapeu?: string | null;
  imagemCapa?: string | null;
}

export function ShareButtons({ url, titulo, resumo, chapeu, imagemCapa }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [supportsShare, setSupportsShare] = useState(false);
  const [maisAberto, setMaisAberto] = useState(false);
  const [cartaoAberto, setCartaoAberto] = useState(false);
  const encoded = encodeURIComponent(url);
  const t = encodeURIComponent(titulo);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setSupportsShare(typeof navigator.share === "function");
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* noop */ }
  };

  const compartilharNativo = async () => {
    try {
      const data: ShareData = { title: titulo, text: resumo ?? titulo, url };
      if (navigator.canShare && !navigator.canShare(data)) {
        await navigator.share({ title: titulo, url });
        return;
      }
      await navigator.share(data);
    } catch (err: any) {
      // AbortError = usuário cancelou a bandeja, não é erro
      if (err?.name === "AbortError") return;
      // silencioso: se falhar, o usuário pode usar os outros botões
    }
  };

  const wa = { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${encoded}`, icon: MessageCircle };
  const x = { label: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${encoded}`, icon: XIcon };
  const fb = { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`, icon: Facebook };
  const tg = { label: "Telegram", href: `https://t.me/share/url?url=${encoded}&text=${t}`, icon: Send };

  const linkClasses =
    "inline-flex items-center justify-center rounded-md border border-border bg-card p-2 text-foreground transition-colors hover:border-primary/60 hover:text-primary";

  const StoriesBtn = (
    <button
      type="button"
      onClick={() => setCartaoAberto(true)}
      className={linkClasses}
      aria-label="Gerar cartão para Stories do Instagram"
      title="Cartão para Stories"
    >
      <Instagram className="h-4 w-4" />
    </button>
  );

  const CopiarBtn = (
    <button
      type="button"
      onClick={copy}
      className={linkClasses}
      aria-label={copied ? "Link copiado" : "Copiar link"}
      title={copied ? "Copiado!" : "Copiar link"}
    >
      <LinkIcon className="h-4 w-4" />
    </button>
  );

  const AncoraBtn = (it: { label: string; href: string; icon: typeof MessageCircle }) => (
    <a
      key={it.label}
      href={it.href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClasses}
      aria-label={`Compartilhar no ${it.label}`}
      title={it.label}
    >
      <it.icon className="h-4 w-4" />
    </a>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Compartilhar:</span>

      {/* Mobile: Compartilhar (nativo) → WhatsApp → Stories → Mais */}
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        {supportsShare && (
          <button
            type="button"
            onClick={compartilharNativo}
            className={linkClasses}
            aria-label="Compartilhar via aplicativo do celular"
          >
            <Share2 className="h-3.5 w-3.5" />
            Compartilhar
          </button>
        )}
        {AncoraBtn(wa)}
        {StoriesBtn}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMaisAberto((v) => !v)}
            className={linkClasses}
            aria-expanded={maisAberto}
            aria-label="Mais opções de compartilhamento"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            Mais
          </button>
          {maisAberto && (
            <div
              className="absolute right-0 z-20 mt-1 flex min-w-[10rem] flex-col gap-1 rounded-md border border-border bg-card p-2 shadow-lg"
              onClick={() => setMaisAberto(false)}
            >
              {AncoraBtn(x)}
              {AncoraBtn(fb)}
              {AncoraBtn(tg)}
              {CopiarBtn}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: WhatsApp, X, Facebook, Telegram, copiar, Stories */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {AncoraBtn(wa)}
        {AncoraBtn(x)}
        {AncoraBtn(fb)}
        {AncoraBtn(tg)}
        {CopiarBtn}
        {StoriesBtn}
      </div>

      {cartaoAberto && (
        <StoriesCardDialog
          onClose={() => setCartaoAberto(false)}
          titulo={titulo}
          chapeu={chapeu}
          imagemCapa={imagemCapa}
          url={url}
          onCopy={copy}
          copied={copied}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
 * Cartão 1080x1920 para o Stories
 * ------------------------------------------------------------------ */

function StoriesCardDialog(props: {
  onClose: () => void;
  titulo: string;
  chapeu?: string | null;
  imagemCapa?: string | null;
  url: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const { onClose, titulo, chapeu, imagemCapa, url, onCopy, copied } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        setGerando(true);
        setErro(null);
        const blob = await gerarCartaoStories({ titulo, chapeu, imagemCapa });
        if (cancelado) return;
        const objUrl = URL.createObjectURL(blob);
        setPreviewUrl(objUrl);
        setGerado(true);
      } catch (e: any) {
        if (!cancelado) setErro(e?.message ?? "Falha ao gerar cartão.");
      } finally {
        if (!cancelado) setGerando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const baixar = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `hockey4life-stories-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cartão para Stories"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="h-5 w-5" />
        </button>

        <div className="h4l-title text-lg text-foreground">Cartão para o Stories</div>

        <div className="mx-auto w-full max-w-[280px]">
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg border border-border bg-muted">
            {gerando && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                Gerando cartão…
              </div>
            )}
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Prévia do cartão" className="h-full w-full object-cover" />
            )}
          </div>
        </div>

        {erro && (
          <p className="text-xs text-destructive">
            {erro} Tente novamente ou compartilhe pelos outros botões.
          </p>
        )}

        {gerado && !erro && (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-foreground">
            Cartão salvo. Publique no seu Stories e cole o link da matéria.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={baixar}
            disabled={!previewUrl}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar cartão
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/60 hover:text-primary"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

async function gerarCartaoStories(opts: {
  titulo: string;
  chapeu?: string | null;
  imagemCapa?: string | null;
}): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const SAFE_TOP = 250;
  const SAFE_BOTTOM = 250;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível.");

  // Fundo base (caso imagem falhe)
  ctx.fillStyle = "#0d0d0f";
  ctx.fillRect(0, 0, W, H);

  // Imagem de capa
  if (opts.imagemCapa) {
    try {
      const img = await carregarImagem(opts.imagemCapa);
      desenharCover(ctx, img, 0, 0, W, H);
    } catch {
      // segue com fundo escuro
    }
  }

  // Gradiente escurecendo a metade de baixo
  const grad = ctx.createLinearGradient(0, H * 0.35, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.75)");
  grad.addColorStop(1, "rgba(0,0,0,0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Leve escurecido no topo para o chapéu respirar
  const gradTop = ctx.createLinearGradient(0, 0, 0, SAFE_TOP + 300);
  gradTop.addColorStop(0, "rgba(0,0,0,0.55)");
  gradTop.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradTop;
  ctx.fillRect(0, 0, W, SAFE_TOP + 300);

  const paddingX = 80;
  const areaLargura = W - paddingX * 2;

  // CHAPÉU
  const chapeu = (opts.chapeu ?? "").trim().toUpperCase();
  let cursorY = SAFE_TOP + 40;
  if (chapeu) {
    ctx.fillStyle = "#FFCA0A";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const chapeuFont =
      '900 76px "Anton","Archivo Black","Arial Narrow",sans-serif';
    ctx.font = chapeuFont;
    ctx.letterSpacing = "2px";
    const linhasChapeu = quebrarLinhas(ctx, chapeu, areaLargura, 2);
    for (const linha of linhasChapeu) {
      ctx.fillText(linha, paddingX, cursorY);
      cursorY += 84;
    }
    cursorY += 12;
    // linha divisória
    ctx.fillStyle = "#FFCA0A";
    ctx.fillRect(paddingX, cursorY, 120, 6);
    cursorY += 30;
  }

  // TÍTULO — posicionado a partir da parte inferior (acima do logo)
  const rodapeAltura = 220;
  const yTituloFim = H - SAFE_BOTTOM - rodapeAltura;
  const tituloFontSize = 82;
  const tituloLineHeight = 96;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${tituloFontSize}px "Anton","Archivo Black","Arial Narrow",sans-serif`;
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const linhasTitulo = quebrarLinhas(ctx, opts.titulo.toUpperCase(), areaLargura, 4);
  const alturaBloco = linhasTitulo.length * tituloLineHeight;
  let yTitulo = yTituloFim - alturaBloco;
  // sombra suave para legibilidade
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  for (const linha of linhasTitulo) {
    ctx.fillText(linha, paddingX, yTitulo);
    yTitulo += tituloLineHeight;
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // RODAPÉ (logo + URL) — dentro da margem de segurança inferior
  const rodapeY = H - SAFE_BOTTOM - 140;
  try {
    const logo = await carregarImagem(logoClaroAsset.url);
    // logo escura em fundo escuro? usamos a versão clara (para fundos escuros)
    const alvoAltura = 90;
    const escala = alvoAltura / logo.height;
    const alvoLargura = logo.width * escala;
    ctx.drawImage(logo, paddingX, rodapeY, alvoLargura, alvoAltura);
  } catch {
    // fallback: texto
    ctx.fillStyle = "#FFCA0A";
    ctx.font = '900 60px "Anton","Archivo Black",sans-serif';
    ctx.fillText("HOCKEY 4 LIFE", paddingX, rodapeY + 20);
  }

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = '600 34px "Open Sans","Inter",sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("hockey4life.com.br", paddingX, rodapeY + 110);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao exportar imagem."))),
      "image/jpeg",
      0.92,
    );
  });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
    img.src = src;
  });
}

function desenharCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > dr) {
    // imagem mais larga → recorta laterais
    sw = img.height * dr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function quebrarLinhas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  larguraMax: number,
  maxLinhas: number,
): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    const w = ctx.measureText(tentativa).width;
    if (w <= larguraMax) {
      atual = tentativa;
    } else {
      if (atual) linhas.push(atual);
      atual = p;
      if (linhas.length === maxLinhas - 1) {
        // última linha permitida — vamos truncar com "…" no final
        while (ctx.measureText(`${atual}…`).width > larguraMax && atual.length > 0) {
          atual = atual.slice(0, -1);
        }
      }
      if (linhas.length >= maxLinhas) break;
    }
  }
  if (linhas.length < maxLinhas && atual) linhas.push(atual);
  // Se ainda há texto sobrando e passamos do limite, garante reticências
  const restou = palavras.join(" ").length > linhas.join(" ").length;
  if (restou && linhas.length > 0) {
    let ultima = linhas[linhas.length - 1];
    while (ctx.measureText(`${ultima}…`).width > larguraMax && ultima.length > 0) {
      ultima = ultima.slice(0, -1);
    }
    linhas[linhas.length - 1] = `${ultima}…`;
  }
  return linhas.slice(0, maxLinhas);
}
