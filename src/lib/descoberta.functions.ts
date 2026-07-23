import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type PostSorteado = {
  id: string;
  titulo: string;
  slug: string;
  chapeu: string | null;
  resumo: string | null;
  imagem_capa: string | null;
  publicado_em: string | null;
};

export type PostNesteDia = PostSorteado & { ano: number };

export const sortearPost = createServerFn({ method: "GET" })
  .inputValidator((v) =>
    z.object({ excluirIds: z.array(z.string().uuid()).max(20).optional() }).default({}).parse(v ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const excluir = data.excluirIds ?? [];
    // Tenta até 6 vezes evitar cair num dos ids recém-vistos
    for (let i = 0; i < 6; i++) {
      const { data: rows, error } = await sb.rpc("sortear_post_seguro", {
        _excluir_id: excluir[0] ?? null,
      });
      if (error) throw error;
      const post = (rows ?? [])[0] as PostSorteado | undefined;
      if (!post) return null;
      if (!excluir.includes(post.id)) return post;
    }
    // Aceita mesmo se repetir depois de 6 tentativas
    const { data: rows } = await sb.rpc("sortear_post_seguro", { _excluir_id: excluir[0] ?? null });
    return ((rows ?? [])[0] as PostSorteado | undefined) ?? null;
  });

export const getNesteDia = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  // Tenta o dia exato; se vazio, tenta 3 dias vizinhos
  const { data: exato, error } = await sb.rpc("neste_dia", { _hoje: null, _vizinhos: 0, _limite: 6 });
  if (error) throw error;
  if ((exato ?? []).length > 0) {
    return { posts: exato as PostNesteDia[], vizinhos: false };
  }
  const { data: viz } = await sb.rpc("neste_dia", { _hoje: null, _vizinhos: 3, _limite: 6 });
  return { posts: (viz ?? []) as PostNesteDia[], vizinhos: true };
});
