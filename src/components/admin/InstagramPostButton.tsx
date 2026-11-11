import { useEffect, useState, type ComponentProps } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Download, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { gerarLegenda } from "@/lib/legenda.functions";
import { gerarImagemInstagram, textoParaLegenda, type InstagramArticle } from "@/lib/instagram-card";
import { cn } from "@/lib/utils";

export interface InstagramPostButtonProps extends ComponentProps<typeof Button> {
  article: InstagramArticle;
}

export function InstagramPostButton({ article, className, ...props }: InstagramPostButtonProps) {
  const [open, setOpen] = useState(false);
  return <>
    <Button {...props} variant="outline" className={cn("gap-2", className)} onClick={() => setOpen(true)}>
      <Instagram /> Gerar postagem Instagram
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      {open && <InstagramPostDialog article={article} />}
    </Dialog>
  </>;
}

function InstagramPostDialog({ article }: { article: InstagramArticle }) {
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
      const blob = await gerarImagemInstagram(article);
      setImage(URL.createObjectURL(blob));
      const result = await generate({ data: { texto: text, rede: "instagram" } });
      if (!result.ok) throw new Error(result.erro);
      const url = article.slug ? `\n\nhttps://hockey4life.com.br/${article.slug}` : "";
      setCaption(result.legenda + url);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar a postagem. Tente novamente.");
    } finally { setBusy(false); }
  };

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setNotice(label); }
    catch { setError("Não foi possível copiar. Selecione a legenda e copie manualmente."); }
  };

  return <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg">
    <DialogTitle>Postagem para o Instagram</DialogTitle>
    <DialogDescription>@hockey4lifebr · Feed · 1080 × 1350</DialogDescription>
    <div className="grid min-w-0 gap-5 md:grid-cols-2">
      <div className="aspect-[4/5] overflow-hidden rounded-md border border-border bg-muted">
        {image ? <img src={image} alt="Postagem da matéria para Instagram" className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center text-muted-foreground"><Instagram className="size-12" /></div>}
      </div>
      <div className="min-w-0 space-y-3">
        <label className="block text-sm font-semibold" htmlFor="instagram-caption">Legenda</label>
        <textarea id="instagram-caption" value={caption} onChange={(event) => setCaption(event.target.value)}
          rows={10} className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground" />
        <Button onClick={prepare} disabled={busy} className="w-full">
          {busy ? <Loader2 className="animate-spin" /> : caption ? <RefreshCw /> : <Instagram />}
          {busy ? "Gerando…" : caption ? "Gerar outra versão" : "Gerar imagem e legenda"}
        </Button>
        <p className="text-xs text-muted-foreground">A geração da legenda usa créditos de IA. A publicação no Instagram é manual.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!image || busy} onClick={() => {
            if (!image) return;
            const anchor = document.createElement("a"); anchor.href = image;
            anchor.download = `hockey4life-${article.slug || "instagram"}.jpg`; anchor.click();
          }}><Download /> Baixar imagem</Button>
          <Button variant="outline" disabled={!caption || busy} onClick={() => copy(caption, "Legenda copiada.")}><Copy /> Copiar legenda</Button>
          {article.slug && <Button variant="ghost" onClick={() => copy(`https://hockey4life.com.br/${article.slug}`, "Link copiado.")}><Copy /> Copiar link</Button>}
          <Button variant="ghost" asChild><a href="https://www.instagram.com/hockey4lifebr/" target="_blank" rel="noopener noreferrer"><Instagram /> Abrir Instagram</a></Button>
        </div>
      </div>
    </div>
  </DialogContent>;
}