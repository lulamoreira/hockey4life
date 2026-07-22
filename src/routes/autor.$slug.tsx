import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getAutorPublico, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PostCard } from "@/components/site/PostCard";
import { UltimasCarrossel } from "@/components/site/UltimasCarrossel";
import { Linkedin, Mail, Instagram, Twitter, Globe } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

const autorQuery = (slug: string, todas: boolean, page: number) =>
  queryOptions({
    queryKey: ["autor", slug, todas, page],
    queryFn: () => getAutorPublico({ data: { slug, todas, page } }),
    staleTime: 60_000,
  });
const configQuery = () =>
  queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });

const searchSchema = z.object({
  todas: z.union([z.literal(1), z.literal(0), z.boolean()]).optional().transform((v) => v === 1 || v === true),
  page: z.number().int().min(1).default(1),
});

export const Route = createFileRoute("/autor/$slug")({
  validateSearch: (s) => searchSchema.parse(s),
  loaderDeps: ({ search }) => ({ todas: !!search.todas, page: search.page }),
  loader: async ({ context, params, deps }) => {
    const result = await context.queryClient.ensureQueryData(autorQuery(params.slug, deps.todas, deps.page));
    if (!result) throw notFound();
    await context.queryClient.ensureQueryData(configQuery());
    return result;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Autor não encontrado — Hockey4Life" }, { name: "robots", content: "noindex" }] };
    const { autor } = loaderData;
    const desc = autor.bio_curta ?? autor.bio ?? `Matérias de ${autor.nome} no Hockey4Life.`;
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

    // JSON-LD Person
    const sameAs: string[] = [];
    if (autor.linkedin_url) sameAs.push(autor.linkedin_url);
    const outros = autor.outros_links ?? {};
    Object.values(outros).forEach((u) => { if (u) sameAs.push(u); });
    const jsonLd: any = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: autor.nome,
      description: desc,
      url,
      jobTitle: "Jornalista esportivo",
      worksFor: { "@type": "Organization", name: "Hockey4Life", url: "https://hockey4life.com.br" },
    };
    if (autor.foto_url) jsonLd.image = autor.foto_url;
    if (sameAs.length) jsonLd.sameAs = sameAs;

    return {
      meta,
      links: [{ rel: "canonical", href: `/autor/${params.slug}` }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },
  component: AutorPage,
});

function AutorPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const todas = !!search.todas;
  const page = search.page ?? 1;
  const { data } = useSuspenseQuery(autorQuery(slug, todas, page));
  const { data: siteData } = useSuspenseQuery(configQuery());
  if (!data) return null;
  const { autor, stats } = data;

  const anosCobertura =
    stats.primeiro_ano && stats.ultimo_ano ? Math.max(1, stats.ultimo_ano - stats.primeiro_ano + 1) : 0;

  return (
    <SiteLayout config={siteData.config}>
      <div className="mx-auto my-6 max-w-6xl rounded-lg bg-black/50 px-4 py-8 backdrop-blur-sm md:my-10 md:px-8 md:py-10">
        {/* Topo */}
        <header className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
          {autor.foto_url ? (
            <img
              src={autor.foto_url}
              alt={autor.nome}
              className="h-40 w-40 shrink-0 rounded-full object-cover ring-4 ring-primary/40 md:h-48 md:w-48"
            />
          ) : (
            <span className="grid h-40 w-40 shrink-0 place-items-center rounded-full bg-primary/20 text-6xl font-bold text-primary md:h-48 md:w-48">
              {autor.nome.charAt(0)}
            </span>
          )}
          <div className="mx-auto w-full max-w-[92%] min-w-0 flex-1 md:max-w-none">
            <h1 className="h4l-title text-4xl leading-tight text-foreground md:text-6xl">{autor.nome}</h1>
            <p className="mt-2 text-sm uppercase tracking-widest text-primary">
              {autor.cargo ?? "Jornalista esportivo · Hockey4Life"}
            </p>
            {autor.bio_curta && (
              <p className="mt-4 text-base text-foreground/90 md:text-lg">{autor.bio_curta}</p>
            )}
            {(autor.formacao || autor.competencias) && (
              <dl className="mt-4 space-y-1 text-sm text-foreground/85">
                {autor.formacao && (
                  <div className="flex flex-wrap justify-center gap-x-2 md:justify-start">
                    <dt className="font-semibold uppercase tracking-wider text-muted-foreground">Formação:</dt>
                    <dd>{autor.formacao}</dd>
                  </div>
                )}
                {autor.competencias && (
                  <div className="flex flex-wrap justify-center gap-x-2 md:justify-start">
                    <dt className="font-semibold uppercase tracking-wider text-muted-foreground">Competências:</dt>
                    <dd>{autor.competencias}</dd>
                  </div>
                )}
              </dl>
            )}
            <SocialLinks autor={autor} />
          </div>
        </header>

        {/* Bio longa */}
        {autor.bio_longa && (
          <section className="mx-auto mt-10 max-w-[92%] text-center md:max-w-2xl md:text-left">
            <p className="text-base leading-relaxed text-foreground/90 md:text-lg md:leading-loose whitespace-pre-line">
              {autor.bio_longa}
            </p>
          </section>
        )}

        {/* Destaques de carreira */}
        <section className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
          <HighlightCard destaque="25" unidade="anos" descricao="de imprensa esportiva" />
          <HighlightCard destaque="6" unidade="anos" descricao="na Rede Globo" />
          <HighlightCard destaque={stats.total.toLocaleString("pt-BR")} unidade="matérias" descricao="assinadas no Hockey4Life" />
        </section>

        {/* Linha do tempo */}
        {(autor.linha_do_tempo?.length ?? 0) > 0 && (
          <section className="mx-auto mt-14 max-w-2xl">
            <h2 className="h4l-title mb-6 text-2xl text-foreground md:text-3xl">Linha do tempo</h2>
            <LinhaDoTempo itens={autor.linha_do_tempo!} />
          </section>
        )}

        {/* O acervo */}
        <section className="mt-14">
          <h2 className="h4l-title mb-6 text-2xl text-foreground md:text-3xl">O acervo</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Matérias assinadas" value={stats.total.toLocaleString("pt-BR")} />
            <StatCard label="Primeira" value={stats.primeiro_ano ? String(stats.primeiro_ano) : "—"} />
            <StatCard label="Última" value={stats.ultimo_ano ? String(stats.ultimo_ano) : "—"} />
            <StatCard label="Times cobertos" value={String(stats.times_count)} />
          </div>
          {anosCobertura > 0 && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {anosCobertura} {anosCobertura === 1 ? "ano" : "anos"} de cobertura
            </p>
          )}
          {stats.por_ano.length > 0 && <BarrasPorAno data={stats.por_ano} />}
        </section>

        {/* Galeria */}
        {(autor.fotos?.length ?? 0) > 0 && (
          <section className="mt-14">
            <h2 className="h4l-title mb-6 text-2xl text-foreground md:text-3xl">Galeria</h2>
            <Galeria fotos={autor.fotos!} nome={autor.nome} />
          </section>
        )}

        {/* Últimas / Todas */}
        {data.modo === "perfil" ? (
          <section className="mt-14">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="h4l-title text-2xl text-foreground md:text-3xl">Últimas matérias assinadas</h2>
            </div>
            {data.ultimas.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma matéria publicada ainda.</p>
            ) : (
              <>
                <div className="md:hidden">
                  <UltimasCarrossel posts={data.ultimas as any} />
                </div>
                <div className="hidden gap-6 md:grid sm:grid-cols-2 lg:grid-cols-3">
                  {data.ultimas.map((p) => <PostCard key={p.id} post={p} />)}
                </div>
                {stats.total > data.ultimas.length && (
                  <div className="mt-8 text-center">
                    <Link
                      to="/autor/$slug"
                      params={{ slug }}
                      search={{ todas: true, page: 1 } as any}
                      className="inline-block rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90"
                    >
                      Ver todas as {stats.total.toLocaleString("pt-BR")} matérias
                    </Link>
                  </div>
                )}
              </>
            )}
          </section>
        ) : (
          <section className="mt-14">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h2 className="h4l-title text-2xl text-foreground md:text-3xl">
                Todas as matérias <span className="text-primary">({data.total.toLocaleString("pt-BR")})</span>
              </h2>
              <Link
                to="/autor/$slug"
                params={{ slug }}
                search={{ todas: false, page: 1 } as any}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary"
              >
                ← Voltar ao perfil
              </Link>
            </div>
            {data.items.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma matéria encontrada.</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((p) => <PostCard key={p.id} post={p} />)}
              </div>
            )}
            {data.totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2 text-sm">
                {page > 1 && (
                  <Link to="/autor/$slug" params={{ slug }} search={{ todas: true, page: page - 1 } as any} className="rounded border border-border px-3 py-1 hover:border-primary">
                    ← Anterior
                  </Link>
                )}
                <span className="text-muted-foreground">Página {page} de {data.totalPages}</span>
                {page < data.totalPages && (
                  <Link to="/autor/$slug" params={{ slug }} search={{ todas: true, page: page + 1 } as any} className="rounded border border-border px-3 py-1 hover:border-primary">
                    Próxima →
                  </Link>
                )}
              </nav>
            )}
          </section>
        )}

        {/* Rodapé da página */}
        <div className="mt-16 border-t border-border pt-8 text-center">
          <Link
            to="/fale-conosco"
            className="inline-block rounded-md border border-primary bg-transparent px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-primary-foreground"
          >
            Fale com {autor.nome.split(" ")[0]}
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 text-center backdrop-blur-sm">
      <div className="h4l-title text-3xl text-primary md:text-4xl">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function HighlightCard({ destaque, unidade, descricao }: { destaque: string; unidade: string; descricao: string }) {
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-5 text-center backdrop-blur-sm">
      <div className="h4l-title text-4xl leading-none text-primary md:text-5xl">{destaque}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-primary/80">{unidade}</div>
      <div className="mt-2 text-sm text-foreground/90">{descricao}</div>
    </div>
  );
}

