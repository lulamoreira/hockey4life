import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Play, Square, RefreshCw, AlertTriangle, Trash2, ExternalLink,
  RotateCw, Unlock, ClipboardCheck, DownloadCloud, Eraser,
} from "lucide-react";

export const Route = createFileRoute("/admin/importar")({
  component: ImportarPage,
});

type Status = "IMPORTADA" | "ATUALIZADA" | "PULADA" | "ERRO";
type LogItem = { ts: string; nivel: string; msg: string };
type LoteResp = {
  acao?: string;
  pagina?: number;
  total_paginas?: number;
  indice_pagina_final?: number;
  pagina_completa?: boolean;
  concluido?: boolean;
  parcial?: boolean;
  bloqueado?: boolean;
  batimento_em?: string;
  importados: number;
  atualizados: number;
  pulados: number;
  imagens_subidas: number;
  bytes_baixados?: number;
  tags_importadas?: number;
  erros: { wp_id?: number; slug?: string; imagem?: string; erro: string }[];
  log?: LogItem[];
  duracao_ms: number;
  erro?: string;
  codigo?: string;
};
type ConferirResp = {
  origem_total: number;
  banco_total: number;
  faltando: number[];
  erro?: string;
};

// Traduz erros técnicos em mensagens amigáveis, mantendo o texto original em "detalhes".
function traduzirErro(msgOriginal: string, codigo?: string): { amigavel: string; tecnico: string } {
  const t = String(msgOriginal ?? "");
  const low = t.toLowerCase();
  let amigavel = "";
  if (codigo === "sem_sessao" || low.includes("não autenticado") || low.includes("unauthorized") || low.includes("jwt")) {
    amigavel = "Sua sessão expirou. Saia e entre de novo.";
  } else if (codigo === "sem_permissao" || low.includes("acesso restrito") || low.includes("forbidden")) {
    amigavel = "Você não tem permissão para importar. Peça acesso de administrador.";
  } else if (codigo === "bloqueado") {
    amigavel = "Uma importação anterior ainda está travada — clique em Destravar e tente de novo.";
  } else if (
    low.includes("non-2xx") ||
    low.includes("timeout") || low.includes("timed out") || low.includes("504") ||
    low.includes("cpu time exceeded") || low.includes("wall clock") || low.includes("time exceeded") ||
    low.includes("worker exceeded") || low.includes("edge function")
  ) {
    amigavel = "O lote demorou demais e foi interrompido. Nenhuma matéria foi perdida — clique em Próximo lote para continuar de onde parou.";
  } else if (low.includes("hockey4life.com.br") || low.includes("wp ") || low.includes("wordpress") || low.includes("502") || low.includes("503") || low.includes("network")) {
    amigavel = "O site hockey4life.com.br não respondeu. Tente de novo em alguns minutos.";
  } else {
    amigavel = "A importação foi interrompida. Nada foi perdido; o progresso está salvo.";
  }
  return { amigavel, tecnico: t };
}

async function chamar(body: Record<string, unknown>): Promise<LoteResp> {
  const { data, error } = await supabase.functions.invoke<LoteResp>("importar-wp", { body });
  if (error) {
    // extrai a resposta detalhada quando disponível
    let extra: any = null;
    try { extra = await (error as any).context?.json?.(); } catch { /* ignora */ }
    const raw = extra?.erro ?? error.message ?? "erro desconhecido";
    const codigo = extra?.codigo;
    const err = new Error(raw) as Error & { codigo?: string };
    err.codigo = codigo;
    throw err;
  }
  if (!data) throw new Error("resposta vazia");
  if (data.erro) {
    const err = new Error(data.erro) as Error & { codigo?: string };
    err.codigo = data.codigo;
    throw err;
  }
  return data;
}


