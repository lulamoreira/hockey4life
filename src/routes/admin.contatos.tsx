import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContatos, marcarContatoLido } from "@/lib/admin.functions";
import { formatDataBR } from "@/lib/slugify";

export const Route = createFileRoute("/admin/contatos")({
  component: ContatosPage,
});

function ContatosPage() {
  const qc = useQueryClient();
  const marcar = useServerFn(marcarContatoLido);
  const { data, isLoading } = useQuery({ queryKey: ["admin-contatos"], queryFn: () => listContatos() });

  const toggle = async (id: string, lido: boolean) => {
    await marcar({ data: { id, lido } });
    qc.invalidateQueries({ queryKey: ["admin-contatos"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  return (
    <div>
      <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Contatos</h1>
      <p className="text-sm text-muted-foreground">Mensagens enviadas pelo formulário Fale Conosco.</p>

      {isLoading && <p className="mt-6 text-muted-foreground">Carregando…</p>}
      <div className="mt-6 space-y-3">
        {(data ?? []).map((c: any) => (
          <div key={c.id} className={`rounded-lg border p-4 ${c.lido ? "border-border bg-card/40" : "border-primary/40 bg-card"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-foreground">{c.nome} <span className="text-muted-foreground">&lt;{c.email}&gt;</span></div>
                {c.assunto && <div className="text-sm text-primary">{c.assunto}</div>}
                <div className="text-xs text-muted-foreground">{formatDataBR(c.criado_em)}</div>
              </div>
              <button onClick={()=>toggle(c.id, !c.lido)} className="text-xs uppercase tracking-wide text-muted-foreground hover:text-primary">
                {c.lido ? "Marcar como não lido" : "Marcar como lido"}
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{c.mensagem}</p>
          </div>
        ))}
        {data && data.length === 0 && <p className="text-muted-foreground">Nenhuma mensagem.</p>}
      </div>
    </div>
  );
}