function LinhaDoTempo({ itens }: { itens: Array<{ ano: string; texto: string }> }) {
  const [expandido, setExpandido] = useState(false);
  const visiveis = expandido ? itens : itens.slice(0, 4);
  const resto = itens.length - 4;
  return (
    <>
      <ol className="relative border-l-2 border-primary/40 pl-6">
        {visiveis.map((item, i) => (
          <li key={i} className="relative mb-6 last:mb-0">
            <span className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-primary ring-4 ring-background" />
            <div className="h4l-title text-2xl text-primary">{item.ano}</div>
            <p className="mt-1 text-sm text-foreground/90 md:text-base">{item.texto}</p>
          </li>
        ))}
      </ol>
      {resto > 0 && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-transparent px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-primary-foreground"
          >
            {expandido ? "Recolher" : `Ver carreira completa (+${resto})`}
          </button>
        </div>
      )}
    </>
  );
}

function BarrasPorAno({ data }: { data: Array<{ ano: number; total: number }> }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="mt-8 rounded-lg border border-border bg-card/40 p-4 backdrop-blur-sm">
      <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Matérias por ano</div>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{ minHeight: 180 }}>
        {data.map((d) => {
          const h = Math.max(4, Math.round((d.total / max) * 160));
          return (
            <div key={d.ano} className="flex min-w-[36px] flex-1 flex-col items-center gap-1">
              <div className="text-[10px] text-muted-foreground">{d.total}</div>
              <div
                className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                style={{ height: h }}
                title={`${d.ano}: ${d.total} matérias`}
              />
              <div className="text-[10px] text-muted-foreground">{d.ano}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Galeria({ fotos, nome }: { fotos: string[]; nome: string }) {
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {fotos.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setAberta(url)}
            className="group overflow-hidden rounded-lg border border-border bg-card"
          >
            <img
              src={url}
              alt={`${nome} — foto ${i + 1}`}
              className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {aberta && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4"
          onClick={() => setAberta(null)}
        >
          <img src={aberta} alt="" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setAberta(null)}
            className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground"
          >
            Fechar ✕
          </button>
        </div>
      )}
    </>
  );
}

function SocialLinks({ autor }: { autor: any }) {
  const outros: Record<string, string> = autor.outros_links ?? {};
  const links: Array<{ href: string; label: string; icon: any }> = [];
  if (autor.linkedin_url) links.push({ href: autor.linkedin_url, label: "LinkedIn", icon: Linkedin });
  if (outros.twitter) links.push({ href: outros.twitter, label: "X/Twitter", icon: Twitter });
  if (outros.instagram) links.push({ href: outros.instagram, label: "Instagram", icon: Instagram });
  if (outros.email) links.push({ href: `mailto:${outros.email}`, label: "E-mail", icon: Mail });
  if (outros.site) links.push({ href: outros.site, label: "Site", icon: Globe });
  Object.entries(outros).forEach(([k, v]) => {
    if (!v || ["twitter", "instagram", "email", "site"].includes(k)) return;
    links.push({ href: v, label: k, icon: Globe });
  });
  if (links.length === 0) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer me"
          aria-label={l.label}
          className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <l.icon className="h-4 w-4" />
          {l.label}
        </a>
      ))}
    </div>
  );
}
