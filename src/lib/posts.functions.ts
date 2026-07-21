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

export type PostListItem = {
  id: string;
  titulo: string;
  slug: string;
  resumo: string | null;
  imagem_capa: string | null;
  credito_imagem: string | null;
  publicado_em: string | null;
  destaque: boolean;
  nao_perca: boolean;
  temas: Array<{ nome: string; slug: string; tipo: "time" | "assunto" }>;
};

export type PostFull = PostListItem & {
  conteudo: string | null;
  atualizado_em: string;
};

async function attachTemas(sb: ReturnType<typeof publicClient>, posts: any[]): Promise<any[]> {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const { data: rels } = await sb
    .from("post_temas")
    .select("post_id, temas(nome, slug, tipo)")
    .in("post_id", ids);
  const map = new Map<string, any[]>();
  (rels ?? []).forEach((r: any) => {
    if (!r.temas) return;
    const arr = map.get(r.post_id) ?? [];
    arr.push(r.temas);
    map.set(r.post_id, arr);
  });
  return posts.map((p) => ({ ...p, temas: map.get(p.id) ?? [] }));
}

const listSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    perPage: z.number().int().min(1).max(50).default(12),
  })
  .default({ page: 1, perPage: 12 });

export const listPosts = createServerFn({ method: "GET" })
  .inputValidator((v) => listSchema.parse(v))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const from = (data.page - 1) * data.perPage;
    const to = from + data.perPage - 1;
    const { data: posts, count, error } = await sb
      .from("posts")
      .select("id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca", {
        count: "exact",
      })
      .eq("status", "publicado")
      .lte("publicado_em", new Date().toISOString())
      .order("publicado_em", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw error;
    const items = await attachTemas(sb, posts ?? []);
    return {
      items: items as PostListItem[],
      total: count ?? 0,
      page: data.page,
      perPage: data.perPage,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / data.perPage)),
    };
  });

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const now = new Date().toISOString();

  const [{ data: fixado }, { data: naoPerca }, { data: recentes }, { data: temasMenu }, { data: config }] =
    await Promise.all([
      sb
        .from("posts")
        .select("id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca")
        .eq("status", "publicado")
        .eq("destaque", true)
        .lte("publicado_em", now)
        .order("publicado_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(1),
      sb
        .from("posts")
        .select("id,titulo,slug,publicado_em")
        .eq("status", "publicado")
        .eq("nao_perca", true)
        .lte("publicado_em", now)
        .order("publicado_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(6),
      sb
        .from("posts")
        .select("id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca")
        .eq("status", "publicado")
        .lte("publicado_em", now)
        .order("publicado_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(18),
      sb
        .from("temas")
        .select("nome,slug,tipo,destaque_menu,ordem")
        .order("ordem", { ascending: true }),
      sb.from("configuracoes").select("chave,valor"),
    ]);

  const configMap: Record<string, any> = {};
  (config ?? []).forEach((c: any) => { configMap[c.chave] = c.valor; });

  const fixadoList = await attachTemas(sb, fixado ?? []);
  const recentesList = await attachTemas(sb, recentes ?? []);

  // Se há uma matéria fixada, ela é a manchete; senão, a mais recente.
  const manchete = (fixadoList[0] ?? recentesList[0] ?? null) as PostListItem | null;
  const restantes = manchete
    ? recentesList.filter((p: any) => p.id !== manchete.id)
    : recentesList.slice(1);

  return {
    destaque: manchete,
    leiaAgora: restantes.slice(0, 5) as PostListItem[],
    ultimas: restantes as PostListItem[],
    naoPerca: (naoPerca ?? []) as Array<{ id: string; titulo: string; slug: string; publicado_em: string | null }>,
    temasMenu: (temasMenu ?? []) as Array<{ nome: string; slug: string; tipo: "time" | "assunto"; destaque_menu: boolean; ordem: number }>,
    config: configMap,
  };
});

export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((v) => z.object({ slug: z.string().min(1) }).parse(v))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const now = new Date().toISOString();
    const { data: post, error } = await sb
      .from("posts")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "publicado")
      .lte("publicado_em", now)
      .maybeSingle();
    if (error) throw error;
    if (!post) return null;
    const [withTemas] = await attachTemas(sb, [post]);

    // Leia também: 3 posts do mesmo tema, mais recentes primeiro
    let relacionados: PostListItem[] = [];
    if (withTemas.temas && withTemas.temas.length > 0) {
      const slugs = withTemas.temas.map((t: any) => t.slug);
      const { data: temaIds } = await sb.from("temas").select("id").in("slug", slugs);
      const ids = (temaIds ?? []).map((t: any) => t.id);
      if (ids.length > 0) {
        const { data: rel } = await sb
          .from("post_temas")
          .select("post_id, posts!inner(id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca,status)")
          .in("tema_id", ids)
          .eq("posts.status", "publicado")
          .lte("posts.publicado_em", now)
          .order("posts(publicado_em)", { ascending: false })
          .order("posts(id)", { ascending: false })
          .limit(30);
        const seen = new Set<string>([post.id]);
        const items: any[] = [];
        (rel ?? []).forEach((r: any) => {
          if (r.posts && !seen.has(r.posts.id)) {
            seen.add(r.posts.id);
            items.push(r.posts);
          }
        });
        relacionados = (await attachTemas(sb, items.slice(0, 3))) as PostListItem[];
      }
    }

    return { post: withTemas as PostFull, relacionados };
  });

