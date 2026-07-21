import { createFileRoute } from "@tanstack/react-router";
import { listRecentForFeed, getSiteConfig } from "@/lib/posts.functions";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/feed")({
  server: {
    handlers: {
      GET: async () => {
        const [posts, site] = await Promise.all([listRecentForFeed(), getSiteConfig()]);
        const rodape = site.config?.rodape ?? {};
        const items = posts
          .map((p: any) => {
            const link = `/${p.slug}`;
            return `<item>
  <title>${esc(p.titulo)}</title>
  <link>${link}</link>
  <guid isPermaLink="false">${p.slug}</guid>
  ${p.publicado_em ? `<pubDate>${new Date(p.publicado_em).toUTCString()}</pubDate>` : ""}
  <description>${esc(p.resumo ?? "")}</description>
</item>`;
          })
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Hockey4Life</title>
<link>/</link>
<description>${esc(rodape.texto ?? "Histórias de vida, superação e gentileza com o hóquei no gelo como pano de fundo.")}</description>
<language>pt-BR</language>
${items}
</channel></rss>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/rss+xml", "Cache-Control": "public, max-age=1800" },
        });
      },
    },
  },
});
