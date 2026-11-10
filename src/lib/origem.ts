import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/** Fallback quando o host da requisição não puder ser lido. */
export const ORIGEM_PADRAO = "https://hockey4life.lovable.app";

/** Normaliza um host recebido em origem https absoluta. */
export function origemDoHost(host: string | null | undefined): string {
  const h = (host ?? "").split(",")[0].trim().toLowerCase();
  if (!h || !/^[a-z0-9.-]+(:\d+)?$/.test(h)) return ORIGEM_PADRAO;
  if (h.startsWith("localhost") || h.startsWith("127.")) return ORIGEM_PADRAO;
  return `https://${h}`;
}

/** Origem a partir de um Request (usado em rotas de servidor como sitemap/feed). */
export function origemDaRequisicao(req: Request): string {
  const url = new URL(req.url);
  // x-forwarded-host só é confiável atrás do proxy do sandbox (localhost).
  const host = url.hostname === "localhost" ? req.headers.get("x-forwarded-host") : url.host;
  return origemDoHost(host);
}

export const getOrigem = createServerFn({ method: "GET" }).handler(() => origemDaRequisicao(getRequest()));

/** Lê a origem que o loader da raiz deixou disponível, para usar dentro de head(). */
export function origemDe(matches: ReadonlyArray<{ loaderData?: unknown }> | undefined): string {
  const d = matches?.[0]?.loaderData as { origem?: string } | undefined;
  return d?.origem ?? ORIGEM_PADRAO;
}
