import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X, Trash2, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDataBR } from "@/lib/slugify";

export const Route = createFileRoute("/admin/comentarios")({
  head: () => ({ meta: [{ title: "Comentários — Admin Hockey4Life" }, { name: "robots", content: "noindex" }] }),
  component: ComentariosAdmin,
});

type Status = "pendente" | "aprovado" | "rejeitado";
const ABAS: Array<{ id: Status; label: string }> = [
  { id: "pendente", label: "Pendentes" }, { id: "aprovado", label: "Aprovados" }, { id: "rejeitado", label: "Rejeitados" },
];

function ComentariosAdmin() {
  const qc = useQueryClient();
  const [aba, setAba] = useState<Status>("pendente");
  const [msg, setMsg] = useState("");
  const q = useQuery({
    queryKey: ["admin-comentarios", aba],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comentarios")
        .select("id, nome, texto, criado_em, user_id, status, post_id, posts(titulo, slug)")
        .eq("status", aba).order("criado_em", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const atualizar = () => { qc.invalidateQueries({ queryKey: ["admin-comentarios"] }); qc.invalidateQueries({ queryKey: ["comentarios"] }); };
  const mudar = async (id: string, status: Status) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("comentarios").update({ status, moderado_em: new Date().toISOString(), moderado_por: u.user?.id ?? null }).eq("id", id);
    setMsg(error ? "Erro: " + error.message : status === "aprovado" ? "Comentário aprovado." : "Comentário rejeitado.");
    atualizar();
  };
  const apagar = async (id: string) => {
    if (!confirm("Apagar este comentário para sempre?")) return;
    const { error } = await supabase.from("comentarios").delete().eq("id", id);
    setMsg(error ? "Erro: " + error.message : "Comentário apagado.");
    atualizar();
  };

  const btn = "inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-xs font-bold uppercase tracking-wider";
  return (
    <div className="p-4 md:p-8">
      <h1 className="font-display text-3xl uppercase">Comentários</h1>
      <p className="mt-1 text-sm text-muted-foreground">Nada aparece nas matérias antes de você aprovar.</p>
      <div role="tablist" className="mt-4 flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={`${btn} border ${aba === a.id ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground"}`}>{a.label}</button>
        ))}
      </div>
      {msg && <p role="status" className="mt-3 text-sm text-foreground">{msg}</p>}
      {q.isLoading ? <div className="mt-6 h-24 animate-pulse rounded-md bg-muted" />
        : q.error ? <p className="mt-6 text-sm text-destructive">Não foi possível carregar.</p>
        : (q.data?.length ?? 0) === 0 ? <p className="mt-6 text-sm text-muted-foreground">Nenhum comentário aqui.</p>
        : (
        <ul className="mt-6 space-y-3">
          {q.data!.map((c) => {
            const post = c.posts as { titulo: string; slug: string } | null;
            return (
              <li key={c.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold">{c.nome}</span>
                  {c.user_id ? <span className="inline-flex items-center gap-1 text-xs text-primary"><UserCheck className="h-3.5 w-3.5" /> cadastrado</span>
                    : <span className="text-xs text-muted-foreground">anônimo</span>}
                  <span className="text-xs text-muted-foreground">· {formatDataBR(c.criado_em)}</span>
                </div>
                {post && <Link to="/$slug" params={{ slug: post.slug }} target="_blank" className="mt-1 block text-xs text-primary hover:underline">em: {post.titulo}</Link>}
                <p className="mt-2 whitespace-pre-line text-sm">{c.texto}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.status !== "aprovado" && <button onClick={() => mudar(c.id, "aprovado")} className={`${btn} bg-primary text-primary-foreground`}><Check className="h-4 w-4" /> Aprovar</button>}
                  {c.status !== "rejeitado" && <button onClick={() => mudar(c.id, "rejeitado")} className={`${btn} border border-border`}><X className="h-4 w-4" /> Rejeitar</button>}
                  <button onClick={() => apagar(c.id)} className={`${btn} border border-destructive/50 text-destructive`}><Trash2 className="h-4 w-4" /> Apagar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
