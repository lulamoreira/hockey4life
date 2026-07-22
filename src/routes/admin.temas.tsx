import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listTemasAdmin,
  saveTema,
  deleteTema,
  toggleTemaMenu,
  updateTemaCampos,
  mesclarTemas,
  listarPossiveisDuplicados,
} from "@/lib/admin.functions";
import { slugify } from "@/lib/slugify";
import { Plus, Trash2, AlertTriangle, GitMerge, Loader2, ChevronLeft, ChevronRight, Search } from "lucide-react";

export const Route = createFileRoute("/admin/temas")({
  component: TemasPage,
});

const MAX_MENU = 6;

type Aba = "todos" | "menu" | "duplicados";

function TemasPage() {
  const [aba, setAba] = useState<Aba>("todos");

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Temas</h1>
          <p className="text-sm text-muted-foreground">Times, assuntos e curadoria do menu.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        {([
          ["todos", "Todos"],
          ["menu", "No menu"],
          ["duplicados", "Possíveis duplicados"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide ${
              aba === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {aba === "todos" && <AbaLista filtroMenu="todos" />}
        {aba === "menu" && <AbaLista filtroMenu="sim" />}
        {aba === "duplicados" && <AbaDuplicados />}
      </div>
    </div>
  );
}

/* -------------------------- Aba: Lista + Adicionar -------------------------- */

function AbaLista({ filtroMenu }: { filtroMenu: "todos" | "sim" | "nao" }) {
  const qc = useQueryClient();
  const listar = useServerFn(listTemasAdmin);
  const salvar = useServerFn(saveTema);
  const togglar = useServerFn(toggleTemaMenu);
  const atualizar = useServerFn(updateTemaCampos);
  const excluir = useServerFn(deleteTema);

  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"todos" | "time" | "assunto">("todos");
  const [ordemPor, setOrdemPor] = useState<"nome" | "ordem" | "total" | "tipo">("nome");
  const [ordem, setOrdem] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const perPage = 50;

  const params = { q, tipo, menu: filtroMenu, ordemPor, ordem, page, perPage };
  const { data, isFetching } = useQuery({
    queryKey: ["admin-temas", params],
    queryFn: () => listar({ data: params }),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["admin-temas"] });

  // Novo
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<"time" | "assunto">("assunto");
  const [novoOrdem, setNovoOrdem] = useState(0);
  const [novoMenu, setNovoMenu] = useState(false);
  const criar = async () => {
    if (!novoNome.trim()) return;
    await salvar({ data: { nome: novoNome, slug: slugify(novoNome), tipo: novoTipo, destaque_menu: novoMenu, ordem: novoOrdem } });
    setNovoNome(""); setNovoOrdem(0); setNovoMenu(false);
    invalidar();
  };

  const onToggleMenu = async (id: string, atual: boolean) => {
    const proximo = !atual;
    if (proximo && (data?.totalNoMenu ?? 0) >= MAX_MENU) {
      if (!confirm(`O menu já tem ${data?.totalNoMenu} itens. Recomendado: no máximo ${MAX_MENU}. Deseja adicionar mesmo assim?`)) return;
    }
    await togglar({ data: { id, valor: proximo } });
    invalidar();
  };

  const onExcluir = async (id: string, nome: string, total: number) => {
    if (total > 0) {
      const ok = confirm(
        `O tema "${nome}" está em ${total} matéria(s). Elas NÃO serão apagadas — apenas ficarão sem esse tema. Confirma?`,
      );
      if (!ok) return;
      const r = await excluir({ data: { id, forcar: true } });
      if (!(r as any).ok) alert("Não foi possível excluir.");
    } else {
      if (!confirm(`Excluir o tema "${nome}"?`)) return;
      await excluir({ data: { id, forcar: false } });
    }
    invalidar();
  };

  const totalGeral = data?.totalGeral ?? 0;
  const totalNoMenu = data?.totalNoMenu ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const excedeuMenu = totalNoMenu > MAX_MENU;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md bg-card px-3 py-1 text-muted-foreground">Total no banco: <strong className="text-foreground">{totalGeral}</strong></span>
        <span className={`rounded-md px-3 py-1 ${excedeuMenu ? "bg-destructive/20 text-destructive" : "bg-card text-muted-foreground"}`}>
          No menu: <strong className={excedeuMenu ? "text-destructive" : "text-foreground"}>{totalNoMenu}</strong> / {MAX_MENU}
        </span>
        {excedeuMenu && (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Excede o recomendado para o cabeçalho.
          </span>
        )}
      </div>

      {/* Adicionar */}
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_140px_120px_100px_auto]">
        <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Novo tema"
          className="rounded-md border border-border bg-background px-3 py-2" />
        <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as any)}
          className="rounded-md border border-border bg-background px-3 py-2">
          <option value="time">Time</option>
          <option value="assunto">Assunto</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={novoMenu} onChange={(e) => setNovoMenu(e.target.checked)} /> Menu
        </label>
        <input type="number" value={novoOrdem} onChange={(e) => setNovoOrdem(+e.target.value)} placeholder="Ordem"
          className="rounded-md border border-border bg-background px-3 py-2" />
        <button onClick={criar} className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>

      {/* Filtros */}
      <div className="mt-6 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_160px_180px_160px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Buscar por nome"
            className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2" />
        </div>
        <select value={tipo} onChange={(e) => { setPage(1); setTipo(e.target.value as any); }}
          className="rounded-md border border-border bg-background px-3 py-2">
          <option value="todos">Todos os tipos</option>
          <option value="time">Times</option>
          <option value="assunto">Assuntos</option>
        </select>
        <select value={ordemPor} onChange={(e) => setOrdemPor(e.target.value as any)}
          className="rounded-md border border-border bg-background px-3 py-2">
          <option value="nome">Ordenar por Nome</option>
          <option value="total">Ordenar por Matérias</option>
          <option value="ordem">Ordenar por Ordem</option>
          <option value="tipo">Ordenar por Tipo</option>
        </select>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as any)}
          className="rounded-md border border-border bg-background px-3 py-2">
          <option value="asc">Ascendente</option>
          <option value="desc">Descendente</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs uppercase text-muted-foreground">
            <tr>
              <Th label="Nome" onClick={() => { setOrdemPor("nome"); setOrdem((o) => o === "asc" ? "desc" : "asc"); }} active={ordemPor === "nome"} dir={ordem} />
              <th className="px-4 py-3 text-left">Slug</th>
              <Th label="Tipo" onClick={() => { setOrdemPor("tipo"); setOrdem((o) => o === "asc" ? "desc" : "asc"); }} active={ordemPor === "tipo"} dir={ordem} />
              <th className="px-4 py-3 text-left">Menu</th>
              <Th label="Ordem" onClick={() => { setOrdemPor("ordem"); setOrdem((o) => o === "asc" ? "desc" : "asc"); }} active={ordemPor === "ordem"} dir={ordem} />
              <Th label="Matérias" onClick={() => { setOrdemPor("total"); setOrdem((o) => o === "asc" ? "desc" : "asc"); }} active={ordemPor === "total"} dir={ordem} />
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data?.items ?? []).map((t: any) => (
              <LinhaTema key={t.id} t={t}
                onToggle={() => onToggleMenu(t.id, t.destaque_menu)}
                onSalvar={async (patch) => { await atualizar({ data: { id: t.id, ...patch } }); invalidar(); }}
                onExcluir={() => onExcluir(t.id, t.nome, t.total)} />
            ))}
            {(!data?.items || data.items.length === 0) && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum tema encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Mostrando {(data?.items?.length ?? 0)} de {data?.total ?? 0} {isFetching && "(atualizando…)"}
        </span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-muted-foreground">Página {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 disabled:opacity-40">
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function Th({ label, onClick, active, dir }: { label: string; onClick: () => void; active: boolean; dir: "asc" | "desc" }) {
  return (
    <th className="px-4 py-3 text-left">
      <button onClick={onClick} className={`inline-flex items-center gap-1 ${active ? "text-foreground" : ""}`}>
        {label}{active ? (dir === "asc" ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
}

function LinhaTema({ t, onToggle, onSalvar, onExcluir }: {
  t: { id: string; nome: string; slug: string; tipo: "time" | "assunto"; destaque_menu: boolean; ordem: number; total: number };
  onToggle: () => void;
  onSalvar: (patch: { nome?: string; tipo?: "time" | "assunto"; ordem?: number }) => Promise<void>;
  onExcluir: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(t.nome);
  const [tipo, setTipo] = useState<"time" | "assunto">(t.tipo);
  const [ordem, setOrdem] = useState<number>(t.ordem);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSalvar({ nome, tipo, ordem });
      setEditando(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <tr>
      <td className="px-4 py-3 font-medium">
        {editando ? (
          <input value={nome} onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1" />
        ) : t.nome}
      </td>
      <td className="px-4 py-3 text-muted-foreground">/{t.tipo}/{t.slug}</td>
      <td className="px-4 py-3">
        {editando ? (
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}
            className="rounded-md border border-border bg-background px-2 py-1">
            <option value="time">Time</option>
            <option value="assunto">Assunto</option>
          </select>
        ) : t.tipo}
      </td>
      <td className="px-4 py-3">
        <button onClick={onToggle} className={`rounded px-2 py-1 text-xs font-semibold ${t.destaque_menu ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
          {t.destaque_menu ? "✓ No menu" : "Fora"}
        </button>
      </td>
      <td className="px-4 py-3">
        {editando ? (
          <input type="number" value={ordem} onChange={(e) => setOrdem(+e.target.value)}
            className="w-20 rounded-md border border-border bg-background px-2 py-1" />
        ) : t.ordem}
      </td>
      <td className="px-4 py-3 tabular-nums">{t.total}</td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-3">
          {editando ? (
            <>
              <button onClick={salvar} disabled={salvando} className="text-xs font-semibold text-primary hover:underline disabled:opacity-40">
                {salvando ? "Salvando…" : "Salvar"}
              </button>
              <button onClick={() => { setEditando(false); setNome(t.nome); setTipo(t.tipo); setOrdem(t.ordem); }}
                className="text-xs text-muted-foreground hover:underline">Cancelar</button>
            </>
          ) : (
            <button onClick={() => setEditando(true)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Editar</button>
          )}
          <button onClick={onExcluir} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ----------------------------- Aba: Duplicados ----------------------------- */

function AbaDuplicados() {
  const qc = useQueryClient();
  const listar = useServerFn(listarPossiveisDuplicados);
  const mesclar = useServerFn(mesclarTemas);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-duplicados"],
    queryFn: () => listar(),
    staleTime: 60_000,
  });

  const [selecionado, setSelecionado] = useState<{ chave: string; principal: string; secundarios: string[] } | null>(null);
  const [previa, setPrevia] = useState<any>(null);
  const [aplicando, setAplicando] = useState(false);

  const gerarPrevia = useMutation({
    mutationFn: (v: { principal_id: string; secundarios_ids: string[] }) => mesclar({ data: { ...v, dryRun: true } }),
    onSuccess: (r) => setPrevia(r),
  });

  const aplicar = async () => {
    if (!selecionado) return;
    if (!confirm("Ação irreversível. Deseja mesclar agora?")) return;
    setAplicando(true);
    try {
      await mesclar({ data: { principal_id: selecionado.principal, secundarios_ids: selecionado.secundarios, dryRun: false } });
      setSelecionado(null); setPrevia(null);
      await refetch();
      qc.invalidateQueries({ queryKey: ["admin-temas"] });
      alert("Mesclagem concluída.");
    } finally {
      setAplicando(false);
    }
  };

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analisando temas…</div>;

  const grupos = data ?? [];

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {grupos.length} grupo(s) de possíveis duplicados. Escolha o tema principal e selecione os secundários; as matérias dos secundários vão para o principal e os secundários são apagados.
      </p>

      <div className="mt-4 space-y-3">
        {grupos.map((g) => {
          const isSel = selecionado?.chave === g.chave;
          return (
            <div key={g.chave} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 text-xs uppercase text-muted-foreground">Grupo: {g.chave.startsWith("~") ? "similares" : "nome idêntico (normalizado)"}</div>
              <div className="grid gap-2">
                {g.itens.map((it) => {
                  const isPrincipal = isSel && selecionado?.principal === it.id;
                  const isSec = isSel && selecionado?.secundarios.includes(it.id);
                  return (
                    <div key={it.id} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-md border border-border/50 px-3 py-2">
                      <label className="inline-flex items-center gap-1 text-xs">
                        <input type="radio" name={`principal-${g.chave}`} checked={!!isPrincipal}
                          onChange={() => {
                            const secundarios = g.itens.filter((x) => x.id !== it.id).map((x) => x.id);
                            setSelecionado({ chave: g.chave, principal: it.id, secundarios: [] });
                            void secundarios;
                            setPrevia(null);
                          }} />
                        Principal
                      </label>
                      <label className="inline-flex items-center gap-1 text-xs">
                        <input type="checkbox" disabled={!isSel || isPrincipal}
                          checked={!!isSec}
                          onChange={(e) => {
                            if (!selecionado) return;
                            const set = new Set(selecionado.secundarios);
                            if (e.target.checked) set.add(it.id); else set.delete(it.id);
                            setSelecionado({ ...selecionado, secundarios: Array.from(set) });
                            setPrevia(null);
                          }} />
                        Secundário
                      </label>
                      <div>
                        <div className="text-sm font-medium">{it.nome}</div>
                        <div className="text-xs text-muted-foreground">/{it.tipo}/{it.slug}</div>
                      </div>
                      <div className="text-sm tabular-nums text-muted-foreground">{it.total} matéria(s)</div>
                    </div>
                  );
                })}
              </div>

              {isSel && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    disabled={selecionado.secundarios.length === 0 || gerarPrevia.isPending}
                    onClick={() => gerarPrevia.mutate({ principal_id: selecionado.principal, secundarios_ids: selecionado.secundarios })}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase disabled:opacity-40">
                    <GitMerge className="h-3.5 w-3.5" /> {gerarPrevia.isPending ? "Calculando…" : "Ver prévia"}
                  </button>
                  {previa && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Matérias a mover: <strong className="text-foreground">{previa.vaoSerMovidas}</strong></span>
                      <span>· Depois o principal terá <strong className="text-foreground">{previa.totalPrincipalDepois}</strong>.</span>
                      <button onClick={aplicar} disabled={aplicando}
                        className="ml-2 inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1 text-xs font-semibold uppercase text-destructive-foreground disabled:opacity-40">
                        {aplicando ? "Aplicando…" : "Aplicar mesclagem"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {grupos.length === 0 && <div className="text-sm text-muted-foreground">Nada suspeito por aqui.</div>}
      </div>
    </div>
  );
}
