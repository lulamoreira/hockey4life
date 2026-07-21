import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dashboardStats, getPostFixado, desafixarPost } from "@/lib/admin.functions";
import { FileText, Tag, Mail, PenSquare, Pin, PinOff } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => dashboardStats() });
  const fixadoQ = useQuery({ queryKey: ["admin-fixado"], queryFn: () => getPostFixado() });
  const unpin = useServerFn(desafixarPost);
  const qc = useQueryClient();

  const onUnpin = async () => {
    if (!fixadoQ.data) return;
    await unpin({ data: { id: fixadoQ.data.id } });
    qc.invalidateQueries({ queryKey: ["admin-fixado"] });
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
  };

  return (
    <div>
      <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Visão geral do Hockey4Life.</p>

      {fixadoQ.data && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Pin className="h-4 w-4 text-primary" />
            <span>
              <span className="font-semibold uppercase tracking-wide text-primary">Matéria fixada na home:</span>{" "}
              {fixadoQ.data.status === "publicado" ? (
                <a href={`/${fixadoQ.data.slug}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                  {fixadoQ.data.titulo}
                </a>
              ) : (
                <span>{fixadoQ.data.titulo}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/posts/$id" params={{ id: fixadoQ.data.id }} className="rounded border border-border bg-background px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-foreground hover:border-primary hover:text-primary">
              Editar
            </Link>
            <button
              onClick={onUnpin}
              className="inline-flex items-center gap-1 rounded border border-primary/40 bg-background px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <PinOff className="h-3.5 w-3.5" /> Soltar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Carregando…</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Publicadas" value={data?.publicados ?? 0} icon={FileText} />
          <Stat label="Rascunhos" value={data?.rascunhos ?? 0} icon={PenSquare} />
          <Stat label="Temas" value={data?.temas ?? 0} icon={Tag} />
          <Stat label="Contatos não lidos" value={data?.contatosNaoLidos ?? 0} icon={Mail} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 h4l-title text-4xl text-foreground">{value}</div>
    </div>
  );
}
