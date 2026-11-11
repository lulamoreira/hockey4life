import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, Loader2, Image } from "lucide-react";
import { listAdminPosts } from "@/lib/admin.functions";
import { getMyPermissions } from "@/lib/equipe.functions";
import { SocialArticlePreview } from "@/components/admin/SocialArticlePreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDataBR } from "@/lib/slugify";

export const Route = createFileRoute("/admin/postagens")({
  head: () => ({ meta: [
    { title: "Postagens prontas — Admin Hockey4Life" },
    { name: "description", content: "Prepare imagens e legendas das matérias do Hockey4Life para Instagram e X em um único painel editorial." },
    { property: "og:title", content: "Postagens prontas — Hockey4Life" },
    { property: "og:description", content: "Painel editorial de postagens para Instagram e X." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: PostagensGate,
  errorComponent: () => <p role="alert" className="text-destructive">Não foi possível abrir as postagens. Recarregue a página para tentar novamente.</p>,
});

function PostagensGate() {
  const read = useServerFn(getMyPermissions);
  const permissions = useQuery({ queryKey: ["my-perms"], queryFn: () => read() });
  if (permissions.isPending) return <p role="status">Carregando…</p>;
  if (permissions.isError || !permissions.data.perms.escrever) return <p role="alert">Sua conta não tem permissão para preparar postagens.</p>;
  return <Postagens />;
}

function Postagens() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const read = useServerFn(listAdminPosts);
  const list = useQuery({
    queryKey: ["social-posts", q, page],
    queryFn: () => read({ data: { status: "publicado", q, page, ordem: "desc", sem_chapeu: false } }),
    staleTime: 30000,
  });
  return <div className="space-y-6">
    <h1 className="font-display text-3xl uppercase text-foreground md:text-4xl">Postagens prontas</h1>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section aria-label="Selecionar matéria" className="min-w-0 space-y-3">
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setQ(search.trim()); setPage(1); }}>
          <input aria-label="Buscar matéria" placeholder="Buscar matéria…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
          <Button type="submit" variant="outline" size="icon" aria-label="Buscar" title="Buscar"><Search /></Button>
        </form>
        {list.isPending && <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando matérias…</p>}
        {list.isError && <div role="alert"><p className="text-destructive">Não foi possível carregar as matérias.</p><Button variant="outline" onClick={() => list.refetch()}>Tentar novamente</Button></div>}
        {list.data?.items.length === 0 && <p role="status" className="py-6 text-muted-foreground">Nenhuma matéria encontrada.</p>}
        <div className="max-h-[60dvh] divide-y divide-border overflow-y-auto">
          {list.data?.items.map((post) => <Button key={post.id} variant="ghost" aria-pressed={selected === post.id} onClick={() => setSelected(post.id)} className={cn("h-auto w-full justify-start whitespace-normal rounded-none px-3 py-3 text-left", selected === post.id && "bg-primary/10 text-primary")}>
            <span className="min-w-0"><span className="block break-words text-sm font-medium">{post.titulo}</span><span className="mt-1 block text-xs text-muted-foreground">{formatDataBR(post.publicado_em)}</span></span>
          </Button>)}
        </div>
        {list.data && list.data.totalPages > 1 && <nav aria-label="Páginas de matérias" className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" aria-label="Página anterior" title="Página anterior" disabled={page === 1 || list.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
          <span className="text-xs text-muted-foreground">{page} / {list.data.totalPages}</span>
          <Button variant="outline" size="icon" aria-label="Próxima página" title="Próxima página" disabled={page >= list.data.totalPages || list.isFetching} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
        </nav>}
      </section>
      <div className="min-w-0 border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        {selected ? <SocialArticlePreview key={selected} id={selected} /> : <div className="grid min-h-64 place-content-center gap-3 text-center text-muted-foreground"><Image className="mx-auto size-10" /><p>Selecione uma matéria</p></div>}
      </div>
    </div>
  </div>;
}