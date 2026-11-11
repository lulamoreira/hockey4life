import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listConfig, saveConfig } from "@/lib/admin.functions";
import { parseYouTube } from "@/lib/youtube";
import { YouTubeFacade } from "@/components/site/YouTubeFacade";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/video-capa")({
  head: () => ({ meta: [{ title: "Vídeo da capa — Admin Hockey4Life" }, { name: "robots", content: "noindex" }] }),
  component: VideoCapaPage,
});

interface VideoCapa { video_url: string; video_url_original: string; titulo: string; texto: string }

/** Lê a chave video_capa_ativo; ausente = ligado (comportamento anterior). */
function videoCapaAtivo(valor: unknown): boolean {
  if (valor && typeof valor === "object" && "ativo" in valor) return (valor as { ativo: unknown }).ativo !== false;
  return valor !== false;
}

function VideoCapaPage() {
  const qc = useQueryClient();
  const save = useServerFn(saveConfig);
  const { data } = useQuery({ queryKey: ["admin-config"], queryFn: () => listConfig() });
  const [hfc, setHfc] = useState<VideoCapa>({ video_url: "", video_url_original: "", titulo: "", texto: "" });
  const [ativo, setAtivo] = useState(true);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!data) return;
    setHfc((s) => ({ ...s, ...(data.hockey_fights_cancer ?? {}) }));
    setAtivo(videoCapaAtivo(data.video_capa_ativo));
  }, [data]);

  const parsed = parseYouTube(hfc.video_url_original || hfc.video_url);
  const erro = hfc.video_url_original.trim() && !parsed ? "Não reconheci esse endereço do YouTube. Cole o link da página do vídeo." : "";

  const salvar = async () => {
    setMsg("");
    if (erro) { setMsg(erro); return; }
    setSalvando(true);
    try {
      await Promise.all([
        save({ data: { chave: "hockey_fights_cancer", valor: hfc } }),
        save({ data: { chave: "video_capa_ativo", valor: { ativo } } }),
      ]);
      qc.invalidateQueries({ queryKey: ["admin-config"] });
      qc.invalidateQueries({ queryKey: ["site-config"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      setMsg("Vídeo da capa salvo.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally { setSalvando(false); }
  };

  const campo = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
  return (
    <div className="max-w-3xl">
      <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Vídeo da capa</h1>
      <p className="text-sm text-muted-foreground">Bloco de vídeo em destaque exibido na home.</p>

      <div className="mt-6 space-y-5 rounded-lg border border-border bg-card p-4 md:p-6">
        <label className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
          <span>
            <span className="block text-sm font-semibold text-foreground">Mostrar o vídeo na home</span>
            <span className="block text-xs text-muted-foreground">
              {ativo ? "Ligado: o bloco aparece na home (se houver vídeo)." : "Desligado: o bloco fica oculto; os dados continuam guardados."}
            </span>
          </span>
          <Switch checked={ativo} onCheckedChange={setAtivo} aria-label="Mostrar o vídeo na home" />
        </label>

        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">URL do vídeo no YouTube</span>
          <input className={campo} value={hfc.video_url_original} onChange={(e) => {
            const v = e.target.value; const p = parseYouTube(v);
            setHfc({ ...hfc, video_url_original: v, video_url: p ? p.embedUrl : "" });
          }} />
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        {parsed && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Endereço de incorporação: <code className="break-all">{parsed.embedUrl}</code></p>
            <div className="max-w-md"><YouTubeFacade url={hfc.video_url_original || hfc.video_url} title={hfc.titulo || "Pré-visualização"} /></div>
          </div>
        )}
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Título</span>
          <input className={campo} value={hfc.titulo} onChange={(e) => setHfc({ ...hfc, titulo: e.target.value })} />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Texto</span>
          <textarea rows={4} className={campo} value={hfc.texto} onChange={(e) => setHfc({ ...hfc, texto: e.target.value })} />
        </div>
      </div>

      {msg && <p className="mt-4 text-sm text-primary">{msg}</p>}
      <button onClick={salvar} disabled={salvando} className="mt-4 w-full rounded-md bg-primary px-6 py-2.5 text-sm font-semibold uppercase text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:w-auto">
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
