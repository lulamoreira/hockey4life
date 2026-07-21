import { useEffect, useState } from "react";

export type AparenciaConfig = {
  ativo: boolean;
  atual: { url_1280: string; url_1920: string; url_2048: string } | null;
  galeria: Array<{ label: string; url_1280: string; url_1920: string; url_2048: string }>;
  escurecimento: number; // 0..90
  desfoque: number;      // 0..20 px
  posicao: "center" | "top" | "bottom";
  mostrar_celular: boolean;
};

export const ARENA_PADRAO = {
  url_1280: "/fundo-arena-1280.webp",
  url_1920: "/fundo-arena-1920.webp",
  url_2048: "/fundo-arena-2048.webp",
};

export const APARENCIA_PADRAO: AparenciaConfig = {
  ativo: true,
  atual: null,
  galeria: [],
  escurecimento: 55,
  desfoque: 0,
  posicao: "center",
  mostrar_celular: false,
};

export function normalizeAparencia(raw: any): AparenciaConfig {
  const r = raw ?? {};
  const pos = ["center", "top", "bottom"].includes(r.posicao) ? r.posicao : "center";
  const atual = r.atual && typeof r.atual === "object" && r.atual.url_1280 && r.atual.url_1920 && r.atual.url_2048
    ? { url_1280: r.atual.url_1280, url_1920: r.atual.url_1920, url_2048: r.atual.url_2048 }
    : null;
  const galeria = Array.isArray(r.galeria)
    ? r.galeria
        .filter((g: any) => g && g.url_1280 && g.url_1920 && g.url_2048)
        .map((g: any) => ({
          label: String(g.label ?? "").slice(0, 60) || "Fundo",
          url_1280: g.url_1280, url_1920: g.url_1920, url_2048: g.url_2048,
        }))
        .slice(0, 20)
    : [];
  return {
    ativo: r.ativo !== false,
    atual,
    galeria,
    escurecimento: clamp(r.escurecimento, 0, 90, 55),
    desfoque: clamp(r.desfoque, 0, 20, 0),
    posicao: pos as any,
    mostrar_celular: r.mostrar_celular === true,
  };
}

function clamp(n: any, min: number, max: number, def: number) {
  const v = Number.isFinite(Number(n)) ? Number(n) : def;
  return Math.min(max, Math.max(min, v));
}

export function FundoArena({ aparencia }: { aparencia: AparenciaConfig }) {
  if (!aparencia.ativo) return null;
  const urls = aparencia.atual ?? ARENA_PADRAO;
  const objectPosition =
    aparencia.posicao === "top" ? "center top"
      : aparencia.posicao === "bottom" ? "center bottom"
        : "center center";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <picture className={aparencia.mostrar_celular ? "block h-full w-full" : "hidden h-full w-full md:block"}>
        <source media="(min-width: 1921px)" srcSet={urls.url_2048} />
        <source media="(min-width: 1281px)" srcSet={urls.url_1920} />
        <img
          src={urls.url_1280}
          alt=""
          loading="lazy"
          decoding="async"
          {...({ fetchpriority: "low" } as any)}
          className="h-full w-full object-cover"
          style={{
            objectPosition,
            filter: aparencia.desfoque > 0 ? `blur(${aparencia.desfoque}px)` : undefined,
            transform: aparencia.desfoque > 0 ? "scale(1.05)" : undefined, // evita bordas do blur
          }}
        />
      </picture>
      {/* Camada de escurecimento */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(13,13,15,${(aparencia.escurecimento / 100).toFixed(3)})` }}
      />
    </div>
  );
}

/** Prévia dentro do admin (não fixa; ocupa a caixa dada). */
export function FundoArenaPreview({
  aparencia, height = 260,
}: { aparencia: AparenciaConfig; height?: number }) {
  const urls = aparencia.atual ?? ARENA_PADRAO;
  const objectPosition =
    aparencia.posicao === "top" ? "center top"
      : aparencia.posicao === "bottom" ? "center bottom"
        : "center center";
  return (
    <div className="relative w-full overflow-hidden rounded-md border border-border" style={{ height }}>
      {aparencia.ativo && (
        <>
          <img
            src={urls.url_1280}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition,
              filter: aparencia.desfoque > 0 ? `blur(${aparencia.desfoque}px)` : undefined,
              transform: aparencia.desfoque > 0 ? "scale(1.05)" : undefined,
            }}
          />
          <div className="absolute inset-0" style={{ backgroundColor: `rgba(13,13,15,${(aparencia.escurecimento / 100).toFixed(3)})` }} />
        </>
      )}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="h4l-title text-3xl text-foreground md:text-4xl">Título de exemplo</div>
        <p className="max-w-md text-sm text-muted-foreground">
          Texto de apoio para você conferir a legibilidade sobre o fundo. Se estiver difícil ler, aumente o escurecimento.
        </p>
      </div>
    </div>
  );
}

/** Hook simples para saber se o usuário salvou e a UI já refletiu. */
export function useFundoAtivo(aparencia: AparenciaConfig | undefined) {
  const [ativo, setAtivo] = useState(false);
  useEffect(() => { setAtivo(!!aparencia?.ativo); }, [aparencia?.ativo]);
  return ativo;
}
