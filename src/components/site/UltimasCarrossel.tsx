import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PostListItem } from "@/lib/posts.functions";
import { PostCard } from "./PostCard";

const INTERVALO_MS = 5000;

/**
 * Carrossel de últimas notícias — exclusivo para viewports mobile (< md).
 * Avança automaticamente a cada 5s (direita → esquerda) e oferece setas
 * de navegação manual. Pausa o auto-play enquanto o usuário interage.
 */
export function UltimasCarrossel({ posts }: { posts: PostListItem[] }) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const trilhoRef = useRef<HTMLDivElement>(null);
  const total = posts.length;

  useEffect(() => {
    if (pausado || total <= 1) return;
    const id = window.setInterval(() => {
      setIndice((i) => (i + 1) % total);
    }, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [pausado, total]);

  function anterior() {
    setIndice((i) => (i - 1 + total) % total);
  }
  function proximo() {
    setIndice((i) => (i + 1) % total);
  }

  if (total === 0) return null;

  return (
    <div
      className="md:hidden"
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
      aria-roledescription="carrossel"
      aria-label="Últimas histórias"
    >
      <div className="overflow-hidden">
        <div
          ref={trilhoRef}
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${indice * 100}%)` }}
        >
          {posts.map((p, i) => (
            <div
              key={p.id}
              className="w-full shrink-0 px-1"
              aria-hidden={i !== indice}
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${total}`}
            >
              <PostCard post={p} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={anterior}
          aria-label="Notícia anterior"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {indice + 1} / {total}
        </div>
        <button
          type="button"
          onClick={proximo}
          aria-label="Próxima notícia"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
