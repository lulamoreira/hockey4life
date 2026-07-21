import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPostBySlug, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PostCard } from "@/components/site/PostCard";
import { ShareButtons } from "@/components/site/Share";
import { formatDataBR, tempoLeitura } from "@/lib/slugify";
import { isReservedSlug } from "@/lib/reserved-slugs";
import DOMPurify from "isomorphic-dompurify";

const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["post", slug],
    queryFn: () => getPostBySlug({ data: { slug } }),
    staleTime: 60_000,
  });

const configQuery = () =>
  queryOptions({
    queryKey: ["site-config"],
    queryFn: () => getSiteConfig(),
    staleTime: 120_000,
  });

export const Route = createFileRoute("/$slug")({
  beforeLoad: ({ params }) => {
    if (isReservedSlug(params.slug)) throw notFound();
  },
  loader: async ({ context, params }) => {
    const result = await context.queryClient.ensureQueryData(postQuery(params.slug));
    if (!result) throw notFound();
    await context.queryClient.ensureQueryData(configQuery());
    return result;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Matéria não encontrada — Hockey4Life" }, { name: "robots", content: "noindex" }] };
    }
    const { post } = loaderData;
    const desc = post.resumo ?? `${post.titulo} — Hockey4Life`;
    const url = `/${post.slug}`;
    const meta: Array<Record<string, string>> = [
      { title: `${post.titulo} — Hockey4Life` },
      { name: "description", content: desc.slice(0, 160) },
      { property: "og:title", content: post.titulo },
      { property: "og:description", content: desc.slice(0, 200) },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:title", content: post.titulo },
      { name: "twitter:description", content: desc.slice(0, 200) },
    ];
    if (post.imagem_capa) {
      meta.push({ property: "og:image", content: post.imagem_capa });
      meta.push({ name: "twitter:image", content: post.imagem_capa });
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  component: PostPage,
});

function PostPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(slug));
  const { data: siteData } = useSuspenseQuery(configQuery());
  if (!data) return null;
  const { post, relacionados } = data;
  const url = typeof window !== "undefined" ? window.location.href : `https://hockey4life.com.br/${post.slug}`;

  return (
    <SiteLayout config={siteData.config} temasMenu={siteData.temasMenu as any}>
      <article className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-4 flex flex-wrap gap-2">
          {post.temas.map((t) => (
            <Link
              key={t.slug}
              to={t.tipo === "time" ? "/time/$slug" : "/assunto/$slug"}
              params={{ slug: t.slug }}
              className="rounded bg-primary/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-primary/25"
            >
              {t.nome}
            </Link>
          ))}
        </div>
        <h1 className="h4l-title text-4xl leading-tight text-foreground md:text-6xl">{post.titulo}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{formatDataBR(post.publicado_em)}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
          <span>{tempoLeitura(post.conteudo)} min de leitura</span>
        </div>

        {post.imagem_capa && (
          <figure className="mt-8">
            <img src={post.imagem_capa} alt={post.titulo} className="w-full rounded-lg" />
            {post.credito_imagem && (
              <figcaption className="mt-2 text-xs italic text-muted-foreground">
                Foto: {post.credito_imagem}
              </figcaption>
            )}
          </figure>
        )}

        {post.resumo && (
          <p className="mt-8 border-l-2 border-primary pl-4 text-lg font-medium text-foreground/90">
            {post.resumo}
          </p>
        )}

        {post.conteudo && (
          <div
            className="prose-h4l mt-8"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(post.conteudo, {
                ADD_TAGS: ["iframe"],
                ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target"],
              }),
            }}
          />
        )}

        <div className="mt-10 border-t border-border pt-6">
          <ShareButtons url={url} titulo={post.titulo} />
        </div>
      </article>

      {relacionados.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <h2 className="h4l-title mb-6 border-b border-border pb-2 text-2xl text-foreground md:text-3xl">
            Leia também
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relacionados.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </SiteLayout>
  );
}
