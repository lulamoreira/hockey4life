import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAdminPosts, deletePost, getPostFixado, desafixarPost } from "@/lib/admin.functions";
import { formatDataBR } from "@/lib/slugify";
import { ExternalLink, Pin, PinOff, Plus, Trash2, Edit3, Clock, ArrowDown, ArrowUp } from "lucide-react";

export function PostsListPage() {
  const [status, setStatus] = useState<"todos" | "rascunho" | "publicado">("todos");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [ordem, setOrdem] = useState<"desc" | "asc">("desc");
  const [semChapeu, setSemChapeu] = useState(false);
  const del = useServerFn(deletePost);
  const unpin = useServerFn(desafixarPost);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-posts", status, q, page, ordem, semChapeu],
    queryFn: () => listAdminPosts({ data: { status, q, page, ordem, sem_chapeu: semChapeu } }),
  });
  const fixadoQ = useQuery({ queryKey: ["admin-fixado"], queryFn: () => getPostFixado() });


  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta matéria?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
    qc.invalidateQueries({ queryKey: ["admin-fixado"] });
  };

  const onUnpin = async (id: string) => {
    await unpin({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
    qc.invalidateQueries({ queryKey: ["admin-fixado"] });
  };

  const now = Date.now();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Matérias</h1>
          <p className="text-sm text-muted-foreground">Gerencie o conteúdo do portal.</p>
        </div>
        <Link
          to="/admin/posts/novo"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nova matéria
        </Link>
      </div>

      {fixadoQ.data && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Pin className="h-4 w-4 text-primary" />
            <span>
              <span className="font-semibold uppercase tracking-wide text-primary">Fixada na home:</span>{" "}
              {fixadoQ.data.status === "publicado" ? (
                <a href={`/${fixadoQ.data.slug}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                  {fixadoQ.data.titulo}
                </a>
              ) : (
                <span>{fixadoQ.data.titulo}</span>
              )}
            </span>
          </div>
          <button
            onClick={() => onUnpin(fixadoQ.data!.id)}
            className="inline-flex items-center gap-1 rounded border border-primary/40 bg-background px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <PinOff className="h-3.5 w-3.5" /> Soltar
          </button>
        </div>
      )}


      <div className="mt-6 flex flex-wrap gap-2">
        {(["todos","publicado","rascunho"] as const).map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={`rounded border px-3 py-1.5 text-xs uppercase tracking-wide ${status===s?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>
            {s === "todos" ? "Todos" : s}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setSemChapeu((v) => !v); setPage(1); }}
          className={`rounded border px-3 py-1.5 text-xs uppercase tracking-wide ${semChapeu?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}
          title="Mostrar só matérias sem chapéu"
        >
          Sem chapéu
        </button>
        <input
          value={q} onChange={(e)=>{setQ(e.target.value); setPage(1);}}
          placeholder="Buscar título…"
          className="ml-auto rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Título</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={() => { setOrdem((o) => (o === "desc" ? "asc" : "desc")); setPage(1); }}
                  aria-label={`Ordenar por publicação — atualmente ${ordem === "desc" ? "mais recentes primeiro" : "mais antigas primeiro"}`}
                  className="inline-flex items-center gap-1 uppercase tracking-wider text-primary hover:underline"
                >
                  Publicação
                  {ordem === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                </button>
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
            {data?.items.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  {(p as any).chapeu && (
                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      {(p as any).chapeu}
                    </div>
                  )}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{p.titulo}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        sem página pública ainda
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">/{p.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${p.status==='publicado'?'bg-primary/20 text-primary':'bg-muted text-muted-foreground'}`}>
                    {p.status}
                  </span>
                  {p.status === "publicado" && p.publicado_em && new Date(p.publicado_em).getTime() > now && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                      <Clock className="h-3 w-3" /> Agendada
                    </span>
                  )}
                  {p.destaque && <span className="ml-1 inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground"><Pin className="h-3 w-3" /> Fixada</span>}
                  {p.nao_perca && <span className="ml-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">Não perca</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDataBR(p.publicado_em)}</td>
                <td className="px-4 py-3 text-right">
                  <Link to="/admin/posts/$id" params={{ id: p.id }} className="mr-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Edit3 className="h-3.5 w-3.5"/> Editar
                  </Link>
                  <button onClick={()=>onDelete(p.id)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
                    <Trash2 className="h-3.5 w-3.5"/> Excluir
                  </button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && !isLoading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhuma matéria.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40">← Anterior</button>
          <span className="text-sm text-muted-foreground">Página {page} de {data.totalPages}</span>
          <button disabled={page>=data.totalPages} onClick={()=>setPage(p=>p+1)} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40">Próxima →</button>
        </div>
      )}
    </div>
  );
}