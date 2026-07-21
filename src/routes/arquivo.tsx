import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { listPosts, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PostCard } from "@/components/site/PostCard";

const searchSchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

const q = (page: number) =>
  queryOptions({
    queryKey: ["arquivo", page],
    queryFn: () => listPosts({ data: { page, perPage: 12 } }),
    staleTime: 60_000,
  });
const cfg = () =>
  queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });

export const Route = createFileRoute("/arquivo")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(q(deps.page)),
      context.queryClient.ensureQueryData(cfg()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Arquivo — Hockey4Life" },
      { name: "description", content: "Todas as matérias publicadas no Hockey4Life." },
      { property: "og:title", content: "Arquivo — Hockey4Life" },
      { property: "og:url", content: "/arquivo" },
    ],
    links: [{ rel: "canonical", href: "/arquivo" }],
  }),
  component: ArquivoPage,
});

function ArquivoPage() {
  const { page } = Route.useSearch();
  const { data } = useSuspenseQuery(q(page));
  const { data: site } = useSuspenseQuery(cfg());

  return (
    <SiteLayout config={site.config} temasMenu={site.temasMenu as any}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="h4l-title text-4xl text-foreground md:text-6xl">Arquivo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.total} matéria(s) publicadas — página {page} de {data.totalPages}
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
        {data.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link to="/arquivo" search={{ page: page - 1 }} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary">
                ← Anterior
              </Link>
            )}
            <span className="text-sm text-muted-foreground">Página {page} de {data.totalPages}</span>
            {page < data.totalPages && (
              <Link to="/arquivo" search={{ page: page + 1 }} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary">
                Próxima →
              </Link>
            )}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
