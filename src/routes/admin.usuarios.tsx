import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listUsuarios, listPapeis, atribuirPapel, savePapel, deletePapel, PERMISSOES, type Permissao } from "@/lib/equipe.functions";
import { Users, Shield, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Admin" }, { name: "robots", content: "noindex" }] }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const [aba, setAba] = useState<"usuarios" | "papeis">("usuarios");
  return (
    <div>
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Usuários e papéis</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Atribua papéis aos usuários e ligue/desligue permissões.
      </p>
      <div className="mt-6 flex gap-2 border-b border-border">
        {(["usuarios", "papeis"] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-3 py-2 text-sm uppercase tracking-wider ${aba === a ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            {a === "usuarios" ? "Usuários" : "Papéis"}
          </button>
        ))}
      </div>
      <div className="mt-6">{aba === "usuarios" ? <ListaUsuarios /> : <ListaPapeis />}</div>
    </div>
  );
}

function ListaUsuarios() {
  const [q, setQ] = useState("");
  const [equipe, setEquipe] = useState(false);
  const qc = useQueryClient();
  const usuariosQ = useQuery({
    queryKey: ["usuarios", q, equipe],
    queryFn: () => listUsuarios({ data: { q, apenasEquipe: equipe } }),
  });
  const papeisQ = useQuery({ queryKey: ["papeis"], queryFn: () => listPapeis() });
  const atribuir = useServerFn(atribuirPapel);

  const trocar = async (userId: string, papelId: string | null) => {
    await atribuir({ data: { user_id: userId, papel_id: papelId } });
    qc.invalidateQueries({ queryKey: ["usuarios"] });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail…"
          className="min-w-[200px] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
        <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <input type="checkbox" checked={equipe} onChange={(e) => setEquipe(e.target.checked)} />
          Só equipe
        </label>
      </div>

      {usuariosQ.isLoading && <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>}

      {/* Desktop: tabela */}
      <div className="mt-6 hidden overflow-hidden rounded-lg border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Usuário</th>
              <th className="px-4 py-3 text-left">E-mail</th>
              <th className="px-4 py-3 text-left">Papel atual</th>
              <th className="px-4 py-3 text-left">Trocar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(usuariosQ.data ?? []).map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u.foto_url ? (
                      <img src={u.foto_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted" />
                    )}
                    <span className="font-medium">{u.nome ?? "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase">{u.papel_nome}</span>
                </td>
                <td className="px-4 py-3">
                  <SeletorPapel
                    valorAtual={u.papel_slug}
                    papeis={papeisQ.data ?? []}
                    onChange={(pid) => trocar(u.id, pid)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cartões */}
      <div className="mt-6 space-y-3 md:hidden">
        {(usuariosQ.data ?? []).map((u) => (
          <div key={u.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              {u.foto_url ? (
                <img src={u.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{u.nome ?? "—"}</div>
                <div className="truncate text-xs text-muted-foreground">{u.email}</div>
              </div>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{u.papel_nome}</span>
            </div>
            <div className="mt-3">
              <SeletorPapel
                valorAtual={u.papel_slug}
                papeis={papeisQ.data ?? []}
                onChange={(pid) => trocar(u.id, pid)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeletorPapel({
  valorAtual, papeis, onChange,
}: {
  valorAtual: string | null;
  papeis: Array<{ id: string; nome: string; slug: string }>;
  onChange: (id: string | null) => void;
}) {
  const atualId = papeis.find((p) => p.slug === valorAtual)?.id ?? "";
  return (
    <select
      value={atualId ? atualId : "__leitor__"}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "__leitor__" ? null : v);
      }}
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
    >
      <option value="__leitor__">Leitor (sem acesso ao painel)</option>
      {papeis.filter((p) => p.slug !== "leitor").map((p) => (
        <option key={p.id} value={p.id}>{p.nome}</option>
      ))}
    </select>
  );
}

function ListaPapeis() {
  const qc = useQueryClient();
  const papeisQ = useQuery({ queryKey: ["papeis"], queryFn: () => listPapeis() });
  const salvar = useServerFn(savePapel);
  const remover = useServerFn(deletePapel);

  const [editando, setEditando] = useState<any | null>(null);

  const novo = () =>
    setEditando({ nome: "", slug: "", descricao: "", sistema: false, permissoes: {} });

  const onSalvar = async (p: any) => {
    await salvar({
      data: {
        id: p.id,
        nome: p.nome,
        slug: p.slug || p.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        descricao: p.descricao || null,
        permissoes: p.permissoes ?? {},
      },
    });
    qc.invalidateQueries({ queryKey: ["papeis"] });
    setEditando(null);
  };

  const onRemover = async (id: string) => {
    if (!confirm("Excluir este papel?")) return;
    await remover({ data: { id } });
    qc.invalidateQueries({ queryKey: ["papeis"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Papéis do sistema não podem ser excluídos; suas permissões ainda podem ser ajustadas.
        </p>
        <button onClick={novo} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Novo papel
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {(papeisQ.data ?? []).map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-base font-semibold text-foreground">{p.nome}</span>
                  {p.sistema && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">sistema</span>
                  )}
                </div>
                {p.descricao && <p className="mt-1 text-xs text-muted-foreground">{p.descricao}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {PERMISSOES.filter((pp) => (p.permissoes as any)?.[pp]).map((pp) => (
                    <span key={pp} className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase text-primary">{pp}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => setEditando({ ...p })}
                  className="rounded-md border border-border px-3 py-1.5 text-xs uppercase">
                  Editar
                </button>
                {!p.sistema && (
                  <button onClick={() => onRemover(p.id)} className="inline-flex items-center gap-1 text-xs text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <EditorPapel valor={editando} onCancelar={() => setEditando(null)} onSalvar={onSalvar} />
      )}
    </div>
  );
}

function EditorPapel({
  valor, onCancelar, onSalvar,
}: {
  valor: any;
  onCancelar: () => void;
  onSalvar: (v: any) => void;
}) {
  const [v, setV] = useState<any>(valor);
  const toggle = (p: Permissao) =>
    setV({ ...v, permissoes: { ...(v.permissoes ?? {}), [p]: !((v.permissoes ?? {})[p]) } });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6">
        <h2 className="h4l-title text-xl text-foreground">{v.id ? "Editar papel" : "Novo papel"}</h2>
        <div className="mt-4 space-y-3">
          <input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })}
            placeholder="Nome do papel" className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground" />
          <input value={v.slug ?? ""} onChange={(e) => setV({ ...v, slug: e.target.value })}
            placeholder="slug (sem espaços)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            disabled={!!v.sistema} />
          <textarea value={v.descricao ?? ""} onChange={(e) => setV({ ...v, descricao: e.target.value })}
            placeholder="Descrição (opcional)" rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground" />

          <div className="rounded-md border border-border p-3">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Permissões</div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {PERMISSOES.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!(v.permissoes ?? {})[p]} onChange={() => toggle(p)} />
                  <span className="font-mono text-xs">{p}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancelar} className="rounded-md border border-border px-3 py-2 text-sm">Cancelar</button>
          <button onClick={() => onSalvar(v)}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold uppercase text-primary-foreground">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
