import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getHomeData } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { NaoPercaTicker } from "@/components/site/NaoPercaTicker";
import { PostCard, PostCardSmall } from "@/components/site/PostCard";
import { formatDataBR } from "@/lib/slugify";

const homeQuery = () =>
  queryOptions({
    queryKey: ["home"],
    queryFn: () => getHomeData(),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hockey4Life — histórias de vida, superação e gentileza" },
      {
        name: "description",
        content:
          "Portal Hockey4Life: histórias de vida, superação e gentileza com o hóquei no gelo como pano de fundo. Matérias, times e HFC.",
      },
      { property: "og:title", content: "Hockey4Life — histórias de vida, superação e gentileza" },
      { property: "og:description", content: "Portal Hockey4Life: histórias de vida, superação e gentileza com o hóquei no gelo como pano de fundo. Matérias, times e HFC." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery()),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(homeQuery());
  const { destaque, leiaAgora, ultimas, naoPerca, temasMenu, config } = data;
  const hfc = config?.hockey_fights_cancer ?? {};
  const times = temasMenu.filter((t) => t.tipo === "time");

  return (
    <SiteLayout config={config} temasMenu={temasMenu}>
      <NaoPercaTicker items={naoPerca} />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Destaque */}
          <div className="lg:col-span-2">
            {destaque ? (
              <Link to="/$slug" params={{ slug: destaque.slug }} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
                  {destaque.imagem_capa ? (
                    <img
                      src={destaque.imagem_capa}
                      alt={destaque.titulo}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="h4l-title text-6xl text-muted-foreground/30">H4L</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {destaque.temas.slice(0, 2).map((t) => (
                        <span key={t.slug} className="rounded bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                          {t.nome}
                        </span>
                      ))}
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {formatDataBR(destaque.publicado_em)}
                      </span>
                    </div>
                    <h1 className="h4l-title text-3xl leading-tight text-foreground transition-colors group-hover:text-primary md:text-5xl lg:text-6xl">
                      {destaque.titulo}
                    </h1>
                    {destaque.resumo && (
                      <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                        {destaque.resumo}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
                Ainda não há matérias publicadas. Acesse <Link to="/admin" className="text-primary underline">/admin</Link> para criar a primeira.
              </div>
            )}
          </div>

          {/* Leia agora */}
          <aside className="lg:col-span-1">
            <div className="h4l-title mb-3 flex items-center gap-2 text-lg text-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" /> LEIA AGORA
            </div>
            <div>
              {leiaAgora.map((p) => (
                <PostCardSmall key={p.id} post={p} />
              ))}
              {leiaAgora.length === 0 && (
                <p className="text-sm text-muted-foreground">Aguardando conteúdo.</p>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Últimas histórias */}
      {ultimas.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <div className="mb-6 flex items-end justify-between border-b border-border pb-2">
            <h2 className="h4l-title text-3xl text-foreground md:text-4xl">Últimas histórias</h2>
            <Link to="/arquivo" className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline">
              Ver arquivo →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ultimas.slice(0, 12).map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {/* Times */}
      {times.length > 0 && (
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="mb-4 h4l-title text-sm text-muted-foreground">NAVEGUE POR TIME</div>
            <div className="flex flex-wrap gap-2">
              {times.map((t) => (
                <Link
                  key={t.slug}
                  to="/time/$slug"
                  params={{ slug: t.slug }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {t.nome}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Hockey Fights Cancer */}
      {hfc.video_url && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <iframe
                src={hfc.video_url}
                title={hfc.titulo ?? "Hockey Fights Cancer"}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-destructive">Especial</div>
              <h2 className="mt-2 h4l-title text-3xl text-foreground md:text-5xl">
                {hfc.titulo ?? "Hockey Fights Cancer"}
              </h2>
              <p className="mt-4 max-w-lg text-muted-foreground">{hfc.texto}</p>
            </div>
          </div>
        </section>
      )}
    </SiteLayout>
  );
}
