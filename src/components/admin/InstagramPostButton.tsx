import { useEffect, useState, type ComponentProps } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Download, Copy, Loader2, RefreshCw, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { gerarLegenda } from "@/lib/legenda.functions";
import { gerarImagemInstagram, textoParaLegenda, type InstagramArticle } from "@/lib/instagram-card";
import { cn } from "@/lib/utils";
import { prepararPostX, tamanhoPostX, urlCompositorX } from "@/lib/x-post";

export interface InstagramPostButtonProps extends ComponentProps<typeof Button> {
  article: InstagramArticle;
}

export function InstagramPostButton({ article, className, ...props }: InstagramPostButtonProps) {
  const [network, setNetwork] = useState<"instagram" | "x" | null>(null);
  const [cached, setCached] = useState<{ key: string; blob: Blob }>();
  const getImage = async () => {
    const key = JSON.stringify(article);
    if (cached?.key === key) return cached.blob;
    const blob = await gerarImagemInstagram(article);
    setCached({ key, blob });
    return blob;
  };
  return <>
    <Button {...props} variant="outline" className={cn("gap-2", className)} onClick={() => setNetwork("instagram")}>
      <Instagram /> Gerar postagem Instagram
    </Button>
    <Button {...props} variant="outline" className={cn("gap-2", className)} onClick={() => setNetwork("x")}>
      <Twitter /> Gerar postagem X
    </Button>
    <Dialog open={network !== null} onOpenChange={(open) => { if (!open) setNetwork(null); }}>
      {network && <InstagramPostDialog article={article} network={network} getImage={getImage} />}
    </Dialog>
  </>;
}

function InstagramPostDialog({ article, network, getImage }: {
  article: InstagramArticle;
  network: "instagram" | "x";
  getImage: () => Promise<Blob>;
}) {
  const isX = network === "x";
  const Icon = isX ? Twitter : Instagram;
  const articleUrl = article.slug ? `https://hockey4life.com.br/${article.slug}` : "";
  const generate = useServerFn(gerarLegenda);
  const [image, setImage] = useState<string>();
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);

  const prepare = async () => {
    setBusy(true); setError(""); setNotice(""); setCaption(""); setImage(undefined);
    try {
      const text = textoParaLegenda(article);
      if (text.length < 50) throw new Error("Preencha o título e o texto da matéria antes de gerar a postagem.");
      // Render first: do not charge for a caption when the cover cannot be exported.
      const blob = await getImage();
      setImage(URL.createObjectURL(blob));
      const result = await generate({ data: { texto: text, rede: network } });
      if (!result.ok) throw new Error(result.erro);
      setCaption(isX ? prepararPostX(result.legenda, articleUrl) : result.legenda + (articleUrl ? `\n\n${articleUrl}` : ""));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar a postagem. Tente novamente.");
    } finally { setBusy(false); }
  };

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setNotice(label); }
    catch { setError("Não foi possível copiar. Selecione a legenda e copie manualmente."); }
  };

  return <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg">
    <DialogTitle>Postagem para o {isX ? "X" : "Instagram"}</DialogTitle>
    <DialogDescription>{isX ? "Imagem do Instagram · 1080 × 1350" : "@hockey4lifebr · Feed · 1080 × 1350"}</DialogDescription>
    <div className="grid min-w-0 gap-5 md:grid-cols-2">
      <div className="aspect-[4/5] overflow-hidden rounded-md border border-border bg-muted">
        {image ? <img src={image} alt={`Postagem da matéria para ${isX ? "X" : "Instagram"}`} className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center text-muted-foreground"><Icon className="size-12" /></div>}
      </div>
      <div className="min-w-0 space-y-3">
        <label className="block text-sm font-semibold" htmlFor="instagram-caption">Legenda</label>
        <textarea id="instagram-caption" value={caption} onChange={(event) => setCaption(event.target.value)}
          rows={10} className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground" />
        {isX && <p role="status" className={cn("text-xs", tamanhoPostX(caption) > 280 ? "text-destructive" : "text-muted-foreground")}>{tamanhoPostX(caption)} / 280</p>}
        <Button onClick={prepare} disabled={busy} className="w-full">
          {busy ? <Loader2 className="animate-spin" /> : caption ? <RefreshCw /> : <Icon />}
          {busy ? "Gerando…" : caption ? "Gerar outra versão" : "Gerar imagem e legenda"}
        </Button>
        <p className="text-xs text-muted-foreground">A geração da legenda usa créditos de IA. A publicação no {isX ? "X" : "Instagram"} é manual.{isX && " A imagem deve ser anexada no X após o download."}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!image || busy} onClick={() => {
            if (!image) return;
            const anchor = document.createElement("a"); anchor.href = image;
            anchor.download = `hockey4life-${article.slug || "instagram"}.jpg`; anchor.click();
          }}><Download /> Baixar imagem</Button>
          <Button variant="outline" disabled={!caption || busy || (isX && tamanhoPostX(caption) > 280)} onClick={() => copy(caption, "Legenda copiada.")}><Copy /> Copiar legenda</Button>
          {article.slug && <Button variant="ghost" onClick={() => copy(`https://hockey4life.com.br/${article.slug}`, "Link copiado.")}><Copy /> Copiar link</Button>}
          {isX ? <Button variant="ghost" disabled={!caption || busy || tamanhoPostX(caption) > 280} asChild>
            <a href={caption && tamanhoPostX(caption) <= 280 && !busy ? urlCompositorX(caption) : undefined} target="_blank" rel="noopener noreferrer"><Icon /> Abrir X</a>
          </Button> : <Button variant="ghost" asChild><a href="https://www.instagram.com/hockey4lifebr/" target="_blank" rel="noopener noreferrer"><Instagram /> Abrir Instagram</a></Button>}
        </div>
      </div>
    </div>
  </DialogContent>;
}