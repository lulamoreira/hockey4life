import { Link } from "@tanstack/react-router";
import type { PostNesteDia } from "@/lib/descoberta.functions";

export function NesteDia({ posts, vizinhos }: { posts: PostNesteDia[]; vizinhos: boolean }) {
  if (!posts || posts.length === 0) return null;

  const anoAtual = new Date().getFullYear();
  const anosUnicos = Array.from(new Set(posts.map((p) => p.ano))).sort();
  const menorAno = anosUnicos[0];
  const diff = anoAtual - menorAno;

  const titulo = vizinhos
    ? "Por estes dias, em anos anteriores"
    : anosUnicos.length === 1
    ? `Neste dia, ${diff} ${diff === 1 ? "ano" : "anos"} atrás`
    : "Neste dia, em anos anteriores";

  return (
    <section className="mx-auto max-w-7xl px-4 py-8" aria-label="Neste dia, em anos anteriores">
      <div className="mb-6 flex items-end justify-between border-b border-border pb-2">
        <h2 className="h4l-title text-2xl text-foreground md:text-3xl">{titulo}</h2>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => {
          const chapeu = p.chapeu?.trim();
          return (
            <li key={p.id}>
              <Link
                to="/$slug"
                params={{ slug: p.slug }}
                className="group flex h-full min-h-[96px] items-stretch gap-3 overflow-hidden rounded-lg border border-border bg-card/60 backdrop-blur-sm transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-muted sm:w-28">
                  {p.imagem_capa ? (
                    <img
                      src={p.imagem_capa}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="h4l-title text-2xl text-muted-foreground/40">H4L</span>
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                    {p.ano}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-3">
                  {chapeu && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {chapeu}
                    </div>
                  )}
                  <div className="h4l-title line-clamp-3 text-sm leading-tight text-foreground transition-colors group-hover:text-primary sm:text-base">
                    {p.titulo}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
