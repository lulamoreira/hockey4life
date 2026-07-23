import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { PostListItem } from "@/lib/posts.functions";

const VISITED_KEY = "h4l:visited-posts";

function getVisited(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(VISITED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markVisited(slug: string) {
  if (typeof window === "undefined") return;
  try {
    const set = getVisited();
    set.add(slug);
    sessionStorage.setItem(VISITED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* noop */
  }
}

interface Props {
  currentSlug: string;
  currentTemaSlugs: string[];
  relacionados: PostListItem[];
  recentes: Array<Pick<PostListItem, "id" | "titulo" | "slug" | "imagem_capa" | "publicado_em"> & Partial<PostListItem>>;
}

export function ContinueLendo({ currentSlug, currentTemaSlugs, relacionados, recentes }: Props) {
  const [visited, setVisited] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setVisited(getVisited());
    markVisited(currentSlug);
  }, [currentSlug]);

  const proxima = useMemo(() => {
    const pool: PostListItem[] = [];
    const seen = new Set<string>();
    const push = (p: PostListItem | undefined | null) => {
      if (!p || p.slug === currentSlug || seen.has(p.slug)) return;
      seen.add(p.slug);
      pool.push(p);
    };

    // 1) sort by publicado_em desc
    const byDateDesc = (arr: PostListItem[]) =>
      [...arr].sort((a, b) => {
        const da = a.publicado_em ? new Date(a.publicado_em).getTime() : 0;
        const db = b.publicado_em ? new Date(b.publicado_em).getTime() : 0;
        return db - da;
      });

    const rec = byDateDesc(recentes as PostListItem[]);
    const rel = byDateDesc(relacionados);

    // Prefer not-yet-visited across everything (most recent first)
    for (const p of rec) push(p);
    for (const p of rel) push(p);

    const unvisited = pool.filter((p) => !visited.has(p.slug));
    if (unvisited.length > 0) return unvisited[0];

    // Fallback: most recent of same theme
    const sameTheme = rel.find((p) =>
      p.temas?.some((t) => currentTemaSlugs.includes(t.slug)),
    );
    if (sameTheme && sameTheme.slug !== currentSlug) return sameTheme;

    // Fallback: most recent of the site
    return pool[0] ?? null;
  }, [relacionados, recentes, currentSlug, currentTemaSlugs, visited]);

  if (!proxima) return null;

  const tema = proxima.temas?.[0];
  const chapeu = proxima.chapeu?.trim() || tema?.nome;

  return (
    <section className="mt-10" aria-label="Continue lendo">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Continue lendo
      </div>
      <Link
        to="/$slug"
        params={{ slug: proxima.slug }}
        className="group block overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted sm:aspect-[21/9]">
          {proxima.imagem_capa ? (
            <img
              src={proxima.imagem_capa}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="h4l-title text-5xl text-muted-foreground/40">H4L</span>
            </div>
          )}
        </div>
        <div className="p-4 sm:p-6">
          {chapeu && (
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {chapeu}
            </div>
          )}
          <h3 className="mt-1 h4l-title text-2xl leading-tight text-foreground transition-colors group-hover:text-primary sm:text-3xl md:text-4xl">
            {proxima.titulo}
          </h3>
          {proxima.resumo && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground sm:text-base">
              {proxima.resumo}
            </p>
          )}
        </div>
      </Link>
    </section>
  );
}
