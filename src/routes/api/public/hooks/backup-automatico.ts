import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/backup-automatico")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Autenticação: apikey do anon é o padrão para hooks internos.
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-apikey");
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apikey || !anon || apikey !== anon) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Carrega temas, configs, post_temas (todos), posts em lotes.
          const [{ data: temas }, { data: configs }, { data: postTemas }] = await Promise.all([
            supabaseAdmin.from("temas").select("*"),
            supabaseAdmin.from("configuracoes").select("*"),
            supabaseAdmin.from("post_temas").select("post_id,tema_id"),
          ]);

          const posts: any[] = [];
          let page = 0;
          while (true) {
            const from = page * 500;
            const { data, error } = await supabaseAdmin
              .from("posts")
              .select("id,wp_id,titulo,slug,resumo,conteudo,imagem_capa,credito_imagem,autor_id,status,destaque,nao_perca,publicado_em,criado_em,atualizado_em")
              .order("criado_em", { ascending: true })
              .order("id", { ascending: true })
              .range(from, from + 499);
            if (error) throw error;
            if (!data || data.length === 0) break;
            posts.push(...data);
            if (data.length < 500) break;
            page++;
          }

          const now = new Date();
          const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const prefix = `auto/${timestamp}`;

          const partSize = 200;
          const partes: { arquivo: string; total: number }[] = [];
          for (let i = 0, p = 1; i < posts.length; i += partSize, p++) {
            const chunk = posts.slice(i, i + partSize);
            const ids = new Set(chunk.map((c) => c.id));
            const rels = (postTemas ?? []).filter((r) => ids.has(r.post_id));
            const nome = `backup-conteudo-${String(p).padStart(3, "0")}.json`;
            const conteudo = JSON.stringify({ parte: p, posts: chunk, post_temas: rels });
            await supabaseAdmin.storage.from("backups").upload(
              `${prefix}/${nome}`,
              new Blob([conteudo], { type: "application/json" }),
              { upsert: true, contentType: "application/json" },
            );
            partes.push({ arquivo: nome, total: chunk.length });
          }

          const manifesto = {
            formato: "h4l-backup/1",
            gerado_em: now.toISOString(),
            total_posts: posts.length,
            total_temas: (temas ?? []).length,
            partes,
            temas: temas ?? [],
            configuracoes: configs ?? [],
          };
          await supabaseAdmin.storage.from("backups").upload(
            `${prefix}/backup-manifesto.json`,
            new Blob([JSON.stringify(manifesto)], { type: "application/json" }),
            { upsert: true, contentType: "application/json" },
          );

          // Também guarda um arquivo consolidado (para download rápido do backup automático)
          const consolidado = { manifesto, posts, post_temas: postTemas ?? [] };
          const consolidadoNome = `${timestamp}.json`;
          await supabaseAdmin.storage.from("backups").upload(
            `auto/${consolidadoNome}`,
            new Blob([JSON.stringify(consolidado)], { type: "application/json" }),
            { upsert: true, contentType: "application/json" },
          );

          // Poda: mantém 8 mais recentes (por consolidado + pastas)
          const { data: files } = await supabaseAdmin.storage.from("backups").list("auto", {
            limit: 1000, sortBy: { column: "created_at", order: "desc" },
          });
          const consolidados = (files ?? []).filter((f) => f.id !== null && f.name.endsWith(".json"));
          const antigos = consolidados.slice(8);
          if (antigos.length) {
            await supabaseAdmin.storage.from("backups").remove(antigos.map((f) => `auto/${f.name}`));
          }
          // Poda pastas também
          const pastas = (files ?? []).filter((f) => f.id === null).map((f) => f.name).sort().reverse();
          const pastasAntigas = pastas.slice(8);
          for (const pasta of pastasAntigas) {
            const { data: dentro } = await supabaseAdmin.storage.from("backups").list(`auto/${pasta}`, { limit: 1000 });
            if (dentro && dentro.length) {
              await supabaseAdmin.storage.from("backups").remove(dentro.map((f) => `auto/${pasta}/${f.name}`));
            }
          }

          return Response.json({ ok: true, posts: posts.length, partes: partes.length, nome: consolidadoNome });
        } catch (err: any) {
          console.error("backup-automatico error", err);
          return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
        }
      },
    },
  },
});
