import { useEffect, useRef, useState } from "react";
import {
  Download,
  Facebook,
  Instagram,
  Link as LinkIcon,
  MessageCircle,
  Send,
  Share2,
  X as XIcon,
} from "lucide-react";
import logoClaroAsset from "@/assets/logo-claro.png.asset.json";

export interface ShareButtonsProps {
  url: string;
  titulo: string;
  resumo?: string | null;
  chapeu?: string | null;
  imagemCapa?: string | null;
  /** "topo" = discreto, na linha do autor; "fim" = depois do texto. */
  variant?: "topo" | "fim";
  /** Mostra a entrada discreta do cartão de Stories (usada onde a folha nativa esconde o menu). */
  mostrarCartao?: boolean;
}

/**
 * Compartilhamento enxuto: sempre duas ações diretas — WhatsApp e
 * "Compartilhar". No celular, "Compartilhar" abre a folha nativa do aparelho;
 * onde não houver suporte, abre um menu com X, Facebook, Telegram, copiar
 * link e o cartão para Stories.
 */
export function ShareButtons({
  url,
  titulo,
  resumo,
  chapeu,
  imagemCapa,
  variant = "topo",
  mostrarCartao = false,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [supportsShare, setSupportsShare] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [cartaoAberto, setCartaoAberto] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const encoded = encodeURIComponent(url);
  const t = encodeURIComponent(titulo);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setSupportsShare(typeof navigator.share === "function");
  }, []);

  // Fecha o menu com Esc ou clique fora dele.
  useEffect(() => {
    if (!menuAberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAberto(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuAberto(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menuAberto]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
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

  const tamanho = variant === "topo" ? "min-h-[32px] px-2 text-[11px]" : "min-h-[36px] px-3 text-xs";
  const base =
    "inline-flex items-center gap-1.5 rounded-md border border-border bg-card/70 font-bold uppercase tracking-wider text-foreground transition-colors hover:border-primary/60 hover:text-primary";

  const ItemMenu = ({
    label,
    href,
    icon: Icon,
    onClick,
  }: {
    label: string;
    href?: string;
    icon: typeof MessageCircle;
    onClick?: () => void;
  }) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        onClick={onClick}
        className="flex items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary"
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
      </a>
    ) : (
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary"
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
      </button>
    );

  return (
    <div ref={wrapRef} className="relative flex flex-wrap items-center gap-2">
      <a
        href={wa.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no WhatsApp"
        title="WhatsApp"
        className={`${base} ${tamanho}`}
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        WhatsApp
      </a>

      {supportsShare ? (
        <button
          type="button"
          onClick={compartilharNativo}
          aria-label="Compartilhar"
          title="Compartilhar"
          className={`${base} ${tamanho}`}
        >
          <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Compartilhar
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            aria-expanded={menuAberto}
            aria-haspopup="true"
            aria-label="Abrir opções de compartilhamento"
            title="Compartilhar"
            className={`${base} ${tamanho}`}
          >
            <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Compartilhar
          </button>
          {menuAberto && (
            <div
              role="menu"
              aria-label="Opções de compartilhamento"
              className="absolute right-0 z-30 mt-1 flex min-w-[13rem] flex-col gap-0.5 rounded-md border border-border bg-popover p-1.5 shadow-lg"
            >
              <ItemMenu label="X" href={x.href} icon={x.icon} onClick={() => setMenuAberto(false)} />
              <ItemMenu label="Facebook" href={fb.href} icon={fb.icon} onClick={() => setMenuAberto(false)} />
              <ItemMenu label="Telegram" href={tg.href} icon={tg.icon} onClick={() => setMenuAberto(false)} />
              <ItemMenu
                label={copied ? "Link copiado!" : "Copiar link"}
                icon={LinkIcon}
                onClick={() => {
                  setMenuAberto(false);
                  void copy();
                }}
              />
              <ItemMenu
                label="Cartão para Stories"
                icon={Instagram}
                onClick={() => {
                  setMenuAberto(false);
                  setCartaoAberto(true);
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Onde a folha nativa esconde o menu (celular), o cartão de Stories
          continua a um toque, em uma linha discreta. */}
      {mostrarCartao && supportsShare && (
        <button
          type="button"
          onClick={() => setCartaoAberto(true)}
          className="w-full text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary"
        >
          Cartão para Stories
        </button>
      )}

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
  const [blobCartao, setBlobCartao] = useState<Blob | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        setGerando(true);
        setErro(null);
        const blob = await gerarCartaoStories({ titulo, chapeu, imagemCapa });
        if (cancelado) return;
        setBlobCartao(blob);
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

  /**
   * Copia o link da matéria e abre a folha de compartilhamento do celular
   * já com a imagem — ali o leitor escolhe "Instagram → Stories" e só cola
   * o link no adesivo. Sites não podem abrir o Stories direto com a imagem
   * (o Instagram só permite isso a aplicativos), então este é o caminho
   * mais curto possível. Sem suporte a arquivos: baixa o cartão e abre o app.
   */
  const postarNoStories = async () => {
    if (!blobCartao) return;
    // Disparado antes do share, ainda dentro do toque do usuário (exigência do Safari).
    const copia = navigator.clipboard?.writeText(url).catch(() => undefined);
    const arquivo = new File([blobCartao], "hockey4life-stories.jpg", { type: "image/jpeg" });
    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo] });
        await copia;
        // Compartilhamento concluído: fecha o cartão para que, ao voltar do
        // Instagram, o leitor caia direto na matéria, sem a tela de compartilhar.
        onClose();
        return;
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return; // usuário cancelou
    }
    await copia;
    baixar();
    // Fecha antes de sair para o app do Instagram: ao voltar, a matéria está limpa.
    onClose();
    window.location.href = "instagram://story-camera";
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
            {aviso ?? "Toque em “Postar no Stories”, escolha Instagram e cole o link no adesivo — ele já fica copiado."}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={postarNoStories}
            disabled={!blobCartao}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            <Instagram className="h-3.5 w-3.5" />
            Postar no Stories
          </button>
          <button
            type="button"
            onClick={baixar}
            disabled={!previewUrl}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/60 hover:text-primary disabled:opacity-50"
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
