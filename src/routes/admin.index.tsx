import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { dashboardStats } from "@/lib/admin.functions";
import { FileText, Tag, Mail, PenSquare } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => dashboardStats() });
  return (
    <div>
      <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Visão geral do Hockey4Life.</p>
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