export const getPostsByTema = createServerFn({ method: "GET" })
  .inputValidator((v) =>
    z.object({
      slug: z.string().min(1),
      tipo: z.enum(["time", "assunto"]),
      page: z.number().int().min(1).default(1),
    }).parse(v),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const perPage = 12;
    const { data: tema } = await sb
      .from("temas")
      .select("id,nome,slug,tipo")
      .eq("slug", data.slug)
      .eq("tipo", data.tipo)
      .maybeSingle();
    if (!tema) return { tema: null, items: [], total: 0, page: data.page, totalPages: 1, perPage };

    const from = (data.page - 1) * perPage;
    const to = from + perPage - 1;
    const { data: rels, count } = await sb
      .from("post_temas")
      .select("posts!inner(id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca,status)", {
        count: "exact",
      })
      .eq("tema_id", tema.id)
      .order("posts(publicado_em)", { ascending: false })
      .range(from, to);

    const posts = (rels ?? [])
      .map((r: any) => r.posts)
      .filter((p: any) => p && p.status === "publicado");
    const withTemas = await attachTemas(sb, posts);
    return {
      tema,
      items: withTemas as PostListItem[],
      total: count ?? 0,
      page: data.page,
      perPage,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
    };
  });

export const searchPosts = createServerFn({ method: "GET" })
  .inputValidator((v) => z.object({ q: z.string().min(1).max(120), page: z.number().int().min(1).default(1) }).parse(v))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const perPage = 12;
    const from = (data.page - 1) * perPage;
    const to = from + perPage - 1;
    const q = `%${data.q}%`;
    const { data: posts, count, error } = await sb
      .from("posts")
      .select("id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca", { count: "exact" })
      .eq("status", "publicado")
      .lte("publicado_em", new Date().toISOString())
      .or(`titulo.ilike.${q},resumo.ilike.${q}`)
      .order("publicado_em", { ascending: false })
      .range(from, to);
    if (error) throw error;
    const items = await attachTemas(sb, posts ?? []);
    return {
      items: items as PostListItem[],
      total: count ?? 0,
      page: data.page,
      perPage,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      q: data.q,
    };
  });

export const getSiteConfig = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [{ data: config }, { data: temasMenu }] = await Promise.all([
    sb.from("configuracoes").select("chave,valor"),
    sb.from("temas").select("nome,slug,tipo,destaque_menu,ordem").eq("destaque_menu", true).order("ordem"),
  ]);
  const configMap: Record<string, any> = {};
  (config ?? []).forEach((c: any) => { configMap[c.chave] = c.valor; });
  return { config: configMap, temasMenu: temasMenu ?? [] };
});

export const enviarContato = createServerFn({ method: "POST" })
  .inputValidator((v) =>
    z.object({
      nome: z.string().min(1).max(120),
      email: z.string().email().max(200),
      assunto: z.string().max(200).optional().default(""),
      mensagem: z.string().min(1).max(4000),
    }).parse(v),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await sb.from("contatos").insert({
      nome: data.nome,
      email: data.email,
      assunto: data.assunto || null,
      mensagem: data.mensagem,
    });
    if (error) throw new Error("Não foi possível enviar sua mensagem.");
    return { ok: true };
  });

export const listAllPublishedSlugs = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data } = await sb
    .from("posts")
    .select("slug,publicado_em,atualizado_em")
    .eq("status", "publicado")
    .lte("publicado_em", new Date().toISOString())
    .order("publicado_em", { ascending: false })
    .limit(5000);
  return data ?? [];
});

export const listRecentForFeed = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data } = await sb
    .from("posts")
    .select("titulo,slug,resumo,publicado_em,imagem_capa")
    .eq("status", "publicado")
    .lte("publicado_em", new Date().toISOString())
    .order("publicado_em", { ascending: false })
    .limit(30);
  return data ?? [];
});
