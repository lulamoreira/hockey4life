import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, RefreshCw, AlertTriangle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/importar")({
  component: ImportarPage,
});

type LoteResp = {
  pagina: number;
  total_paginas: number;
  importados: number;
  pulados: number;
  imagens_subidas: number;
  tags_importadas?: number;
  erros: { wp_id?: number; slug?: string; imagem?: string; erro: string }[];
  duracao_ms: number;
  erro?: string;
};

async function chamarLote(body: Record<string, unknown>): Promise<LoteResp> {
  const { data, error } = await supabase.functions.invoke<LoteResp>("importar-wp", { body });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("resposta vazia");
  if (data.erro) throw new Error(data.erro);
  return data;
}

function ImportarPage() {
  const qc = useQueryClient();
  const [rodando, setRodando] = useState(false);
  const [ultima, setUltima] = useState<LoteResp | null>(null);
  const [logMsg, setLogMsg] = useState<string>("");
  const [erroGlobal, setErroGlobal] = useState<string>("");
  const stopRef = useRef(false);

  const estado = useQuery({
    queryKey: ["import-estado"],
    queryFn: async () => {
      const { data, error } = await supabase.from("importacao_estado").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: rodando ? 2000 : false,
  });

  const erros = useQuery({
    queryKey: ["import-erros"],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("importacao_itens")
        .select("wp_id, slug, erro, importado_em", { count: "exact" })
        .eq("status", "erro")
        .order("importado_em", { ascending: false })
        .range(0, 199);
      if (error) throw error;
      return { itens: data ?? [], total: count ?? 0 };
    },
  });

  const [origem, setOrigem] = useState<{ total: number; totalPaginas: number } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("https://hockey4life.com.br/wp-json/wp/v2/posts?per_page=1&status=publish&_fields=id");
        setOrigem({
          total: parseInt(r.headers.get("x-wp-total") ?? "0", 10),
          totalPaginas: parseInt(r.headers.get("x-wp-totalpages") ?? "0", 10),
        });
      } catch { /* opcional */ }
    })();
  }, []);

  const rodarLote = async (extra: Record<string, unknown> = {}) => {
    setErroGlobal("");
    setLogMsg("Chamando função…");
    const pagina = (estado.data?.ultima_pagina ?? 0) + 1;
    const resp = await chamarLote({ pagina, tamanho: 10, ...extra });
    setUltima(resp);
    setLogMsg(`Página ${resp.pagina}/${resp.total_paginas} — importados ${resp.importados}, pulados ${resp.pulados}, imagens ${resp.imagens_subidas}, erros ${resp.erros.length} (${resp.duracao_ms}ms)`);
    await qc.invalidateQueries({ queryKey: ["import-estado"] });
    await qc.invalidateQueries({ queryKey: ["import-erros"] });
    return resp;
  };

  const importarProximo = async () => {
    if (rodando) return;
    setRodando(true);
    try { await rodarLote(); } catch (e: any) { setErroGlobal(e.message); } finally { setRodando(false); }
  };

  const importarTudo = async () => {
    if (rodando) return;
    stopRef.current = false; setRodando(true);
    try {
      while (!stopRef.current) {
        const r = await rodarLote();
        if (r.total_paginas > 0 && r.pagina >= r.total_paginas) break;
        if (r.importados === 0 && r.pulados === 0 && r.erros.length === 0) break;
      }
    } catch (e: any) { setErroGlobal(e.message); }
    finally { setRodando(false); stopRef.current = false; }
  };

  const parar = () => { stopRef.current = true; setLogMsg("Parando após o lote atual…"); };

  const reprocessarErros = async () => {
    if (rodando || !erros.data?.itens.length) return;
    setRodando(true);
    try {
      const ids = erros.data.itens.map((i) => i.wp_id).slice(0, 10);
      setErroGlobal("");
      const resp = await chamarLote({ reprocessar: ids, tamanho: ids.length });
      setUltima(resp);
      setLogMsg(`Reprocessados ${ids.length} — ok ${resp.importados}, erros ${resp.erros.length}`);
      await qc.invalidateQueries({ queryKey: ["import-erros"] });
    } catch (e: any) { setErroGlobal(e.message); }
    finally { setRodando(false); }
  };

  const removerSeed = async () => {
    if (!confirm("Remover matérias de exemplo (posts sem wp_id)?")) return;
    const { error } = await supabase.from("posts").delete().is("wp_id", null);
    if (error) setErroGlobal(error.message);
    else setLogMsg("Matérias de exemplo removidas.");
  };

  const total = origem?.total ?? 0;
  const feito = estado.data?.total_importados ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Importar do WordPress</h1>
        <p className="text-sm text-muted-foreground">
          Fonte: hockey4life.com.br. Aproximadamente 330 MB de imagens — a importação leva um tempo e
          pode ser feita em várias sessões. O estado fica salvo no banco: se você fechar a aba,
          basta voltar e continuar do ponto onde parou.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card label="Na origem" value={total.toLocaleString("pt-BR")} />
        <Card label="Já importadas" value={feito.toLocaleString("pt-BR")} />
        <Card label="Página" value={`${estado.data?.ultima_pagina ?? 0} / ${estado.data?.total_paginas ?? origem?.totalPaginas ?? "—"}`} />
        <Card label="Progresso" value={`${pct}%`} />
      </div>

      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={importarProximo} disabled={rodando}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground disabled:opacity-50">
          <Play className="h-4 w-4" /> Importar próximo lote
        </button>
        <button onClick={importarTudo} disabled={rodando}
          className="inline-flex items-center gap-2 rounded-md border border-primary bg-transparent px-4 py-2 text-sm font-semibold uppercase text-primary disabled:opacity-50">
          <Play className="h-4 w-4" /> Importar tudo
        </button>
        <button onClick={parar} disabled={!rodando}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm uppercase text-foreground disabled:opacity-50">
          <Square className="h-4 w-4" /> Parar
        </button>
        <button onClick={reprocessarErros} disabled={rodando || !erros.data?.itens.length}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm uppercase text-foreground disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> Reprocessar erros
        </button>
        <button onClick={removerSeed}
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-destructive/60 px-4 py-2 text-sm uppercase text-destructive">
          <Trash2 className="h-4 w-4" /> Remover matérias de exemplo
        </button>
      </div>

      {logMsg && <pre className="whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">{logMsg}</pre>}
      {erroGlobal && <p className="text-sm text-destructive">{erroGlobal}</p>}
      {ultima && ultima.erros.length > 0 && (
        <p className="text-xs text-muted-foreground">Último lote: {ultima.erros.length} erro(s) — veja a lista abaixo.</p>
      )}

      <div>
        <h2 className="h4l-title flex items-center gap-2 text-xl text-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" /> Erros ({erros.data?.total ?? 0})
        </h2>
        <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-border bg-card">
          {erros.data?.itens.length ? (
            <ul className="divide-y divide-border">
              {erros.data.itens.map((e) => (
                <li key={e.wp_id} className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <a href={`https://hockey4life.com.br/?p=${e.wp_id}`} target="_blank" rel="noreferrer"
                      className="font-mono text-primary hover:underline">#{e.wp_id} {e.slug}</a>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.importado_em).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-destructive">{e.erro}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Sem erros registrados.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-2 h4l-title text-3xl text-foreground">{value}</div>
    </div>
  );
}
