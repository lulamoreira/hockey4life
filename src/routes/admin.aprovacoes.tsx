import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { filaAprovacoes, aprovarPost, rejeitarPost } from "@/lib/equipe.functions";
import { CheckSquare, Check, X, Edit3 } from "lucide-react";
import { formatDataBR } from "@/lib/slugify";

export const Route = createFileRoute("/admin/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovações — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AprovacoesPage,
});

function AprovacoesPage() {
  const qc = useQueryClient();
  const filaQ = useQuery({ queryKey: ["fila-aprovacoes"], queryFn: () => filaAprovacoes() });
  const aprovar = useServerFn(aprovarPost);
  const rejeitar = useServerFn(rejeitarPost);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fila-aprovacoes"] });
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
  };

  const onAprovar = async (id: string) => {
    if (!confirm("Aprovar e publicar esta matéria agora?")) return;
    await aprovar({ data: { id } });
    invalidate();
  };

  const onRejeitar = async (id: string) => {
    const m = prompt("Motivo da rejeição (obrigatório):");
    if (!m || m.trim().length < 3) return;
    await rejeitar({ data: { id, motivo: m.trim() } });
    invalidate();
  };

  const itens = filaQ.data ?? [];

  return (
    <div>
      <div className="flex items-center gap-3">
        <CheckSquare className="h-6 w-6 text-primary" />
        <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Aguardando revisão</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Fila de matérias enviadas por escritores. Você pode editar antes de aprovar.
      </p>

      {filaQ.isLoading && <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>}
      {!filaQ.isLoading && itens.length === 0 && (
        <div className="mt-8 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma matéria aguardando revisão.
        </div>
      )}

      <div className="mt-6 space-y-3">
        {itens.map((p: any) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase text-muted-foreground">
                  {p.autores?.nome ?? "—"} · enviado em {formatDataBR(p.enviado_revisao_em)}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{p.titulo}</h2>
                {p.resumo && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.resumo}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/admin/posts/$id" params={{ id: p.id }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs uppercase">
                  <Edit3 className="h-3.5 w-3.5" /> Abrir
                </Link>
                <button onClick={() => onAprovar(p.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold uppercase text-primary-foreground">
                  <Check className="h-3.5 w-3.5" /> Aprovar
                </button>
                <button onClick={() => onRejeitar(p.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold uppercase text-destructive">
                  <X className="h-3.5 w-3.5" /> Rejeitar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
