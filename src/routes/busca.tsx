import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { searchPosts, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { formatDataBR } from "@/lib/slugify";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  ordem: z.enum(["rel", "desc", "asc"]).optional().default("rel"),
});

const cfg = () =>
  queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });

export const Route = createFileRoute("/busca")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(cfg()),
  head: () => ({
    meta: [
      { title: "Buscar — Hockey4Life" },
      { name: "description", content: "Busque matérias no portal Hockey4Life." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "/busca" },
    ],
    links: [{ rel: "canonical", href: "/busca" }],
  }),
  component: BuscaPage,
});

function BuscaPage() {
  const { q, page, ordem } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q ?? "");
  const { data: site } = useSuspenseQuery(cfg());

  const result = useQuery({
    queryKey: ["busca", q, page, ordem],
    queryFn: () => searchPosts({ data: { q, page, ordem } }),
    enabled: !!q && q.length > 0,
    staleTime: 30_000,
  });

  const setOrdem = (o: "rel" | "desc" | "asc") => navigate({ to: "/busca", search: { q, page: 1, ordem: o } });

  return (
    <SiteLayout config={site.config}>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="h4l-title text-4xl text-foreground md:text-5xl">Buscar</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/busca", search: { q: term.trim(), page: 1, ordem: "rel" } });
          }}
          className="mt-6 flex gap-2"
        >
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="O que você procura?"
            className="min-w-0 flex-1 rounded-md border border-border bg-card px-4 py-3 text-base focus:border-primary focus:outline-none"
          />
          <button className="shrink-0 rounded-md bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 sm:px-5 sm:text-base">
            Buscar
          </button>
        </form>

        {q && result.isLoading && <p className="mt-8 text-muted-foreground">Buscando…</p>}

        {q && result.data && (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {result.data.total} resultado(s) para “{q}”
              </p>
              <div className="flex gap-1">
                {(["rel", "desc", "asc"] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setOrdem(o)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                      ordem === o ? "bg-primary text-primary-foreground" : "border border-border hover:border-primary"
                    }`}
                  >
                    {o === "rel" ? "Relevância" : o === "desc" ? "Recentes" : "Antigas"}
                  </button>
                ))}
              </div>
            </div>

            {result.data.items.length === 0 ? (
              <div className="mt-8 rounded-lg border border-dashed border-border p-8">
                <p className="text-lg font-semibold">Nada encontrado para “{q}”.</p>
                {result.data.sugestoes.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">Que tal um destes temas?</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.data.sugestoes.map((t) => (
                        <Link
                          key={t.slug}
                          to={t.tipo === "time" ? "/time/$slug" : "/assunto/$slug"}
                          params={{ slug: t.slug }}
                          className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25"
                        >
                          {t.nome} ({t.total})
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                <Link
                  to="/arquivo"
                  search={{ q: "", temas: [], ano: null, mes: null, ordem: "desc", page: 1 } as any}
                  className="mt-4 inline-block text-sm font-semibold uppercase tracking-wider text-primary hover:underline"
                >
                  Ver todo o arquivo →
                </Link>
              </div>
            ) : (
              <ul className="mt-6 space-y-6">
                {result.data.items.map((p) => (
                  <li key={p.id} className="border-b border-border pb-6">
                    <Link to="/$slug" params={{ slug: p.slug }} className="group block">
                      <h2 className="h4l-title text-xl text-foreground transition-colors group-hover:text-primary md:text-2xl">
                        {p.titulo}
                      </h2>
                      <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                        {formatDataBR(p.publicado_em)}
                      </p>
                      {p.trecho && (
                        <p
                          className="mt-2 text-sm text-muted-foreground [&_mark]:rounded [&_mark]:bg-primary/30 [&_mark]:px-1 [&_mark]:text-foreground"
                          // sanitized: ts_headline retorna trecho controlado com <mark>
                          dangerouslySetInnerHTML={{ __html: p.trecho }}
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {result.data.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link to="/busca" search={{ q, page: page - 1, ordem }} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary">
                    ← Anterior
                  </Link>
                )}
                <span className="text-sm text-muted-foreground">Página {page} de {result.data.totalPages}</span>
                {page < result.data.totalPages && (
                  <Link to="/busca" search={{ q, page: page + 1, ordem }} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary">
                    Próxima →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SiteLayout>
  );
}
