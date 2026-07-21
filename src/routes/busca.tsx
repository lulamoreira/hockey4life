import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { searchPosts, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PostCard } from "@/components/site/PostCard";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
});

const cfg = () =>
  queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });

export const Route = createFileRoute("/busca")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(cfg()),
  head: () => ({
    meta: [
      { title: "Buscar — Hockey4Life" },
      { name: "description", content: "Busque matérias no portal Hockey4Life." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "/busca" },
    ],
    links: [{ rel: "canonical", href: "/busca" }],
  }),
  component: BuscaPage,
});

function BuscaPage() {
  const { q, page } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q ?? "");
  const { data: site } = useSuspenseQuery(cfg());

  const result = useQuery({
    queryKey: ["busca", q, page],
    queryFn: () => searchPosts({ data: { q, page } }),
    enabled: !!q && q.length > 0,
    staleTime: 30_000,
  });

  return (
    <SiteLayout config={site.config} temasMenu={site.temasMenu as any}>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="h4l-title text-4xl text-foreground md:text-5xl">Buscar</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/busca", search: { q: term.trim(), page: 1 } });
          }}
          className="mt-6 flex gap-2"
        >
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="O que você procura?"
            className="flex-1 rounded-md border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button className="rounded-md bg-primary px-5 py-3 font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90">
            Buscar
          </button>
        </form>

        {q && result.isLoading && <p className="mt-8 text-muted-foreground">Buscando…</p>}
        {q && result.data && (
          <>
            <p className="mt-8 text-sm text-muted-foreground">
              {result.data.total} resultado(s) para “{q}”
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {result.data.items.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
            {result.data.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link to="/busca" search={{ q, page: page - 1 }} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary">
                    ← Anterior
                  </Link>
                )}
                <span className="text-sm text-muted-foreground">Página {page} de {result.data.totalPages}</span>
                {page < result.data.totalPages && (
                  <Link to="/busca" search={{ q, page: page + 1 }} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary">
                    Próxima →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SiteLayout>
  );
}
