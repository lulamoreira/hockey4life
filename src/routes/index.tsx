import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { getHomeData } from "@/lib/posts.functions";
import { getNesteDia } from "@/lib/descoberta.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Letreiro } from "@/components/site/Letreiro";
import { MancheteCarrossel } from "@/components/site/MancheteCarrossel";
import { PostCard, PostCardSmall } from "@/components/site/PostCard";
import { UltimasCarrossel } from "@/components/site/UltimasCarrossel";
import { TimesCarrossel } from "@/components/site/TimesCarrossel";
import { PlacaresNaoPerca } from "@/components/site/PlacaresLetreiros";
import { YouTubeFacade } from "@/components/site/YouTubeFacade";
import { NesteDia } from "@/components/site/NesteDia";
import { parseYouTube } from "@/lib/youtube";

const homeQuery = () =>
  queryOptions({
    queryKey: ["home"],
    queryFn: () => getHomeData(),
    staleTime: 60_000,
  });

const nesteDiaQuery = () =>
  queryOptions({
    queryKey: ["neste-dia"],
    queryFn: () => getNesteDia(),
    staleTime: 5 * 60_000,
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
  const nesteDiaQ = useQuery(nesteDiaQuery());
  const { manchetes, leiaAgora, ultimas, naoPerca, letreiro, carrossel, temasMenu, times: timesSettings, placares, config } = data;
  const hfc = config?.hockey_fights_cancer ?? {};
  const times = temasMenu.filter((t) => t.tipo === "time");


  return (
    <SiteLayout config={config}>
      {times.length > 0 && <TimesCarrossel times={times} settings={timesSettings} />}



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
            <div className="overflow-hidden rounded-lg border border-border bg-card/60">
              <div className="bg-black/70 py-2 text-center">
                <span className="font-list-cond text-[14px] font-bold uppercase tracking-wider text-primary">
                  Leia agora
                </span>
              </div>
              <div>
                {leiaAgora.map((p) => (
                  <PostCardSmall key={p.id} post={p} />
                ))}
                {leiaAgora.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">Aguardando conteúdo.</p>
                )}
              </div>
              {leiaAgora.length > 0 && (
                <Link
                  to="/arquivo"
                  className="block border-t border-border/60 py-2 text-center text-xs font-semibold uppercase tracking-wider text-primary hover:bg-white/5"
                >
                  Ver mais →
                </Link>
              )}
            </div>
          </aside>

        </div>
      </section>

      {/* Placares NHL — estilo "NÃO PERCA", logo acima do vídeo destaque */}
      <div className="pt-4">
        <PlacaresNaoPerca settings={placares} />
      </div>

      {/* Vídeo destaque capa (antes: Hockey Fights Cancer) */}
      {(() => {
        const src = hfc.video_url_original || hfc.video_url;
        if (!src || !parseYouTube(src)) return null;
        const titulo = hfc.titulo ?? "Vídeo destaque";
        return (
          <section className="mx-auto max-w-7xl px-4 py-12">
            <div className="rounded-lg bg-black/40 p-6 backdrop-blur-sm md:p-10">
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <YouTubeFacade url={src} title={titulo} />
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-destructive">Especial</div>
                  <h2 className="mt-2 h4l-title text-3xl text-foreground md:text-5xl">
                    {titulo}
                  </h2>
                  <p className="mt-4 max-w-lg text-muted-foreground">{hfc.texto}</p>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Últimas histórias */}
      {ultimas.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <div className="mb-6 flex items-end justify-between border-b border-border pb-2">
            <h2 className="h4l-title text-3xl text-foreground md:text-4xl">Últimas histórias</h2>
            <Link to="/arquivo" className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline">
              Ver arquivo →
            </Link>
          </div>
          <UltimasCarrossel posts={ultimas.slice(0, 9)} />
          <div className="hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
            {ultimas.slice(0, 9).map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {/* Neste dia, anos atrás */}
      {nesteDiaQ.data && nesteDiaQ.data.posts.length > 0 && (
        <NesteDia posts={nesteDiaQ.data.posts} vizinhos={nesteDiaQ.data.vizinhos} />
      )}





      {/* Letreiro "NÃO PERCA" logo acima do rodapé */}
      <div className="mx-auto max-w-7xl px-4 pb-6">
        <Letreiro items={naoPerca} settings={letreiro} redes={config?.redes_sociais} />
      </div>


    </SiteLayout>
  );
}
