import { createFileRoute } from "@tanstack/react-router";
import { listAllPublishedSlugs } from "@/lib/posts.functions";
import { origemDaRequisicao } from "@/lib/origem";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const base = origemDaRequisicao(request);
        const posts = await listAllPublishedSlugs();
        const staticPaths = ["/", "/arquivo", "/fale-conosco", "/busca", "/temas"];
        const urls: string[] = [];
        for (const p of staticPaths) {
          urls.push(`  <url><loc>${base}${p}</loc><changefreq>weekly</changefreq></url>`);
        }
        for (const post of posts) {
          const last = post.atualizado_em ?? post.publicado_em;
          urls.push(
            `  <url><loc>${base}/${post.slug}</loc>${last ? `<lastmod>${new Date(last).toISOString()}</lastmod>` : ""}<changefreq>monthly</changefreq></url>`,
          );
        }
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
