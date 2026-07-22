import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getHomeData } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Letreiro } from "@/components/site/Letreiro";
import { MancheteCarrossel } from "@/components/site/MancheteCarrossel";
import { PostCard, PostCardSmall } from "@/components/site/PostCard";
import { TimesCarrossel } from "@/components/site/TimesCarrossel";
import { PlacaresLetreiros } from "@/components/site/PlacaresLetreiros";

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
  const { manchetes, leiaAgora, ultimas, naoPerca, letreiro, carrossel, temasMenu, times: timesSettings, placares, config } = data;
  const hfc = config?.hockey_fights_cancer ?? {};
  const times = temasMenu.filter((t) => t.tipo === "time");

  return (
    <SiteLayout config={config}>
      {times.length > 0 && <TimesCarrossel times={times} settings={timesSettings} />}

      <Letreiro items={naoPerca} settings={letreiro} />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Manchete — carrossel */}
          <div className="lg:col-span-2">
            {manchetes.length > 0 ? (
              <MancheteCarrossel slides={manchetes} settings={carrossel} />
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

      <NhlPlacar />


      {/* Vídeo destaque capa (antes: Hockey Fights Cancer) */}
      {hfc.video_url && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="rounded-lg bg-black/40 p-6 backdrop-blur-sm md:p-10">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="aspect-video overflow-hidden rounded-lg bg-black">
                <iframe
                  src={hfc.video_url}
                  title={hfc.titulo ?? "Vídeo destaque"}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-destructive">Especial</div>
                <h2 className="mt-2 h4l-title text-3xl text-foreground md:text-5xl">
                  {hfc.titulo ?? "Vídeo destaque"}
                </h2>
                <p className="mt-4 max-w-lg text-muted-foreground">{hfc.texto}</p>
              </div>
            </div>
          </div>
        </section>
      )}

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

    </SiteLayout>
  );
}
