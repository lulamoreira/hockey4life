import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPostBySlug, getSiteConfig, getRecentesFallback } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PostCard, PostCardSmall } from "@/components/site/PostCard";
import { ShareButtons } from "@/components/site/Share";
import { formatDataBR, tempoLeitura } from "@/lib/slugify";
import { isReservedSlug } from "@/lib/reserved-slugs";
import DOMPurify from "isomorphic-dompurify";
import { Search } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ReadingProgress } from "@/components/site/ReadingProgress";
import { ContinueLendo } from "@/components/site/ContinueLendo";

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
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Matéria não encontrada — Hockey4Life" }, { name: "robots", content: "noindex" }] };
    }
    const { post, autor } = loaderData;
    const desc = post.resumo ?? `${post.titulo} — Hockey4Life`;
    const url = `https://hockey4life.com.br/${post.slug}`;
    const meta: Array<Record<string, string>> = [
      { title: `${post.titulo} — Hockey4Life` },
      { name: "description", content: desc.slice(0, 160) },
      { property: "og:title", content: post.titulo },
      { property: "og:description", content: desc.slice(0, 200) },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:title", content: post.titulo },
      { name: "twitter:description", content: desc.slice(0, 200) },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (post.imagem_capa) {
      meta.push({ property: "og:image", content: post.imagem_capa });
      meta.push({ name: "twitter:image", content: post.imagem_capa });
    }

    // JSON-LD NewsArticle
    const jsonLd: any = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: post.titulo,
      description: desc.slice(0, 200),
      datePublished: post.publicado_em,
      dateModified: post.atualizado_em || post.publicado_em,
      mainEntityOfPage: url,
      url,
    };
    if (post.imagem_capa) jsonLd.image = [post.imagem_capa];
    if (autor) {
      jsonLd.author = {
        "@type": "Person",
        name: autor.nome,
        url: `https://hockey4life.com.br/autor/${autor.slug}`,
      };
    }
    jsonLd.publisher = {
      "@type": "Organization",
      name: "Hockey4Life",
      url: "https://hockey4life.com.br",
    };

    // Breadcrumbs JSON-LD
    const breadcrumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: "https://hockey4life.com.br/" },
        { "@type": "ListItem", position: 2, name: post.titulo, item: url },
      ],
    };

    return {
      meta,
      links: [{ rel: "canonical", href: `/${params.slug}` }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbs) },
      ],
    };
  },
  component: PostPage,
});

function PostPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(slug));
  const { data: siteData } = useSuspenseQuery(configQuery());
  const articleBodyRef = useRef<HTMLDivElement | null>(null);
  if (!data) return null;
  const { post, autor, recentes, relacionados, anterior, proximo } = data;
  const dataObj = post.publicado_em ? new Date(post.publicado_em) : null;
  const ano = dataObj?.getFullYear();
  const mes = dataObj ? dataObj.getMonth() + 1 : null;
  const url = typeof window !== "undefined" ? window.location.href : `https://hockey4life.com.br/${post.slug}`;
  const videoUrl: string | undefined = siteData.config?.hockey_fights_cancer?.video_url;
  const minutosLeitura = tempoLeitura(post.conteudo);

  return (
    <SiteLayout config={siteData.config}>
      <ReadingProgress targetRef={articleBodyRef} />
      <div className="mx-auto my-6 max-w-7xl rounded-lg bg-white/80 px-3 py-6 backdrop-blur-sm dark:bg-black/50 md:my-10 md:px-6 md:py-10">
        {/* Breadcrumbs visíveis */}
        <nav aria-label="Trilha" className="mb-4 text-[11px] uppercase tracking-widest text-muted-foreground">
          <Link to="/" className="hover:text-primary">Início</Link>
        </nav>


        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Coluna principal */}
          <article className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
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

            <h1 className="h4l-title text-3xl leading-tight text-foreground md:text-5xl">{post.titulo}</h1>

            {/* Linha do autor */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3 text-sm text-muted-foreground">
              {autor && (
                <Link to="/autor/$slug" params={{ slug: autor.slug }} className="flex items-center gap-2 hover:text-primary">
                  {autor.foto_url ? (
                    <img src={autor.foto_url} alt={autor.nome} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                      {autor.nome.charAt(0)}
                    </span>
                  )}
                  <span className="font-semibold text-foreground">{autor.nome}</span>
                </Link>
              )}
              <span>{formatDataBR(post.publicado_em)}</span>
              <span>{tempoLeitura(post.conteudo)} min de leitura</span>
              {ano && mes && (
                <Link to="/arquivo/$ano/$mes" params={{ ano: String(ano), mes: String(mes).padStart(2, "0") }} className="text-primary hover:underline">
                  ver mês
                </Link>
              )}
              <div className="ml-auto">
                <ShareButtons
                  url={url}
                  titulo={post.titulo}
                  resumo={post.resumo}
                  chapeu={post.chapeu}
                  imagemCapa={post.imagem_capa}
                />
              </div>
            </div>

            {post.imagem_capa && (
              <figure className="mt-6">
                <img src={post.imagem_capa} alt={post.titulo} className="w-full rounded-lg" />
                {post.credito_imagem && (
                  <figcaption className="mt-2 text-xs italic text-muted-foreground">
                    Foto: {post.credito_imagem}
                  </figcaption>
                )}
              </figure>
            )}

            {post.resumo && (
              <p className="mt-6 border-l-2 border-primary pl-4 text-lg font-medium text-foreground/90">
                {post.resumo}
              </p>
            )}

            {post.conteudo && (
              <div
                className="prose-h4l mt-6"
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
              <ShareButtons
                url={url}
                titulo={post.titulo}
                resumo={post.resumo}
                chapeu={post.chapeu}
                imagemCapa={post.imagem_capa}
              />
            </div>

            {autor && (
              <aside className="mt-10 rounded-lg border border-primary/40 bg-card/60 p-5 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  {autor.foto_url ? (
                    <img src={autor.foto_url} alt={autor.nome} className="h-16 w-16 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary/20 text-xl font-bold text-primary">
                      {autor.nome.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <Link to="/autor/$slug" params={{ slug: autor.slug }} className="block text-lg font-bold text-foreground hover:text-primary">
                      {autor.nome}
                    </Link>
                    {(autor.bio_media || autor.bio_curta || autor.bio) && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {autor.bio_media ?? autor.bio_curta ?? autor.bio}
                      </p>
                    )}
                    <Link
                      to="/autor/$slug"
                      params={{ slug: autor.slug }}
                      className="mt-3 inline-block text-xs font-bold uppercase tracking-wider text-primary hover:underline"
                    >
                      Todas as matérias de {autor.nome} →
                    </Link>
                  </div>
                </div>
              </aside>
            )}

            {(anterior || proximo) && (
              <nav className="mt-8 grid gap-3 sm:grid-cols-2">
                {anterior ? (
                  <Link to="/$slug" params={{ slug: anterior.slug }} className="group rounded-lg border border-border p-4 hover:border-primary">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">← Anterior</div>
                    <div className="mt-1 line-clamp-2 font-semibold group-hover:text-primary">{anterior.titulo}</div>
                  </Link>
                ) : <div />}
                {proximo ? (
                  <Link to="/$slug" params={{ slug: proximo.slug }} className="group rounded-lg border border-border p-4 text-right hover:border-primary">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Próxima →</div>
                    <div className="mt-1 line-clamp-2 font-semibold group-hover:text-primary">{proximo.titulo}</div>
                  </Link>
                ) : <div />}
              </nav>
            )}

            {relacionados.length > 0 && (
              <section className="mt-12">
                <div className="overflow-hidden rounded-lg border border-border bg-card/60">
                  <div className="bg-black/70 py-2 text-center">
                    <span className="font-list-cond text-[14px] font-bold uppercase tracking-wider text-primary">
                      Leia também
                    </span>
                  </div>
                  <div>
                    {relacionados.map((p) => (
                      <PostCardSmall key={p.id} post={p} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </article>

          {/* Sidebar */}
          <aside className="hidden space-y-6 lg:block lg:sticky lg:top-6 lg:self-start">
            {autor && (
              <div className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm">
                <div className="h4l-title mb-3 text-sm text-primary">Sobre o autor</div>
                <div className="flex items-start gap-3">
                  {autor.foto_url ? (
                    <img src={autor.foto_url} alt={autor.nome} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/20 text-lg font-bold text-primary">
                      {autor.nome.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <Link to="/autor/$slug" params={{ slug: autor.slug }} className="block font-bold text-foreground hover:text-primary">
                      {autor.nome}
                    </Link>
                    {(autor.bio_curta || autor.bio) && <p className="mt-1 text-xs text-muted-foreground line-clamp-4">{autor.bio_curta ?? autor.bio}</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm">
              <div className="h4l-title mb-3 text-sm text-primary">Pesquise</div>
              <SidebarSearch />
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card/60 backdrop-blur-sm">
              <div className="bg-black/70 py-2 text-center">
                <span className="font-list-cond text-[14px] font-bold uppercase tracking-wider text-primary">
                  Matérias recentes
                </span>
              </div>
              <div>
                {recentes.map((r) => (
                  <PostCardSmall key={r.id} post={r as any} />
                ))}
              </div>
            </div>


            {videoUrl && (
              <div className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm">
                <div className="h4l-title mb-3 text-sm text-primary">Vídeo destaque</div>
                <div className="aspect-video overflow-hidden rounded">
                  <iframe
                    src={toEmbedUrl(videoUrl)}
                    title="Vídeo destaque"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}

function SidebarSearch() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        navigate({ to: "/busca", search: { q: q.trim() } as any });
      }}
      className="flex items-center gap-2"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar…"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
      />
      <button type="submit" className="rounded-md bg-primary p-2 text-primary-foreground hover:opacity-90">
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}

function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.replace(/\//g, "");
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { /* noop */ }
  return url;
}
