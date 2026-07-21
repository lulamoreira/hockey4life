import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listTemasParaFiltro, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";

const q = () => queryOptions({ queryKey: ["temas-filtro"], queryFn: () => listTemasParaFiltro(), staleTime: 120_000 });
const cfg = () => queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });

export const Route = createFileRoute("/temas")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(q()),
      context.queryClient.ensureQueryData(cfg()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Temas — Hockey4Life" },
      { name: "description", content: "Índice completo de times e assuntos cobertos pelo Hockey4Life." },
      { property: "og:title", content: "Temas — Hockey4Life" },
      { property: "og:description", content: "Índice completo de times e assuntos cobertos pelo Hockey4Life." },
      { property: "og:url", content: "/temas" },
    ],
    links: [{ rel: "canonical", href: "/temas" }],
  }),
  component: TemasIndex,
});

function TemasIndex() {
  const { data } = useSuspenseQuery(q());
  const { data: site } = useSuspenseQuery(cfg());
  const times = data.filter((t) => t.tipo === "time").sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  const assuntos = data.filter((t) => t.tipo === "assunto").sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

  return (
    <SiteLayout config={site.config} temasMenu={site.temasMenu as any}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="h4l-title text-4xl text-foreground md:text-6xl">Temas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {times.length} times · {assuntos.length} assuntos
        </p>

        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <ColunaTemas titulo="Times" tipo="time" temas={times} />
          <ColunaTemas titulo="Assuntos" tipo="assunto" temas={assuntos} />
        </div>
      </div>
    </SiteLayout>
  );
}

function ColunaTemas({ titulo, tipo, temas }: { titulo: string; tipo: "time" | "assunto"; temas: Array<{ id: string; nome: string; slug: string; total: number }> }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
        <h2 className="h4l-title text-2xl text-primary">{titulo}</h2>
        <span className="text-xs text-muted-foreground">{temas.length}</span>
      </div>
      {temas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum {titulo.toLowerCase().slice(0, -1)} ainda.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {temas.map((t) => (
            <li key={t.id}>
              <Link
                to={tipo === "time" ? "/time/$slug" : "/assunto/$slug"}
                params={{ slug: t.slug }}
                className="flex items-center justify-between border-b border-border/50 py-2 hover:text-primary"
              >
                <span className="truncate text-sm">{t.nome}</span>
                <span className="text-xs text-muted-foreground">{t.total}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
