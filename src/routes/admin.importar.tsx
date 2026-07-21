import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, RefreshCw, AlertTriangle, Trash2, ExternalLink, RotateCw } from "lucide-react";

export const Route = createFileRoute("/admin/importar")({
  component: ImportarPage,
});

type LoteResp = {
  pagina: number;
  total_paginas: number;
  importados: number;
  atualizados: number;
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
  const [forcar, setForcar] = useState(false);
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

  // Fonte única de verdade: conta linhas reais em posts
  const matBanco = useQuery({
    queryKey: ["import-materias-banco"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("posts").select("id", { count: "exact", head: true }).not("wp_id", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: rodando ? 2000 : false,
  });

  const imgBucket = useQuery({
    queryKey: ["import-imagens-bucket"],
    queryFn: async () => {
      // storage.list é limitado; contamos via lote na tabela? Sem acesso: usamos limite pela API list.
      const { data, error } = await supabase.storage.from("midia").list("wp", { limit: 1 });
      if (error) return null;
      // list de "wp" retorna as pastas por ano; contagem exata exigiria recursão — mostra placeholder
      return data ? data.length : 0;
    },
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

  const ultimasImportadas = useQuery({
    queryKey: ["import-ultimas-materias"],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("posts")
        .select("id, titulo, slug, status, wp_id, publicado_em, atualizado_em", { count: "exact" })
        .not("wp_id", "is", null)
        .order("atualizado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(0, 19);
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

  const invalidarTudo = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["import-estado"] }),
      qc.invalidateQueries({ queryKey: ["import-erros"] }),
      qc.invalidateQueries({ queryKey: ["import-ultimas-materias"] }),
      qc.invalidateQueries({ queryKey: ["import-materias-banco"] }),
      qc.invalidateQueries({ queryKey: ["import-imagens-bucket"] }),
    ]);
  };

  const rodarLote = async (extra: Record<string, unknown> = {}) => {
    setErroGlobal("");
    setLogMsg("Chamando função…");
    const pagina = (estado.data?.ultima_pagina ?? 0) + 1;
    const resp = await chamarLote({ pagina, tamanho: 10, forcar, ...extra });
    setUltima(resp);
    setLogMsg(
      `Página ${resp.pagina}/${resp.total_paginas} — importadas ${resp.importados}, atualizadas ${resp.atualizados}, puladas ${resp.pulados}, imagens ${resp.imagens_subidas}, erros ${resp.erros.length} (${resp.duracao_ms}ms)`,
    );
    await invalidarTudo();
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
    let falhasSeguidas = 0;
    try {
      while (!stopRef.current) {
        let r: LoteResp;
        try {
          r = await rodarLote();
          falhasSeguidas = 0;
        } catch (e: any) {
          falhasSeguidas++;
          setErroGlobal(`Falha no lote (${falhasSeguidas}/3): ${e.message}`);
          if (falhasSeguidas >= 3) break;
          continue;
        }
        // Parada 1: chegou ao fim de verdade
        if (r.total_paginas > 0 && r.pagina >= r.total_paginas) break;
        // Parada 2: lote sem qualquer atividade — algo mudou na origem
        if (r.importados === 0 && r.atualizados === 0 && r.pulados === 0 && r.erros.length === 0) {
          setErroGlobal("Lote voltou vazio (nada importado, atualizado, pulado ou com erro). Verifique a origem.");
          break;
        }
      }
    } finally { setRodando(false); stopRef.current = false; }
  };

  const parar = () => { stopRef.current = true; setLogMsg("Parando após o lote atual…"); };

  const reprocessarErros = async () => {
    if (rodando || !erros.data?.itens.length) return;
    setRodando(true);
    try {
      const ids = erros.data.itens.map((i) => i.wp_id).slice(0, 10);
      setErroGlobal("");
      const resp = await chamarLote({ reprocessar: ids, tamanho: ids.length, forcar: true });
      setUltima(resp);
      setLogMsg(
        `Reprocessados ${ids.length} — importadas ${resp.importados}, atualizadas ${resp.atualizados}, erros ${resp.erros.length}`,
      );
      await invalidarTudo();
    } catch (e: any) { setErroGlobal(e.message); }
    finally { setRodando(false); }
  };

  const removerSeed = async () => {
    if (!confirm("Remover matérias de exemplo (posts sem wp_id)?")) return;
    const { error } = await supabase.from("posts").delete().is("wp_id", null);
    if (error) setErroGlobal(error.message);
    else { setLogMsg("Matérias de exemplo removidas."); await invalidarTudo(); }
  };

  const totalOrigem = origem?.total ?? 0;
  const totalPaginas = estado.data?.total_paginas ?? origem?.totalPaginas ?? 0;
  const ultimaPagina = estado.data?.ultima_pagina ?? 0;
  const feito = matBanco.data ?? 0;
  const pct = totalPaginas > 0 ? Math.min(100, Math.round((ultimaPagina / totalPaginas) * 100)) : 0;
  const excede = totalOrigem > 0 && feito > totalOrigem;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Importar do WordPress</h1>
        <p className="text-sm text-muted-foreground">
          Fonte: hockey4life.com.br. O progresso é medido por página processada. A contagem de matérias
          vem direto da tabela de posts — a fonte única de verdade.
        </p>
      </div>

      {excede && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            Há <strong>{feito.toLocaleString("pt-BR")}</strong> matérias no banco, mas a origem tem apenas{" "}
            <strong>{totalOrigem.toLocaleString("pt-BR")}</strong>. Isso é sintoma de bug — investigue antes de continuar.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card label="Matérias no banco" value={feito.toLocaleString("pt-BR")} />
        <Card label="Na origem" value={totalOrigem.toLocaleString("pt-BR")} />
        <Card label="Página" value={`${ultimaPagina} / ${totalPaginas || "—"}`} />
        <Card label="Progresso" value={`${pct}%`} />
      </div>

      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <button onClick={invalidarTudo}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm uppercase text-foreground">
          <RotateCw className="h-4 w-4" /> Recontar
        </button>
        <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={forcar} onChange={(e) => setForcar(e.target.checked)} />
          Forçar reimportação
        </label>
        <button onClick={removerSeed}
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-destructive/60 px-4 py-2 text-sm uppercase text-destructive">
          <Trash2 className="h-4 w-4" /> Remover matérias de exemplo
        </button>
      </div>

      {logMsg && <pre className="whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">{logMsg}</pre>}
      {erroGlobal && <p className="text-sm text-destructive">{erroGlobal}</p>}
      {ultima && (
        <p className="text-xs text-muted-foreground">
          Último lote — importadas: <strong>{ultima.importados}</strong> · atualizadas: <strong>{ultima.atualizados}</strong> · puladas: <strong>{ultima.pulados}</strong> · imagens: <strong>{ultima.imagens_subidas}</strong> · erros: <strong>{ultima.erros.length}</strong>
        </p>
      )}

      <div>
        <h2 className="h4l-title text-xl text-foreground">Últimas matérias importadas ({ultimasImportadas.data?.total ?? 0})</h2>
        <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-border bg-card">
          {ultimasImportadas.data?.itens.length ? (
            <ul className="divide-y divide-border">
              {ultimasImportadas.data.itens.map((p) => (
                <li key={p.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {p.status === "publicado" ? (
                      <a
                        href={`/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
                      >
                        <span>{p.titulo}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="font-medium text-foreground">{p.titulo}</span>
                    )}
                    <span className="font-mono text-xs text-muted-foreground">WP #{p.wp_id}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">/{p.slug}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma matéria importada ainda.</p>
          )}
        </div>
      </div>

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
