import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  backupInfo, backupPartePosts, backupMeta, backupMidiaManifesto,
  simularRestauracao, aplicarRestauracao, listarRestauracoes,
  listarBackupsAutomaticos, baixarBackupAutomatico,
} from "@/lib/backup.functions";
import { Download, Upload, AlertTriangle, CheckCircle2, Clock, RefreshCw, FileJson, Image as ImgIcon } from "lucide-react";

export const Route = createFileRoute("/admin/backup")({
  head: () => ({ meta: [{ title: "Backup — Admin H4L" }, { name: "robots", content: "noindex" }] }),
  component: BackupPage,
});

function bytesLegivel(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function baixarJSON(nome: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BackupPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="h4l-title text-3xl">Backup e restauração</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Duas camadas independentes: conteúdo (JSON leve) e mídia (arquivos do bucket).
          Restauração sempre passa por simulação antes de gravar.
        </p>
      </div>

      <BackupConteudo />
      <BackupMidia />
      <BackupsAutomaticos />
      <Restauracao />
      <HistoricoRestauracoes />
    </div>
  );
}

/* ============ CONTEÚDO ============ */
function BackupConteudo() {
  const info = useQuery({ queryKey: ["backup-info"], queryFn: () => backupInfo() });
  const [incluirContatos, setIncluirContatos] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState("");

  const gerar = async () => {
    if (!info.data) return;
    setRodando(true);
    try {
      const meta = await backupMeta({ data: { incluirContatos } });
      const partes: { arquivo: string; total: number }[] = [];
      for (let p = 1; p <= info.data.partes; p++) {
        setProgresso(`Gerando parte ${p}/${info.data.partes}…`);
        const parte = await backupPartePosts({ data: { parte: p } });
        const nome = `backup-conteudo-${String(p).padStart(3, "0")}.json`;
        baixarJSON(nome, { parte: p, posts: parte.posts, post_temas: parte.post_temas });
        partes.push({ arquivo: nome, total: parte.posts.length });
      }
      const manifesto = {
        formato: "h4l-backup/1",
        gerado_em: new Date().toISOString(),
        total_posts: info.data.totalPosts,
        total_temas: info.data.totalTemas,
        incluiu_contatos: incluirContatos,
        partes,
        temas: meta.temas,
        configuracoes: meta.configuracoes,
        contatos: meta.contatos,
      };
      baixarJSON("backup-manifesto.json", manifesto);
      setProgresso(`Concluído: ${info.data.totalPosts} matérias em ${info.data.partes} parte(s).`);
    } catch (e: any) {
      setProgresso(`Erro: ${e.message}`);
    } finally {
      setRodando(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <FileJson className="h-5 w-5 text-primary" />
        <h2 className="h4l-title text-xl">Camada 1 — Conteúdo (JSON)</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Exporta matérias, temas, ligações e configurações. Partes de 200 matérias por arquivo,
        mais um <em>backup-manifesto.json</em> que lista tudo. Este backup é leve e recomendado semanalmente.
      </p>
      {info.data && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <Info label="Matérias" v={info.data.totalPosts} />
          <Info label="Temas" v={info.data.totalTemas} />
          <Info label="Partes" v={info.data.partes} />
          <Info label="Contatos" v={info.data.totalContatos} />
        </div>
      )}
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={incluirContatos} onChange={(e) => setIncluirContatos(e.target.checked)} />
        <span>
          <strong>Incluir mensagens do Fale Conosco.</strong>{" "}
          <span className="text-muted-foreground">São dados pessoais de terceiros e ficam de fora por padrão.</span>
        </span>
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={gerar}
          disabled={rodando || !info.data}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {rodando ? "Gerando…" : "Baixar backup de conteúdo"}
        </button>
        {progresso && <span className="text-sm text-muted-foreground">{progresso}</span>}
      </div>
    </section>
  );
}

function Info({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{v.toLocaleString("pt-BR")}</div>
    </div>
  );
}

/* ============ MÍDIA ============ */
function BackupMidia() {
  const q = useQuery({ queryKey: ["midia-manifesto"], queryFn: () => backupMidiaManifesto() });
  const gruposArr = q.data ? Object.entries(q.data.grupos).sort((a, b) => a[0].localeCompare(b[0])) : [];

  const baixarListaAno = (ano: string, arquivos: any[]) => {
    baixarJSON(`backup-midia-${ano}.json`, { ano, total: arquivos.length, arquivos });
  };
  const baixarManifesto = () => {
    if (q.data) baixarJSON("backup-midia-manifesto.json", q.data);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <ImgIcon className="h-5 w-5 text-primary" />
        <h2 className="h4l-title text-xl">Camada 2 — Mídia (bucket)</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        As fotos vivem no bucket <code className="text-primary">midia</code>, organizadas por ano.
        O manifesto lista caminho, tamanho e data de cada arquivo — é ele que permite descobrir depois se alguma foto sumiu.
        Cada lista por ano contém as URLs públicas dos arquivos daquele ano.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={baixarManifesto} disabled={!q.data} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <Download className="h-4 w-4" /> Baixar manifesto de mídia
        </button>
      </div>
      {q.isLoading && <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>}
      {gruposArr.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Ano</th><th>Arquivos</th><th>Tamanho</th><th></th></tr>
            </thead>
            <tbody>
              {gruposArr.map(([ano, g]) => (
                <tr key={ano} className="border-t border-border">
                  <td className="py-2 font-semibold">{ano}</td>
                  <td>{g.total.toLocaleString("pt-BR")}</td>
                  <td>{bytesLegivel(g.bytes)}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => baixarListaAno(ano, g.arquivos)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                      <Download className="h-3 w-3" /> Baixar lista
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.data && gruposArr.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum arquivo em <code>wp/</code> ainda.</p>
      )}
    </section>
  );
}

/* ============ BACKUPS AUTOMÁTICOS ============ */
function BackupsAutomaticos() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["backups-auto"], queryFn: () => listarBackupsAutomaticos() });
  const baixar = useMutation({
    mutationFn: async (nome: string) => {
      const dados = await baixarBackupAutomatico({ data: { nome } });
      baixarJSON(nome, dados);
    },
  });

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="h4l-title text-xl">Backups automáticos (semanais)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma rotina semanal gera o backup de conteúdo e guarda no bucket privado <code>backups</code>.
            Mantemos os 8 mais recentes.
          </p>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ["backups-auto"] })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>
      {q.isLoading && <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>}
      {q.data && q.data.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum backup automático ainda. O primeiro será gerado no próximo domingo às 03:00 (UTC).</p>
      )}
      {q.data && q.data.length > 0 && (
        <ul className="mt-3 divide-y divide-border text-sm">
          {q.data.map((b) => (
            <li key={b.nome} className="flex items-center justify-between py-2">
              <div>
                <div className="font-mono text-xs">{b.nome}</div>
                <div className="text-xs text-muted-foreground">{b.criado_em ? new Date(b.criado_em).toLocaleString("pt-BR") : "—"} · {bytesLegivel(b.tamanho)}</div>
              </div>
              <button
                onClick={() => baixar.mutate(b.nome)}
                disabled={baixar.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
              >
                <Download className="h-3 w-3" /> Baixar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ============ RESTAURAÇÃO ============ */
type Manifesto = {
  formato: string;
  total_posts: number;
  partes: { arquivo: string; total: number }[];
  temas?: any[];
  configuracoes?: any[];
};
type ArquivoParte = { parte: number; posts: any[]; post_temas: any[] };

function Restauracao() {
  const qc = useQueryClient();
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [partes, setPartes] = useState<ArquivoParte[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [simulacao, setSimulacao] = useState<any>(null);
  const [modo, setModo] = useState<"mesclar" | "substituir">("mesclar");
  const [confirmSubstituir, setConfirmSubstituir] = useState("");
  const [mensagem, setMensagem] = useState("");

  const resetar = () => {
    setManifesto(null); setPartes([]); setErros([]); setSimulacao(null); setMensagem("");
  };

  const carregarArquivos = async (files: FileList | null) => {
    if (!files) return;
    resetar();
    const lidos: any[] = [];
    for (const f of Array.from(files)) {
      try {
        const txt = await f.text();
        lidos.push({ nome: f.name, json: JSON.parse(txt) });
      } catch (e: any) {
        setErros((p) => [...p, `${f.name}: ${e.message}`]);
      }
    }
    // Detecta consolidado (traz { manifesto, posts, post_temas })
    const consolidado = lidos.find((l) => l.json?.manifesto?.formato === "h4l-backup/1");
    if (consolidado) {
      const j = consolidado.json;
      const m = j.manifesto;
      setManifesto(m);
      setPartes([{ parte: 1, posts: j.posts, post_temas: j.post_temas ?? [] }]);
      return;
    }
    const manif = lidos.find((l) => l.json?.formato === "h4l-backup/1");
    if (!manif) { setErros((p) => [...p, "Nenhum backup-manifesto.json com formato h4l-backup/1."]); return; }
    const m = manif.json as Manifesto;
    setManifesto(m);
    const partsFound: ArquivoParte[] = [];
    const faltando: string[] = [];
    for (const info of m.partes) {
      const arq = lidos.find((l) => l.nome === info.arquivo);
      if (!arq) faltando.push(info.arquivo);
      else partsFound.push({ parte: arq.json.parte, posts: arq.json.posts ?? [], post_temas: arq.json.post_temas ?? [] });
    }
    if (faltando.length) setErros((p) => [...p, `Faltam partes: ${faltando.join(", ")}`]);
    setPartes(partsFound);
  };

  const totalPosts = partes.reduce((s, p) => s + p.posts.length, 0);
  const podeSimular = manifesto && erros.length === 0 && totalPosts > 0;

  const simular = useMutation({
    mutationFn: async () => {
      const posts = partes.flatMap((p) => p.posts);
      const post_temas = partes.flatMap((p) => p.post_temas);
      return await simularRestauracao({
        data: { posts, post_temas, temas: manifesto?.temas ?? [], configuracoes: manifesto?.configuracoes ?? [] },
      });
    },
    onSuccess: (r) => setSimulacao(r),
    onError: (e: any) => setMensagem(`Erro na simulação: ${e.message}`),
  });

  const aplicar = useMutation({
    mutationFn: async () => {
      const posts = partes.flatMap((p) => p.posts);
      const post_temas = partes.flatMap((p) => p.post_temas);
      return await aplicarRestauracao({
        data: {
          posts, post_temas,
          temas: manifesto?.temas ?? [], configuracoes: manifesto?.configuracoes ?? [],
          modo, confirmacao: modo === "substituir" ? confirmSubstituir : undefined,
        },
      });
    },
    onSuccess: (r) => {
      setMensagem(`Feito. Criadas: ${r.criadas}, atualizadas: ${r.atualizadas}, apagadas: ${r.apagadas}.`);
      qc.invalidateQueries({ queryKey: ["restauracoes"] });
      qc.invalidateQueries({ queryKey: ["backup-info"] });
    },
    onError: (e: any) => setMensagem(`Erro ao aplicar: ${e.message}`),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5 text-primary" />
        <h2 className="h4l-title text-xl">Restauração</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        <strong>Etapa 1 — Simular:</strong> envie o manifesto e todas as partes. O sistema valida e mostra o que aconteceria.
        Nada é gravado.<br />
        <strong>Etapa 2 — Aplicar:</strong> depois de conferir a simulação, escolha o modo.
      </p>

      <div className="mt-4">
        <label className="block text-sm font-medium">Arquivos do backup (manifesto + partes)</label>
        <input
          type="file" accept="application/json" multiple
          onChange={(e) => carregarArquivos(e.target.files)}
          className="mt-1 block w-full text-sm"
        />
      </div>

      {erros.length > 0 && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <div className="flex items-center gap-1 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Problemas no envio</div>
          <ul className="mt-1 list-disc pl-5 text-destructive">{erros.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {manifesto && (
        <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
          <div>Formato: <code>{manifesto.formato}</code></div>
          <div>Manifesto anuncia {manifesto.total_posts} matérias em {manifesto.partes.length} parte(s).</div>
          <div>Carregado: {totalPosts} matérias em {partes.length} parte(s).</div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => simular.mutate()}
          disabled={!podeSimular || simular.isPending}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          {simular.isPending ? "Simulando…" : "Simular restauração"}
        </button>
      </div>

      {simulacao && (
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
            <div className="flex items-center gap-1 font-semibold text-primary"><CheckCircle2 className="h-4 w-4" /> Simulação (nada foi gravado)</div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Info label="No banco" v={simulacao.totalNoBanco} />
              <Info label="Seriam criadas" v={simulacao.criadas} />
              <Info label="Seriam atualizadas" v={simulacao.atualizadas} />
              <Info label="Seriam intactas" v={simulacao.intactas} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Modo <em>Substituir tudo</em> apagaria <strong className="text-destructive">{simulacao.apagariamSeSubstituir}</strong> matéria(s) que não constam no backup.
            </p>
          </div>

          <div className="rounded-md border border-border p-4">
            <div className="text-sm font-semibold">Escolha o modo</div>
            <div className="mt-2 space-y-2 text-sm">
              <label className="flex items-start gap-2">
                <input type="radio" name="modo" checked={modo === "mesclar"} onChange={() => setModo("mesclar")} className="mt-1" />
                <span><strong>Mesclar (recomendado):</strong> cria o que falta, atualiza o que existe. Não apaga nada.</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="modo" checked={modo === "substituir"} onChange={() => setModo("substituir")} className="mt-1" />
                <span className="text-destructive">
                  <strong>Substituir tudo:</strong> mescla e apaga as matérias que não estão no backup ({simulacao.apagariamSeSubstituir}).
                </span>
              </label>
            </div>
            {modo === "substituir" && (
              <div className="mt-3">
                <label className="text-xs uppercase tracking-wide text-destructive">Digite SUBSTITUIR para liberar</label>
                <input
                  value={confirmSubstituir}
                  onChange={(e) => setConfirmSubstituir(e.target.value)}
                  className="mt-1 w-full rounded-md border border-destructive/50 bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
            <button
              onClick={() => aplicar.mutate()}
              disabled={aplicar.isPending || (modo === "substituir" && confirmSubstituir !== "SUBSTITUIR")}
              className={`mt-3 rounded-md px-4 py-2 text-sm font-semibold uppercase ${modo === "substituir" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"} disabled:opacity-50`}
            >
              {aplicar.isPending ? "Aplicando…" : modo === "substituir" ? "Aplicar substituição" : "Aplicar mesclagem"}
            </button>
            {mensagem && <p className="mt-2 text-sm">{mensagem}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

/* ============ HISTÓRICO ============ */
function HistoricoRestauracoes() {
  const q = useQuery({ queryKey: ["restauracoes"], queryFn: () => listarRestauracoes() });
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="h4l-title text-xl">Histórico de restaurações</h2>
      </div>
      {q.isLoading && <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>}
      {q.data && q.data.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhuma restauração registrada.</p>}
      {q.data && q.data.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr><th className="py-2">Quando</th><th>Quem</th><th>Modo</th><th>Criadas</th><th>Atualizadas</th><th>Apagadas</th></tr>
          </thead>
          <tbody>
            {q.data.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2">{new Date(r.criado_em).toLocaleString("pt-BR")}</td>
                <td>{r.usuario_email ?? "—"}</td>
                <td className={r.modo === "substituir" ? "text-destructive" : ""}>{r.modo}</td>
                <td>{r.criadas}</td>
                <td>{r.atualizadas}</td>
                <td>{r.apagadas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
