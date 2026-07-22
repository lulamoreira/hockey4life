import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getPostsByTema, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PostCard } from "@/components/site/PostCard";

const searchSchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

const q = (slug: string, page: number) =>
  queryOptions({
    queryKey: ["tema", "time", slug, page],
    queryFn: () => getPostsByTema({ data: { slug, tipo: "time", page } }),
    staleTime: 60_000,
  });
const cfg = () =>
  queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });

export const Route = createFileRoute("/time/$slug")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, params, deps }) => {
    const [data] = await Promise.all([
      context.queryClient.ensureQueryData(q(params.slug, deps.page)),
      context.queryClient.ensureQueryData(cfg()),
    ]);
    if (!data.tema) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: `${loaderData?.tema?.nome ?? "Time"} — Hockey4Life` },
      { name: "description", content: `Matérias do time ${loaderData?.tema?.nome ?? params.slug} no Hockey4Life.` },
      { property: "og:title", content: `${loaderData?.tema?.nome ?? "Time"} — Hockey4Life` },
      { property: "og:url", content: `/time/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `/time/${params.slug}` }],
  }),
  component: TemaTimePage,
});

function TemaTimePage() {
  const { slug } = Route.useParams();
  const { page } = Route.useSearch();
  const { data } = useSuspenseQuery(q(slug, page));
  const { data: site } = useSuspenseQuery(cfg());

  return (
    <SiteLayout config={site.config}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="text-xs font-bold uppercase tracking-widest text-primary">TIME</div>
        <h1 className="mt-1 h4l-title text-4xl text-foreground md:text-6xl">{data.tema?.nome}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data.total} matéria(s){data.ultimaData ? ` · última em ${new Date(data.ultimaData).toLocaleDateString("pt-BR")}` : ""}</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
        {data.items.length === 0 && <p className="mt-8 text-muted-foreground">Nenhuma matéria ainda.</p>}
        <Paginacao totalPages={data.totalPages} page={page} slug={slug} tipo="time" />
      </div>
    </SiteLayout>
  );
}

function Paginacao({ totalPages, page, slug, tipo }: { totalPages: number; page: number; slug: string; tipo: "time" | "assunto" }) {
  if (totalPages <= 1) return null;
  const to = tipo === "time" ? "/time/$slug" : "/assunto/$slug";
  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link to={to} params={{ slug }} search={{ page: page - 1 }} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary">
          ← Anterior
        </Link>
      )}
      <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
      {page < totalPages && (
        <Link to={to} params={{ slug }} search={{ page: page + 1 }} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary">
          Próxima →
        </Link>
      )}
    </div>
  );
}
