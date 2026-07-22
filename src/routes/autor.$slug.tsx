import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getAutorPublico, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PostCard } from "@/components/site/PostCard";
import { z } from "zod";

const autorQuery = (slug: string, page: number) =>
  queryOptions({
    queryKey: ["autor", slug, page],
    queryFn: () => getAutorPublico({ data: { slug, page } }),
    staleTime: 60_000,
  });
const configQuery = () =>
  queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });

const searchSchema = z.object({ page: z.number().int().min(1).default(1) });

export const Route = createFileRoute("/autor/$slug")({
  validateSearch: (s) => searchSchema.parse(s),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, params, deps }) => {
    const result = await context.queryClient.ensureQueryData(autorQuery(params.slug, deps.page));
    if (!result) throw notFound();
    await context.queryClient.ensureQueryData(configQuery());
    return result;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Autor não encontrado — Hockey4Life" }, { name: "robots", content: "noindex" }] };
    const { autor } = loaderData;
    const desc = autor.bio ?? `Matérias de ${autor.nome} no Hockey4Life.`;
    const url = `https://hockey4life.com.br/autor/${params.slug}`;
    const meta: Array<Record<string, string>> = [
      { title: `${autor.nome} — Hockey4Life` },
      { name: "description", content: desc.slice(0, 160) },
      { property: "og:title", content: autor.nome },
      { property: "og:description", content: desc.slice(0, 200) },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ];
    if (autor.foto_url) {
      meta.push({ property: "og:image", content: autor.foto_url });
      meta.push({ name: "twitter:image", content: autor.foto_url });
    }
    return { meta, links: [{ rel: "canonical", href: `/autor/${params.slug}` }] };
  },
  component: AutorPage,
});

function AutorPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const page = search.page ?? 1;
  const { data } = useSuspenseQuery(autorQuery(slug, page));
  const { data: siteData } = useSuspenseQuery(configQuery());
  if (!data) return null;
  const { autor, items, totalPages } = data;

  return (
    <SiteLayout config={siteData.config}>
      <div className="mx-auto my-8 max-w-6xl rounded-lg bg-black/50 px-4 py-8 backdrop-blur-sm md:my-10 md:px-8 md:py-10">
        <header className="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          {autor.foto_url ? (
            <img src={autor.foto_url} alt={autor.nome} className="h-24 w-24 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-primary/20 text-3xl font-bold text-primary">
              {autor.nome.charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="h4l-title text-3xl text-foreground md:text-5xl">{autor.nome}</h1>
            {autor.bio && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{autor.bio}</p>}
          </div>
        </header>

        {items.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhuma matéria publicada ainda.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2 text-sm">
            {page > 1 && (
              <Link to="/autor/$slug" params={{ slug }} search={{ page: page - 1 }} className="rounded border border-border px-3 py-1 hover:border-primary">
                ← Anterior
              </Link>
            )}
            <span className="text-muted-foreground">Página {page} de {totalPages}</span>
            {page < totalPages && (
              <Link to="/autor/$slug" params={{ slug }} search={{ page: page + 1 }} className="rounded border border-border px-3 py-1 hover:border-primary">
                Próxima →
              </Link>
            )}
          </nav>
        )}
      </div>
    </SiteLayout>
  );
}
