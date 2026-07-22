// Slugs reservados que NÃO podem virar rota de matéria.
export const RESERVED_SLUGS = new Set<string>([
  "admin",
  "time",
  "assunto",
  "autor",
  "busca",
  "arquivo",
  "temas",
  "fale-conosco",
  "feed",
  "sitemap.xml",
  "robots.txt",
  "api",
  "auth",
  "login",
  "logout",
  "favicon.ico",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