const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};
const fmtDuracao = (s: number) => {
  if (!isFinite(s) || s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
};

function ImportarPage() {
  const qc = useQueryClient();
  const [rodando, setRodando] = useState(false);
  const [ultima, setUltima] = useState<LoteResp | null>(null);
  const [erroGlobal, setErroGlobal] = useState<{ amigavel: string; tecnico: string } | null>(null);
  const [forcar, setForcar] = useState(false);
  const [conferir, setConferir] = useState<ConferirResp | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const stopRef = useRef(false);
  // Histórico dos últimos lotes para ETA (últimos 5)
  const historicoRef = useRef<{ processadas: number; ms: number }[]>([]);

  const estado = useQuery({
    queryKey: ["import-estado"],
    queryFn: async () => {
      const { data, error } = await supabase.from("importacao_estado").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: rodando ? 1500 : 4000,
  });

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
    ]);
  };

  // Helper: transforma qualquer erro em par (amigavel, tecnico).
  const contarErro = (e: any) => {
    const codigo = (e as any)?.codigo as string | undefined;
    setErroGlobal(traduzirErro(e?.message ?? String(e), codigo));
  };

  const rodarLote = async (extra: Record<string, unknown> = {}) => {
    setErroGlobal(null);
    const resp = await chamar({ acao: "lote", tamanho: 25, forcar, ...extra });
    setUltima(resp);
    if (resp.bloqueado) {
      setErroGlobal({
        amigavel: "Uma importação anterior ainda está travada — clique em Destravar e tente de novo.",
        tecnico: `bloqueado desde ${resp.batimento_em ?? "?"}`,
      });
      return resp;
    }
    const processadas = resp.importados + resp.atualizados + resp.pulados + resp.erros.length;
    if (processadas > 0) {
      historicoRef.current = [...historicoRef.current, { processadas, ms: resp.duracao_ms }].slice(-5);
    }
    await invalidarTudo();
    return resp;
  };

  const importarProximo = async () => {
    if (rodando) return;
    setRodando(true);
    try { await rodarLote(); } catch (e: any) { contarErro(e); } finally { setRodando(false); }
  };

  const importarTudo = async () => {
    if (rodando) return;
    stopRef.current = false;
    setRodando(true);
    let falhas = 0;
    try {
      while (!stopRef.current) {
        let r: LoteResp;
        try {
          r = await rodarLote();
          falhas = 0;
        } catch (e: any) {
          falhas++;
          contarErro(e);
          if (falhas >= 3) break;
          continue;
        }
        if (r.bloqueado) break;
        if (r.concluido) break;
        if (!r.parcial && r.pagina_completa && r.total_paginas && r.pagina && r.pagina >= r.total_paginas) break;
        if (r.importados === 0 && r.atualizados === 0 && r.pulados === 0 && r.erros.length === 0 && !r.parcial) {
          setErroGlobal({
            amigavel: "O lote voltou vazio. A origem pode ter mudado — rode a conferência.",
            tecnico: "batch retornou sem posts",
          });
          break;
        }
      }
    } finally {
      setRodando(false);
      stopRef.current = false;
    }
  };

  const parar = () => { stopRef.current = true; };

  const destravar = async () => {
    setErroGlobal(null);
    try { await chamar({ acao: "destravar" }); } catch (e: any) { contarErro(e); }
    await invalidarTudo();
  };

  const zerarTotais = async () => {
    if (!confirm("Zerar contadores acumulados desta importação?")) return;
    setErroGlobal(null);
    try { await chamar({ acao: "zerar_totais" }); } catch (e: any) { contarErro(e); }
    await invalidarTudo();
  };

  const rodarConferencia = async () => {
    setConferindo(true);
    setErroGlobal(null);
    try {
      const r = await chamar({ acao: "conferir" });
      setConferir(r as unknown as ConferirResp);
    } catch (e: any) { contarErro(e); }
    finally { setConferindo(false); }
  };

  const importarFaltantes = async () => {
    if (!conferir?.faltando?.length || rodando) return;
    setRodando(true);
    stopRef.current = false;
    try {
      const CHUNK = 25;
      let restantes = [...conferir.faltando];
      while (restantes.length && !stopRef.current) {
        const parte = restantes.slice(0, CHUNK);
        const r = await chamar({ acao: "importar_ids", ids: parte, forcar: true });
        setUltima(r);
        restantes = restantes.slice(parte.length);
        await invalidarTudo();
      }
      await rodarConferencia();
    } catch (e: any) { contarErro(e); }
    finally { setRodando(false); stopRef.current = false; }
  };

  const reprocessarErros = async () => {
    if (rodando || !erros.data?.itens.length) return;
    setRodando(true);
    try {
      const ids = erros.data.itens.map((i) => i.wp_id).filter(Boolean).slice(0, 25);
      const r = await chamar({ acao: "importar_ids", ids, forcar: true });
      setUltima(r);
      await invalidarTudo();
    } catch (e: any) { contarErro(e); }
    finally { setRodando(false); }
  };

  const removerSeed = async () => {
    if (!confirm("Remover matérias de exemplo (posts sem wp_id)?")) return;
    const { error } = await supabase.from("posts").delete().is("wp_id", null);
    if (error) setErroGlobal(traduzirErro(error.message));
    else await invalidarTudo();
  };

  // ---------- Log ao vivo direto da tabela importacao_log ----------
  const logQuery = useQuery({
    queryKey: ["import-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("importacao_log")
        .select("id, ts, nivel, wp_id, msg")
        .order("id", { ascending: false })
        .range(0, 199);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: rodando ? 2000 : 5000,
  });
  const logs = logQuery.data ?? [];

  const totalOrigem = origem?.total ?? 0;
  const totalPaginas = estado.data?.total_paginas ?? origem?.totalPaginas ?? 0;
  const ultimaPagina = estado.data?.ultima_pagina ?? 0;
  const feito = matBanco.data ?? 0;
  const faltamMaterias = Math.max(0, totalOrigem - feito);
  // Progresso REAL é matérias no banco / na origem — nunca chega a 100% enquanto faltarem matérias.
  const pct = totalOrigem > 0 ? Math.min(100, Math.round((feito / totalOrigem) * 100)) : 0;
  const concluidoLotes = !!estado.data?.concluido;
  const alertaFaltantes = concluidoLotes && faltamMaterias > 0;

  // Detecção de execução morta
  const emExecucao: boolean = !!estado.data?.em_execucao;
  const batimento = estado.data?.batimento_em ? new Date(estado.data.batimento_em).getTime() : 0;
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const execucaoMorta = emExecucao && batimento > 0 && agora - batimento > 3 * 60_000;

  // Velocidade real e ETA (baseado nos últimos 5 lotes)
  const { velMinuto, etaSeg } = useMemo(() => {
    const h = historicoRef.current;
    if (!h.length) return { velMinuto: 0, etaSeg: 0 };
    const totMs = h.reduce((a, b) => a + b.ms, 0);
    const totProc = h.reduce((a, b) => a + b.processadas, 0);
    if (totMs === 0) return { velMinuto: 0, etaSeg: 0 };
    const vel = (totProc / totMs) * 60_000;
    const restam = Math.max(0, totalOrigem - feito);
    const eta = vel > 0 ? restam / (vel / 60) : 0;
    return { velMinuto: vel, etaSeg: eta };
  }, [totalOrigem, feito, ultima]);

  const materiaAtual = estado.data?.materia_atual as string | null | undefined;
  const imagemAtual = estado.data?.imagem_atual as string | null | undefined;
  const ultI = (estado.data?.ult_importados ?? 0) as number;
  const ultA = (estado.data?.ult_atualizados ?? 0) as number;
  const ultP = (estado.data?.ult_pulados ?? 0) as number;
  const ultE = (estado.data?.ult_erros ?? 0) as number;
  const bytesTot = (estado.data?.bytes_baixados ?? 0) as number;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Importar do WordPress</h1>
        <p className="text-sm text-muted-foreground">
          Fonte: hockey4life.com.br. Cursor por matéria: se um lote parar no meio, o próximo continua exatamente no próximo item.
        </p>
      </div>

      {execucaoMorta && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            Execução anterior interrompida (sem batimento há{" "}
            <strong>{Math.round((agora - batimento) / 1000)}s</strong>).
          </span>
          <button onClick={destravar}
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-destructive px-3 py-1 text-xs uppercase">
            <Unlock className="h-4 w-4" /> Destravar e continuar
          </button>
        </div>
      )}

      {alertaFaltantes && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/60 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            O cursor terminou, mas ainda faltam <strong>{fmt(faltamMaterias)}</strong> matérias no banco.
            Rode a conferência abaixo para listar os wp_id que ficaram de fora e reimporte apenas eles.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card label="Matérias no banco" value={fmt(feito)} />
        <Card label="Na origem" value={fmt(totalOrigem)} />
        <Card label="Página" value={`${ultimaPagina} / ${totalPaginas || "—"}`} />
        <Card label="Progresso" value={`${pct}%`} />
      </div>

      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Contadores do último lote (sempre separados) */}
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniCard cor="text-emerald-500" label="Importadas" value={ultI} />
        <MiniCard cor="text-sky-500" label="Atualizadas" value={ultA} />
        <MiniCard cor="text-muted-foreground" label="Puladas" value={ultP} />
        <MiniCard cor="text-destructive" label="Erros" value={ultE} />
      </div>

      {/* Totais acumulados desta importação (persistem entre lotes) */}
      <div className="rounded-md border border-border bg-card p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Totais acumulados</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <MiniCard cor="text-emerald-500" label="Importadas" value={(estado.data?.tot_importados ?? 0) as number} />
          <MiniCard cor="text-sky-500" label="Atualizadas" value={(estado.data?.tot_atualizados ?? 0) as number} />
          <MiniCard cor="text-muted-foreground" label="Puladas" value={(estado.data?.tot_pulados ?? 0) as number} />
          <MiniCard cor="text-destructive" label="Erros" value={(estado.data?.tot_erros ?? 0) as number} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">

        <strong>IMPORTADA:</strong> veio agora, pela primeira vez. ·{" "}
        <strong>ATUALIZADA:</strong> já existia e foi editada no WordPress depois. ·{" "}
        <strong>PULADA:</strong> já existia e nada mudou na origem — é o que acelera a importação. ·{" "}
        <strong>ERRO:</strong> falhou, motivo no log abaixo.
      </p>

      {/* Painel de execução ao vivo */}
      {(rodando || emExecucao) && (
        <div className="rounded-md border border-border bg-card p-4 text-sm">
          <div className="flex items-center gap-2 text-primary">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <strong>Executando…</strong>
          </div>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div><dt className="inline font-semibold text-foreground">Lote:</dt> página {ultimaPagina || "?"} · índice {estado.data?.indice_pagina ?? 0}</div>
            <div><dt className="inline font-semibold text-foreground">Velocidade:</dt> {velMinuto ? `${velMinuto.toFixed(1)} matérias/min` : "medindo…"}</div>
            <div className="sm:col-span-2 truncate"><dt className="inline font-semibold text-foreground">Matéria atual:</dt> {materiaAtual ?? "—"}</div>
            <div className="sm:col-span-2 truncate"><dt className="inline font-semibold text-foreground">Imagem atual:</dt> {imagemAtual ?? "—"}</div>
            <div><dt className="inline font-semibold text-foreground">Baixado:</dt> {fmtBytes(bytesTot)}</div>
            <div><dt className="inline font-semibold text-foreground">Tempo estimado:</dt> {fmtDuracao(etaSeg)}</div>
          </dl>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={importarProximo} disabled={rodando || execucaoMorta}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground disabled:opacity-50">
          <Play className="h-4 w-4" /> Próximo lote
        </button>
        <button onClick={importarTudo} disabled={rodando || execucaoMorta}
          className="inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-semibold uppercase text-primary disabled:opacity-50">
          <Play className="h-4 w-4" /> Importar tudo
        </button>
        <button onClick={parar} disabled={!rodando}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm uppercase disabled:opacity-50">
          <Square className="h-4 w-4" /> Parar
        </button>
        <button onClick={destravar}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm uppercase">
          <Unlock className="h-4 w-4" /> Destravar
        </button>
        <button onClick={reprocessarErros} disabled={rodando || !erros.data?.itens.length}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm uppercase disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> Reprocessar erros
        </button>
        <button onClick={invalidarTudo}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm uppercase">
          <RotateCw className="h-4 w-4" /> Recontar
        </button>
        <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={forcar} onChange={(e) => setForcar(e.target.checked)} />
          Forçar reimportação
        </label>
        <button onClick={zerarTotais}
          className="ml-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1 text-xs uppercase text-muted-foreground">
          Zerar totais
        </button>
        <button onClick={removerSeed}
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-destructive/60 px-4 py-2 text-sm uppercase text-destructive">
          <Trash2 className="h-4 w-4" /> Remover exemplos
        </button>
      </div>

      {erroGlobal && (
        <div className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{erroGlobal.amigavel}</p>
          {erroGlobal.tecnico && (
            <details className="mt-1 text-xs text-destructive/80">
              <summary className="cursor-pointer">ver detalhes técnicos</summary>
              <pre className="mt-1 whitespace-pre-wrap font-mono">{erroGlobal.tecnico}</pre>
            </details>
          )}
        </div>
      )}

      {/* Conferência com a origem */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="h4l-title text-xl text-foreground">Conferência com a origem</h2>
          <button onClick={rodarConferencia} disabled={conferindo}
            className="inline-flex items-center gap-2 rounded-md border border-primary px-3 py-1.5 text-xs font-semibold uppercase text-primary disabled:opacity-50">
            <ClipboardCheck className="h-4 w-4" /> {conferindo ? "Conferindo…" : "Conferir agora"}
          </button>
          {conferir?.faltando?.length ? (
            <button onClick={importarFaltantes} disabled={rodando}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold uppercase text-primary-foreground disabled:opacity-50">
              <DownloadCloud className="h-4 w-4" /> Importar as {conferir.faltando.length} faltantes
            </button>
          ) : null}
        </div>
        {conferir && (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              Na origem: <strong>{fmt(conferir.origem_total)}</strong> · No banco:{" "}
              <strong>{fmt(conferir.banco_total)}</strong> · Faltando:{" "}
              <strong className={conferir.faltando.length ? "text-destructive" : "text-emerald-500"}>
                {fmt(conferir.faltando.length)}
              </strong>
            </p>
            {conferir.faltando.length === 0 && (
              <p className="text-emerald-500">Tudo em dia — importação completa.</p>
            )}
            {conferir.faltando.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded border border-border bg-background p-2 font-mono text-xs">
                {conferir.faltando.slice(0, 500).map((id) => (
                  <div key={id}>
                    <a href={`https://hockey4life.com.br/?p=${id}`} target="_blank" rel="noreferrer"
                      className="text-primary hover:underline">#{id}</a>
                  </div>
                ))}
                {conferir.faltando.length > 500 && (
                  <p className="mt-2 text-muted-foreground">…e mais {conferir.faltando.length - 500}.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log ao vivo */}
      <div>
        <h2 className="h4l-title text-xl text-foreground">Log ao vivo</h2>
        <div className="mt-3 max-h-80 overflow-y-auto rounded-md border border-border bg-card font-mono text-xs">
          {logs.length ? (
            <ul className="divide-y divide-border">
              {logs.map((l, i) => (
                <li key={i} className="flex gap-2 p-2">
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(l.ts).toLocaleTimeString("pt-BR")}
                  </span>
                  <span className={`shrink-0 font-semibold uppercase ${
                    l.nivel === "importada" ? "text-emerald-500" :
                    l.nivel === "atualizada" ? "text-sky-500" :
                    l.nivel === "pulada" ? "text-muted-foreground" :
                    l.nivel === "erro" ? "text-destructive" : "text-primary"
                  }`}>{l.nivel}</span>
                  <span className="truncate">{l.msg}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-muted-foreground">Sem eventos ainda.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="h4l-title text-xl text-foreground">Últimas matérias importadas ({ultimasImportadas.data?.total ?? 0})</h2>
        <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-border bg-card">
          {ultimasImportadas.data?.itens.length ? (
            <ul className="divide-y divide-border">
              {ultimasImportadas.data.itens.map((p) => (
                <li key={p.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {p.status === "publicado" ? (
                      <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary">
                        <span>{p.titulo}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="font-medium">{p.titulo}</span>
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

function MiniCard({ label, value, cor }: { label: string; value: number; cor: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className={`h4l-title text-2xl ${cor}`}>{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
