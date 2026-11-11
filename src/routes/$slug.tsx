import { origemDe } from "@/lib/origem";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPostBySlug, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PostCardSmall } from "@/components/site/PostCard";
import { ShareButtons } from "@/components/site/Share";
import { formatDataBR, tempoLeitura } from "@/lib/slugify";
import { isReservedSlug } from "@/lib/reserved-slugs";
import DOMPurify from "isomorphic-dompurify";
import { EmbedsSociais } from "@/components/site/EmbedsSociais";
import { useRef } from "react";
import { ReadingProgress } from "@/components/site/ReadingProgress";
import { ContinueLendo } from "@/components/site/ContinueLendo";
import { SeguirInstagram } from "@/components/site/SeguirInstagram";
import { EditarMateriaLink } from "@/components/site/EditarMateriaLink";
import { OuvirMateria } from "@/components/site/OuvirMateria";
import { MeSurpreenda } from "@/components/site/MeSurpreenda";

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
  head: ({ loaderData, params, matches }) => {
    const o = origemDe(matches);
    if (!loaderData) {
      return { meta: [{ title: "Matéria não encontrada — Hockey4Life" }, { name: "robots", content: "noindex" }] };
    }
    const { post, autor } = loaderData;
    const desc = post.resumo ?? `${post.titulo} — Hockey4Life`;
    const url = `${o}/${post.slug}`;
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
        url: `${o}/autor/${autor.slug}`,
      };
    }
    jsonLd.publisher = {
      "@type": "Organization",
      name: "Hockey4Life",
      url: o,
    };

    // Breadcrumbs JSON-LD
    const breadcrumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: `${o}/` },
        { "@type": "ListItem", position: 2, name: post.titulo, item: url },
      ],
    };

    return {
      meta,
      links: [{ rel: "canonical", href: `${o}/${params.slug}` }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbs) },
      ],
    };
  },
  component: PostPage,
});

/* Folga vertical única entre blocos da matéria. */
const BLOCO = "mt-10";

function PostPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(slug));
  const { data: siteData } = useSuspenseQuery(configQuery());
  const articleBodyRef = useRef<HTMLDivElement | null>(null);
  if (!data) return null;
  const { post, autor, recentes, relacionados, anterior, proximo } = data;
  const url = typeof window !== "undefined" ? window.location.href : `https://hockey4life.com.br/${post.slug}`;
  const videoUrl: string | undefined = siteData.config?.hockey_fights_cancer?.video_url;
  const minutosLeitura = tempoLeitura(post.conteudo);

  // Selos: com chapéu, ele é o único rótulo; sem chapéu, no máximo 3 temas.
  const chapeu = post.chapeu?.trim();
  const selos = chapeu ? [] : post.temas.slice(0, 3);
  const recentesLateral = recentes.slice(0, 4);
  const leiaTambem = relacionados.slice(0, 3);

  const compartilhar = (variant: "topo" | "fim") => (
    <ShareButtons
      url={url}
      titulo={post.titulo}
      resumo={post.resumo}
      chapeu={post.chapeu}
      imagemCapa={post.imagem_capa}
      variant={variant}
      mostrarCartao={variant === "fim"}
    />
  );

  return (
    <SiteLayout config={siteData.config}>
      <ReadingProgress targetRef={articleBodyRef} />
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-10">
        {/* Trilha discreta */}
        <nav aria-label="Trilha" className="mb-3 text-[11px] text-muted-foreground/70">
          <Link to="/" className="hover:text-primary">
            Início
          </Link>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          {/* Coluna principal */}
          <article className="mx-auto w-full min-w-0 max-w-[46rem]">
            <div ref={articleBodyRef}>
              {(chapeu || selos.length > 0) && (
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {chapeu ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{chapeu}</span>
                  ) : (
                    selos.map((t) => (
                      <Link
                        key={t.slug}
                        to={t.tipo === "time" ? "/time/$slug" : "/assunto/$slug"}
                        params={{ slug: t.slug }}
                        className="text-[11px] font-bold uppercase tracking-wider text-primary/80 hover:text-primary"
                      >
                        {t.nome}
                      </Link>
                    ))
                  )}
                </div>
              )}

              <h1 className="h4l-title text-3xl leading-tight text-foreground md:text-5xl">{post.titulo}</h1>

              {/* Linha única: autor · data · tempo de leitura + compartilhar */}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                {autor && (
                  <Link
                    to="/autor/$slug"
                    params={{ slug: autor.slug }}
                    className="flex min-w-0 items-center gap-2 hover:text-primary"
                  >
                    {autor.foto_url ? (
                      <img src={autor.foto_url} alt={autor.nome} className="h-7 w-7 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                        {autor.nome.charAt(0)}
                      </span>
                    )}
                    <span className="truncate font-semibold text-foreground">{autor.nome}</span>
                  </Link>
                )}
                {autor && <EditarMateriaLink postId={post.id} />}

                <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                <span>{formatDataBR(post.publicado_em)}</span>
                <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                <span className="whitespace-nowrap">{minutosLeitura} min de leitura</span>

                <div className="w-full sm:ml-auto sm:w-auto">{compartilhar("topo")}</div>
              </div>

              {post.conteudo && <OuvirMateria titulo={post.titulo} html={post.conteudo} corpoId="materia-corpo" />}

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
                  id="materia-corpo"
                  className="prose-h4l mt-8"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(post.conteudo, {
                      ADD_TAGS: ["iframe"],
                      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target", "loading", "cite"],
                    }),
                  }}
                />
              )}
              {post.conteudo && <EmbedsSociais alvoId="materia-corpo" chave={post.id} />}

              <div className={`${BLOCO} border-t border-border pt-5`}>{compartilhar("fim")}</div>
            </div>

            {/* No celular a lateral não aparece: o autor vem aqui, sem caixa. */}
            {autor && (
              <aside className={`${BLOCO} border-t border-border pt-5 lg:hidden`}>
                <div className="flex items-start gap-4">
                  {autor.foto_url ? (
                    <img src={autor.foto_url} alt={autor.nome} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/20 text-lg font-bold text-primary">
                      {autor.nome.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <Link
                      to="/autor/$slug"
                      params={{ slug: autor.slug }}
                      className="block text-base font-bold text-foreground hover:text-primary"
                    >
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
                      className="mt-2 inline-block text-xs font-bold uppercase tracking-wider text-primary hover:underline"
                    >
                      Todas as matérias de {autor.nome} →
                    </Link>
                  </div>
                </div>
              </aside>
            )}

            <SeguirInstagram className={BLOCO} />

            {(anterior || proximo) && (
              <nav className={`${BLOCO} grid gap-4 border-t border-border pt-5 sm:grid-cols-2`}>
                {anterior ? (
                  <Link to="/$slug" params={{ slug: anterior.slug }} className="group block min-w-0">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">← Anterior</div>
                    <div className="mt-1 line-clamp-2 font-semibold group-hover:text-primary">{anterior.titulo}</div>
                  </Link>
                ) : (
                  <div />
                )}
                {proximo ? (
                  <Link to="/$slug" params={{ slug: proximo.slug }} className="group block min-w-0 sm:text-right">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Próxima →</div>
                    <div className="mt-1 line-clamp-2 font-semibold group-hover:text-primary">{proximo.titulo}</div>
                  </Link>
                ) : (
                  <div />
                )}
              </nav>
            )}

            <ContinueLendo
              currentSlug={post.slug}
              currentTemaSlugs={post.temas.map((t) => t.slug)}
              relacionados={relacionados}
              recentes={recentes as any}
            />

            <div className={`${BLOCO} flex justify-center`}>
              <MeSurpreenda excluirIdAtual={post.id} variant="link">
                Ler uma história ao acaso
              </MeSurpreenda>
            </div>

            {leiaTambem.length > 0 && (
              <section className={`${BLOCO} border-t border-border pt-5`}>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Leia também
                </div>
                <div>
                  {leiaTambem.map((p) => (
                    <PostCardSmall key={p.id} post={p} />
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* Lateral: só o essencial */}
          <aside className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
            <div className="space-y-8">
              {autor && (
                <div className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Sobre o autor
                  </div>
                  <div className="flex items-start gap-3">
                    {autor.foto_url ? (
                      <img src={autor.foto_url} alt={autor.nome} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/20 text-base font-bold text-primary">
                        {autor.nome.charAt(0)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <Link
                        to="/autor/$slug"
                        params={{ slug: autor.slug }}
                        className="block font-bold text-foreground hover:text-primary"
                      >
                        {autor.nome}
                      </Link>
                      {(autor.bio_curta || autor.bio) && (
                        <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{autor.bio_curta ?? autor.bio}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Matérias recentes
                </div>
                <div>
                  {recentesLateral.map((r) => (
                    <PostCardSmall key={r.id} post={r as any} />
                  ))}
                </div>
              </div>

              {videoUrl && (
                <div className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Vídeo destaque
                  </div>
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
            </div>
          </aside>
        </div>
      </div>
    </SiteLayout>
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
  } catch {
    /* noop */
  }
  return url;
}
