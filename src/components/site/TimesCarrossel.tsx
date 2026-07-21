import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { nhlLogoUrl } from "@/lib/nhl-logos";

type Time = { slug: string; nome: string };

export function TimesCarrossel({ times }: { times: Time[] }) {
  // Ordem alfabética; apenas times com logo mapeado.
  const items = [...times]
    .filter((t) => nhlLogoUrl(t.slug))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    loop: false,
    containScroll: "trimSnaps",
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  if (items.length === 0) return null;

  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="h4l-title text-sm text-muted-foreground">TIMES DA NHL</div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canPrev}
              className="rounded-md border border-border p-1.5 text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Próximo"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canNext}
              className="rounded-md border border-border p-1.5 text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-hidden" ref={emblaRef}>
          <ul className="flex gap-3">
            {items.map((t) => {
              const logo = nhlLogoUrl(t.slug)!;
              return (
                <li key={t.slug} className="min-w-0 shrink-0 basis-1/3 sm:basis-1/4 md:basis-1/6 lg:basis-[12.5%]">
                  <Link
                    to="/time/$slug"
                    params={{ slug: t.slug }}
                    title={t.nome}
                    aria-label={`Ver matérias de ${t.nome}`}
                    className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-border bg-background p-3 transition-colors hover:border-primary"
                  >
                    <img
                      src={logo}
                      alt={`Logo ${t.nome}`}
                      loading="lazy"
                      className="h-14 w-14 object-contain transition-transform group-hover:scale-110 md:h-16 md:w-16"
                    />
                    <span className="line-clamp-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-primary">
                      {t.nome}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
